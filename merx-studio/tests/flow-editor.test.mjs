import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildExecutableSpec, buildManifest, buildTestPayload, createProject } from '../assets/domain.js';
import {
  BLOCKS,
  BUDGET_PROFILE,
  FLOW_SCHEMA,
  HISTORY_LIMIT,
  TARGET_DEVICE,
  applyOp,
  blockDefaults,
  compileFlow,
  connectDiagnosis,
  createGraph,
  createHistory,
  estimateBudget,
  flowTestGate,
  migrateLegacy,
  pushHistory,
  recognizePipeline,
  redoHistory,
  typesCompatible,
  undoHistory,
  validateGraph,
} from '../assets/flow.js';
import { flowEditorHtml } from '../assets/flow-editor.js';
import { LOCALES, setLocale, t } from '../assets/i18n.js';

const VENDOR = /hailo|raspberry|rockchip|nvidia|coral|qualcomm|amlogic|rk3588/i;

function tuned(templateId, patch) {
  const project = createProject({ name: templateId === 'line-crossing' ? 'Contagem da loja' : 'Presença', templateId });
  Object.assign(project.configuration, patch);
  return project;
}

function assertPayloadParity(project) {
  const graph = migrateLegacy(project);
  const compiled = compileFlow(graph, project, { deviceId: null, cameraId: null });
  assert.equal(compiled.supported, true, JSON.stringify(compiled.validation?.errors));
  assert.equal(recognizePipeline(graph).kind, project.configuration.mode === 'line_crossing' ? 'line_crossing' : project.configuration.mode);
  assert.deepEqual(compiled.configuration, project.configuration);
  assert.deepEqual(compiled.device, buildExecutableSpec(project).device);
  assert.deepEqual(compiled.rules, buildManifest(project).rules);
  assert.deepEqual(compiled.testPayload, buildTestPayload(project, { deviceId: null, cameraId: null }));
  assert.equal(graph.schema, FLOW_SCHEMA);
  assert.equal(graph.target.device, TARGET_DEVICE);
  assert.equal(graph.target.budgetProfile, BUDGET_PROFILE.id);
}

test('migrated line crossing, presence and dwell compile to today\'s device payload', () => {
  assertPayloadParity(tuned('line-crossing', {
    targetFps: 6,
    direction: 'left_to_right',
    confidence: 0.8,
    cooldownSeconds: 12,
    minFrames: 4,
    line: { start: { x: 0.2, y: 0.3 }, end: { x: 0.8, y: 0.7 } },
    zone: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
  }));
  assertPayloadParity(tuned('presence-zone', {
    targetFps: 3,
    confidence: 0.42,
    cooldownSeconds: 8,
    minFrames: 5,
    zone: { x: 0.05, y: 0.1, width: 0.4, height: 0.55 },
  }));
  assertPayloadParity(tuned('dwell-time', {
    targetFps: 9,
    minDurationSeconds: 45,
    cooldownSeconds: 15,
    confidence: 0.7,
    zone: { x: 0.2, y: 0.2, width: 0.6, height: 0.5 },
  }));
  const polygon = createProject({ name: 'Zona livre', templateId: 'presence-zone' });
  polygon.configuration.zone = [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.2 }, { x: 0.7, y: 0.9 }, { x: 0.2, y: 0.8 }];
  assertPayloadParity(polygon);
});

test('a graph assembled with the same operations as drag and drop matches the line-crossing payload', () => {
  const project = createProject({ name: 'Contagem da loja', templateId: 'line-crossing' });
  project.configuration.targetFps = 7;
  project.configuration.direction = 'top_to_bottom';
  project.configuration.confidence = 0.55;
  let graph = createGraph({ projectId: project.id, name: project.name, description: project.description, locale: 'pt-BR' });
  const c = project.configuration;
  const steps = [
    { op: 'set_meta', execution: { model: c.model, backendPolicy: c.backendPolicy, targetVariant: c.targetVariant, minDurationSeconds: c.minDurationSeconds, line: c.line, direction: c.direction } },
    { op: 'add_node', id: 'cam', type: 'source.camera@1', props: { ...blockDefaults('source.camera@1'), fps: c.targetFps }, position: { x: 48, y: 32 } },
    { op: 'add_node', id: 'person', type: 'detect.person@1', props: { ...blockDefaults('detect.person@1'), confidence: c.confidence, classNames: c.classNames.slice(), roi: c.zone }, position: { x: 48, y: 180 } },
    { op: 'add_node', id: 'tracker', type: 'track.tracker@1', props: { ...blockDefaults('track.tracker@1'), minFrames: c.minFrames }, position: { x: 48, y: 330 } },
    { op: 'add_node', id: 'line', type: 'geometry.line@1', props: { ...blockDefaults('geometry.line@1'), line: c.line, direction: c.direction }, position: { x: 48, y: 480 } },
    { op: 'add_node', id: 'counter', type: 'logic.counter@1', props: blockDefaults('logic.counter@1'), position: { x: 320, y: 480 } },
    { op: 'add_node', id: 'event', type: 'action.event@1', props: { ...blockDefaults('action.event@1'), cooldownSeconds: c.cooldownSeconds }, position: { x: 48, y: 640 } },
    { op: 'connect', from: 'cam.frame', to: 'person.frame' },
    { op: 'connect', from: 'person.detections', to: 'tracker.detections' },
    { op: 'connect', from: 'tracker.tracks', to: 'line.tracks' },
    { op: 'connect', from: 'line.events', to: 'event.events' },
    { op: 'connect', from: 'line.events', to: 'counter.events' },
  ];
  for (const op of steps) {
    const result = applyOp(graph, op);
    assert.equal(result.error, undefined, JSON.stringify(result.error));
    graph = result.graph;
  }
  const compiled = compileFlow(graph, project, { deviceId: 'dev-1', cameraId: 'cam-9' });
  assert.equal(compiled.supported, true);
  assert.deepEqual(compiled.device, buildExecutableSpec(project).device);
  assert.deepEqual(compiled.testPayload, buildTestPayload(project, { deviceId: 'dev-1', cameraId: 'cam-9' }));
});

test('incompatible wires and cycles are rejected with a reason', () => {
  let graph = createGraph({ name: 'Ligação' });
  for (const op of [
    { op: 'add_node', id: 'cam', type: 'source.camera@1', position: { x: 0, y: 0 } },
    { op: 'add_node', id: 'person', type: 'detect.person@1', position: { x: 0, y: 80 } },
    { op: 'add_node', id: 'event', type: 'action.event@1', position: { x: 0, y: 160 } },
  ]) graph = applyOp(graph, op).graph;
  const mismatch = applyOp(graph, { op: 'connect', from: 'cam.frame', to: 'event.events' });
  assert.equal(mismatch.error.code, 'type');
  assert.equal(mismatch.error.key, 'flow.reason.type');
  assert.equal(mismatch.graph, undefined);
  graph = applyOp(graph, { op: 'connect', from: 'cam.frame', to: 'person.frame' }).graph;
  const back = applyOp(graph, { op: 'connect', from: 'person.detections', to: 'cam.frame' });
  assert.equal(back.error.code, 'port');
  const tracker = applyOp(graph, { op: 'add_node', id: 'tracker', type: 'track.tracker@1', position: { x: 0, y: 240 } }).graph;
  const linked = applyOp(tracker, { op: 'connect', from: 'person.detections', to: 'tracker.detections' }).graph;
  const cycle = applyOp(linked, { op: 'connect', from: 'tracker.tracks', to: 'person.frame' });
  assert.equal(cycle.error.code, 'type');
  const zone = applyOp(linked, { op: 'add_node', id: 'zone', type: 'geometry.zone@1', position: { x: 0, y: 320 } }).graph;
  const zoned = applyOp(zone, { op: 'connect', from: 'tracker.tracks', to: 'zone.tracks' }).graph;
  const loop = applyOp(zoned, { op: 'connect', from: 'zone.events', to: 'tracker.detections' });
  assert.equal(loop.error.code, 'type');
  const self = connectDiagnosis(zoned, 'zone.events', 'zone.tracks');
  assert.equal(self.ok, false);
  const second = applyOp(applyOp(zoned, { op: 'add_node', id: 'zone2', type: 'geometry.zone@1', position: { x: 200, y: 320 } }).graph, { op: 'connect', from: 'tracker.tracks', to: 'zone2.tracks' });
  assert.equal(second.error, undefined);
  const taken = applyOp(second.graph, { op: 'connect', from: 'zone.events', to: 'zone2.tracks' });
  assert.ok(taken.error);
  assert.equal(taken.error.code === 'single' || taken.error.code === 'type', true);
});

test('cycles are rejected with a reason, and compatible subtypes still connect', () => {
  assert.equal(typesCompatible('ZoneEvents<person>', 'Events').ok, true);
  assert.equal(typesCompatible('CrossEvents<person>', 'Events').ok, true);
  assert.equal(typesCompatible('Detections<person>', 'Detections<*>').ok, true);
  assert.equal(typesCompatible('Detections<person>', 'Detections<vehicle>').ok, false);
  assert.equal(typesCompatible('Detections<person>', 'Detections<vehicle>').code, 'class');
  assert.equal(typesCompatible('Number', 'Frame').ok, false);
  let graph = createGraph({ name: 'Ciclo' });
  for (const op of [
    { op: 'add_node', id: 'a', type: 'logic.condition@1', position: { x: 0, y: 0 } },
    { op: 'add_node', id: 'b', type: 'logic.condition@1', position: { x: 280, y: 0 } },
  ]) graph = applyOp(graph, op).graph;
  graph = applyOp(graph, { op: 'connect', from: 'a.events', to: 'b.events' }).graph;
  const cycle = applyOp(graph, { op: 'connect', from: 'b.events', to: 'a.events' });
  assert.equal(cycle.error.code, 'cycle');
  assert.equal(cycle.error.key, 'flow.reason.cycle');
  assert.equal(cycle.graph, undefined);
  const presence = migrateLegacy(createProject({ name: 'Presença', templateId: 'presence-zone' }));
  const zone = presence.nodes.find(node => node.type === 'geometry.zone@1');
  const event = presence.nodes.find(node => node.type === 'action.event@1');
  const open = applyOp(presence, { op: 'disconnect', edgeId: presence.edges.find(edge => edge.to === `${event.id}.events`).id }).graph;
  const again = applyOp(open, { op: 'connect', from: `${zone.id}.events`, to: `${event.id}.events` });
  assert.equal(again.error, undefined);
  let cameras = createGraph({ name: 'Entrada única' });
  for (const op of [
    { op: 'add_node', id: 'cam', type: 'source.camera@1', position: { x: 0, y: 0 } },
    { op: 'add_node', id: 'cam2', type: 'source.camera@1', position: { x: 280, y: 0 } },
    { op: 'add_node', id: 'person', type: 'detect.person@1', position: { x: 0, y: 160 } },
  ]) cameras = applyOp(cameras, op).graph;
  cameras = applyOp(cameras, { op: 'connect', from: 'cam.frame', to: 'person.frame' }).graph;
  const second = connectDiagnosis(cameras, 'cam2.frame', 'person.frame');
  assert.equal(second.ok, false);
  assert.equal(second.code, 'single');
  for (const locale of ['pt', 'en', 'es']) {
    setLocale(locale);
    const reason = t('flow.reason.cycle');
    const typed = t('flow.reason.type', { out: t('flow.type.Frame'), inn: t('flow.type.Events') });
    assert.notEqual(reason.trim(), '');
    assert.equal(VENDOR.test(reason + typed), false);
    assert.notEqual(reason, t('flow.reason.type'));
  }
  setLocale('pt');
});

test('undo and redo keep fifty graph operations', () => {
  const project = createProject({ name: 'Presença', templateId: 'presence-zone' });
  let graph = migrateLegacy(project);
  const camera = graph.nodes.find(node => node.type === 'source.camera@1');
  const history = createHistory(HISTORY_LIMIT);
  const original = camera.props.fps;
  for (let step = 0; step < 50; step += 1) {
    const result = pushHistory(history, graph, { op: 'update_node', id: camera.id, props: { fps: (step % 10) + 1 } });
    assert.equal(result.error, undefined);
    graph = result.graph;
  }
  assert.equal(history.undo.length, 50);
  for (let step = 0; step < 50; step += 1) {
    const result = undoHistory(history, graph);
    assert.equal(result.error, undefined);
    graph = result.graph;
  }
  assert.equal(graph.nodes.find(node => node.id === camera.id).props.fps, original);
  assert.equal(history.undo.length, 0);
  const redone = redoHistory(history, graph);
  assert.equal(redone.error, undefined);
  assert.notEqual(redone.graph.nodes.find(node => node.id === camera.id).props.fps, original);
  const again = undoHistory(history, redone.graph);
  assert.equal(again.graph.nodes.find(node => node.id === camera.id).props.fps, original);
  let limited = migrateLegacy(project);
  const limitedCamera = limited.nodes.find(node => node.type === 'source.camera@1');
  const limitedHistory = createHistory(HISTORY_LIMIT);
  for (let step = 0; step < HISTORY_LIMIT + 1; step += 1) {
    const result = pushHistory(limitedHistory, limited, { op: 'update_node', id: limitedCamera.id, props: { fps: (step % 10) + 1 } });
    limited = result.graph;
  }
  assert.equal(limitedHistory.undo.length, HISTORY_LIMIT);
});

test('budget deduplicates the same detector, respects 1–10 FPS, and stays under 200 ms', () => {
  const project = createProject({ name: 'Contagem da loja', templateId: 'line-crossing' });
  const graph = migrateLegacy(project);
  const camera = graph.nodes.find(node => node.type === 'source.camera@1');
  const at = fps => estimateBudget(applyOp(graph, { op: 'update_node', id: camera.id, props: { fps, resolution: 640 } }).graph);
  assert.equal(at(10).level, 'ok');
  assert.ok(at(5).percent < at(10).percent);
  assert.ok(Math.abs(at(5).percent * 2 - at(10).percent) < 0.001);
  const high = estimateBudget(applyOp(graph, { op: 'update_node', id: camera.id, props: { fps: 10, resolution: 1280 } }).graph);
  assert.equal(high.level, 'error');
  assert.equal(validateGraph(applyOp(graph, { op: 'update_node', id: camera.id, props: { fps: 0 } }).graph).errors.some(error => error.code === 'fps'), true);
  assert.equal(validateGraph(applyOp(graph, { op: 'update_node', id: camera.id, props: { fps: 11 } }).graph).errors.some(error => error.code === 'fps'), true);
  const warned = estimateBudget(applyOp(graph, { op: 'update_node', id: camera.id, props: { fps: 10, resolution: 960 } }).graph);
  assert.equal(warned.level, 'warn');
  const person = graph.nodes.find(node => node.type === 'detect.person@1');
  const duplicated = applyOp(graph, { op: 'add_node', id: 'person2', type: 'detect.person@1', props: blockDefaults('detect.person@1'), position: { x: 300, y: 180 } }).graph;
  const joined = applyOp(duplicated, { op: 'connect', from: `${camera.id}.frame`, to: 'person2.frame' }).graph;
  assert.equal(estimateBudget(joined).tops, estimateBudget(graph).tops);
  assert.equal(joined.nodes.filter(node => node.type === 'detect.person@1').length, 2);
  assert.ok(person);
  const secondCamera = applyOp(graph, { op: 'add_node', id: 'cam2', type: 'source.camera@1', props: { ...blockDefaults('source.camera@1'), fps: 10 }, position: { x: 400, y: 32 } }).graph;
  const secondPerson = applyOp(secondCamera, { op: 'add_node', id: 'person2', type: 'detect.person@1', props: blockDefaults('detect.person@1'), position: { x: 400, y: 180 } }).graph;
  const secondLink = applyOp(secondPerson, { op: 'connect', from: 'cam2.frame', to: 'person2.frame' }).graph;
  assert.equal(estimateBudget(secondLink).level, 'error');
  const started = performance.now();
  for (let i = 0; i < 40; i += 1) estimateBudget(graph);
  assert.ok(performance.now() - started < 200);
  const gate = flowTestGate(project);
  assert.equal(gate.ok, true);
  const broken = structuredClone(graph);
  const line = broken.nodes.find(node => node.type === 'geometry.line@1');
  line.props.line.end = { ...line.props.line.start };
  broken.schema = FLOW_SCHEMA;
  assert.equal(flowTestGate({ ...project, flow: broken }).ok, false);
});

test('flow strings exist in Portuguese, English and Spanish without vendor names', () => {
  const keys = Object.keys(LOCALES.pt).filter(key => key.startsWith('flow.'));
  assert.ok(keys.length > 40);
  for (const locale of ['pt', 'en', 'es']) {
    for (const key of keys) {
      const value = LOCALES[locale][key];
      assert.equal(typeof value, 'string', `${locale} ${key}`);
      assert.notEqual(value.trim(), '');
      assert.equal(VENDOR.test(value), false, `${locale} ${key} ${value}`);
    }
  }
  setLocale('en');
  assert.match(t('flow.budgetOf'), /NPU Merx 13 TOPS/);
  assert.match(t('flow.budget', { pct: 65, fps: 10, max: 10 }), /65/);
  assert.doesNotMatch(t('flow.title'), /fluxo|câmera|não/i);
  setLocale('es');
  assert.doesNotMatch(t('flow.title'), /\bFlow\b|câmera/);
  setLocale('pt');
  assert.match(t('flow.title'), /fluxo/i);
  assert.equal(BLOCKS['detect.person@1'].cost.npuPerFrame > 0, true);
  assert.equal(BLOCKS['source.camera@1'].outputs[0].type, 'Frame');
});

test('the flow editor renders one language at a time and the lab keeps the camera across tabs', () => {
  const project = createProject({ name: 'Presença', templateId: 'presence-zone' });
  const graph = migrateLegacy(project);
  const icon = () => '<svg></svg>';
  const esc = value => String(value ?? '');
  const view = { selectedId: graph.nodes[0].id, panX: 20, panY: 20, zoom: 1, query: '', notice: null };
  setLocale('en');
  const english = flowEditorHtml({ graph, view, history: { undo: [], redo: [] }, t, icon, esc });
  assert.match(english, /Build the flow/);
  assert.match(english, />Camera</);
  assert.equal(english.includes('Desfazer'), false);
  assert.equal(english.includes('Propriedades'), false);
  assert.equal(english.includes('Monte o fluxo'), false);
  setLocale('es');
  const spanish = flowEditorHtml({ graph, view, history: { undo: [], redo: [] }, t, icon, esc });
  assert.match(spanish, /Arma el flujo/);
  assert.equal(spanish.includes('Build the flow'), false);
  assert.equal(spanish.includes('Desfazer'), false);
  setLocale('pt');
  const portuguese = flowEditorHtml({ graph, view, history: { undo: [], redo: [] }, t, icon, esc });
  assert.match(portuguese, /Monte o fluxo/);
  assert.match(portuguese, /NPU Merx 13 TOPS/);
  assert.equal(portuguese.includes('Build the flow'), false);
  const source = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  const setTab = source.slice(source.indexOf('function setTab'), source.indexOf('function openModal'));
  assert.equal(setTab.includes('stopMedia'), false);
  assert.match(source, /flowTestGate\(project\)/);
  assert.match(source, /if\(!gate\.ok\)/);
});
