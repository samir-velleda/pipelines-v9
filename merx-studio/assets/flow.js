/**
 * Merx Studio — editable analytic flow (schema merx.flow/1).
 *
 * Adjustments after checking this branch (PR #1, merx-studio/), not the spec draft:
 * - The Fluxo tab was a fixed list in app.js `flowPanel`, derived from configuration.mode.
 *   Rules live in configuration; the device payload is buildExecutableSpec().device
 *   (regra, classes, conf, zona, linha, sentido, fps, spec_version) plus buildTestPayload.
 * - Line direction is the five values the agent already stores (both / left_to_right /
 *   right_to_left / top_to_bottom / bottom_to_top). Sentido in/out/both is derived.
 *   A→B / B→A alone cannot round-trip today's payload.
 * - Presence is Camera → Person → Tracker → Zone → Event. Dwell inserts the time block.
 *   One shared "time" block would erase the mode the device payload still distinguishes
 *   via configuration.mode (both compile to regra "presenca").
 * - The counter outputs Number and the event input is Events, so the line-crossing
 *   graph fans out Line → Event and Line → Counter. The counter is a sink: today's
 *   regra "contagem" is the count, and there is no metric block in this phase.
 * - Arbitrary graphs do not compile to a device payload. The agent only accepts the
 *   two current analytics. Other graphs stay editable and block "Send test".
 * - Canvas is custom (no node-editor dependency): this portal has no bundler and
 *   script-src is 'self'.
 * - NPU costs in budget profile 2026-10 are estimates for "NPU Merx 13 TOPS".
 *   A lab measurement on the graph (meta.labMeasurement.tops) replaces the estimate.
 */

import { buildExecutableSpec, buildManifest, buildTestPayload } from './domain.js';

export const FLOW_SCHEMA = 'merx.flow/1';
export const TARGET_DEVICE = 'npu-merx-13';
export const BUDGET_PROFILE_ID = '2026-10';
export const HISTORY_LIMIT = 50;

/** Estimated cost on the reference device. Not a lab measurement. */
export const BUDGET_PROFILE = {
  id: BUDGET_PROFILE_ID,
  device: TARGET_DEVICE,
  tops: 13,
  warnRatio: 0.8,
  detectors: { 'detect.person@1': 0.85 },
  resolutionFactor: { 320: 0.45, 640: 1, 960: 1.35, 1280: 2.2 },
};

const DIRECTIONS = ['both', 'left_to_right', 'right_to_left', 'top_to_bottom', 'bottom_to_top'];
const ZONE_RECT = { x: 0.15, y: 0.15, width: 0.7, height: 0.7 };
const LINE_GEOM = { start: { x: 0.5, y: 0.15 }, end: { x: 0.5, y: 0.85 } };

const EXECUTION_DEFAULTS = {
  model: 'object-detector-v1',
  backendPolicy: 'accelerated',
  targetVariant: 'merx-standard',
  minDurationSeconds: 10,
  line: LINE_GEOM,
  direction: 'both',
};

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function rid() {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function propsSchema(fields) {
  const properties = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field.type === 'integer' || field.type === 'number') {
      properties[key] = { type: field.type, minimum: field.min, maximum: field.max, default: field.default, titleKey: field.titleKey };
    } else if (field.type === 'boolean') properties[key] = { type: 'boolean', default: field.default, titleKey: field.titleKey };
    else if (field.type === 'enum') properties[key] = { type: 'string', enum: field.values.slice(), default: field.default, titleKey: field.titleKey };
    else if (field.type === 'string') properties[key] = { type: 'string', default: field.default ?? '', titleKey: field.titleKey };
    else properties[key] = { type: 'object', default: clone(field.default), titleKey: field.titleKey };
  }
  return { type: 'object', properties, additionalProperties: true };
}

function block(spec) {
  return {
    ...spec,
    propsSchema: propsSchema(spec.props),
    defaults() {
      return Object.fromEntries(Object.entries(spec.props).map(([key, field]) => [key, clone(field.default)]));
    },
  };
}

export const BLOCKS = {
  'source.camera@1': block({
    category: 'source', star: true, runtime: 'device', sink: false, breaksCycle: false,
    previewOverlay: 'none',
    cost: { npuPerFrame: 0 },
    inputs: [],
    outputs: [{ id: 'frame', type: 'Frame' }],
    props: {
      cameraId: { type: 'string', default: '', titleKey: 'flow.prop.cameraId' },
      fps: { type: 'integer', min: 1, max: 10, default: 10, titleKey: 'flow.prop.fps', unitKey: 'flow.unit.fps' },
      resolution: { type: 'enum', values: [320, 640, 960, 1280], default: 640, titleKey: 'flow.prop.resolution' },
      privacyMask: { type: 'boolean', default: false, titleKey: 'flow.prop.privacy' },
    },
  }),
  'detect.person@1': block({
    category: 'detect', star: true, runtime: 'device', sink: false, breaksCycle: false,
    previewOverlay: 'boxes',
    cost: { npuPerFrame: 0.85 },
    inputs: [{ id: 'frame', type: 'Frame' }],
    outputs: [{ id: 'detections', type: 'Detections<person>' }],
    props: {
      confidence: { type: 'number', min: 0.1, max: 0.99, default: 0.65, titleKey: 'flow.prop.confidence', unitKey: 'flow.unit.pct' },
      minSize: { type: 'number', min: 0, max: 1, default: 0.02, titleKey: 'flow.prop.minSize' },
      classNames: { type: 'classes', default: ['person'], titleKey: 'flow.prop.classes' },
      roi: { type: 'rect', default: ZONE_RECT, titleKey: 'flow.prop.roi' },
    },
  }),
  'track.tracker@1': block({
    category: 'track', star: true, runtime: 'device', sink: false, breaksCycle: false,
    previewOverlay: 'tracks',
    cost: { npuPerFrame: 0 },
    inputs: [{ id: 'detections', type: 'Detections<*>' }],
    outputs: [{ id: 'tracks', type: 'Tracks<*>' }],
    props: {
      maxAge: { type: 'integer', min: 1, max: 120, default: 15, titleKey: 'flow.prop.maxAge' },
      iou: { type: 'number', min: 0, max: 1, default: 0.3, titleKey: 'flow.prop.iou' },
      maxDistance: { type: 'number', min: 0, max: 1, default: 0.5, titleKey: 'flow.prop.maxDistance' },
      minFrames: { type: 'integer', min: 1, max: 60, default: 3, titleKey: 'flow.prop.minFrames' },
    },
  }),
  'geometry.zone@1': block({
    category: 'geometry', star: true, runtime: 'device', sink: false, breaksCycle: false,
    previewOverlay: 'zone',
    cost: { npuPerFrame: 0 },
    inputs: [{ id: 'tracks', type: 'Tracks<*>' }],
    outputs: [{ id: 'events', type: 'ZoneEvents<*>' }],
    props: {
      name: { type: 'string', default: '', titleKey: 'flow.prop.zoneName' },
      rect: { type: 'rect', default: ZONE_RECT, titleKey: 'flow.prop.roi' },
    },
  }),
  'geometry.line@1': block({
    category: 'geometry', star: true, runtime: 'device', sink: false, breaksCycle: false,
    previewOverlay: 'line',
    cost: { npuPerFrame: 0 },
    inputs: [{ id: 'tracks', type: 'Tracks<*>' }],
    outputs: [{ id: 'events', type: 'CrossEvents<*>' }],
    props: {
      line: { type: 'line', default: LINE_GEOM, titleKey: 'flow.prop.line' },
      direction: { type: 'enum', values: DIRECTIONS, default: 'both', titleKey: 'flow.prop.direction' },
    },
  }),
  'logic.counter@1': block({
    category: 'logic', star: true, runtime: 'device', sink: true, breaksCycle: false,
    previewOverlay: 'events',
    cost: { npuPerFrame: 0 },
    inputs: [{ id: 'events', type: 'Events' }],
    outputs: [{ id: 'value', type: 'Number' }],
    props: {
      window: { type: 'enum', values: ['day', 'hour', 'rolling'], default: 'rolling', titleKey: 'flow.prop.window' },
    },
  }),
  'logic.dwell@1': block({
    category: 'logic', star: true, runtime: 'device', sink: false, breaksCycle: false,
    previewOverlay: 'events',
    cost: { npuPerFrame: 0 },
    inputs: [{ id: 'events', type: 'ZoneEvents<*>' }],
    outputs: [{ id: 'events', type: 'Events' }],
    props: {
      thresholdSeconds: { type: 'number', min: 1, max: 86400, default: 30, titleKey: 'flow.prop.threshold', unitKey: 'flow.unit.s' },
    },
  }),
  'logic.condition@1': block({
    category: 'logic', star: true, runtime: 'device', sink: false, breaksCycle: false,
    previewOverlay: 'events',
    cost: { npuPerFrame: 0 },
    inputs: [{ id: 'value', type: 'Number', optional: true }, { id: 'events', type: 'Events', optional: true }],
    outputs: [{ id: 'events', type: 'Events' }],
    props: {
      operator: { type: 'enum', values: ['gt', 'lt', 'eq', 'between'], default: 'gt', titleKey: 'flow.prop.operator' },
      value: { type: 'number', min: 0, max: 1000000, default: 1, titleKey: 'flow.prop.value' },
      valueMax: { type: 'number', min: 0, max: 1000000, default: 5, titleKey: 'flow.prop.valueMax' },
    },
  }),
  'action.event@1': block({
    category: 'action', star: true, runtime: 'device', sink: true, breaksCycle: false,
    previewOverlay: 'log',
    cost: { npuPerFrame: 0 },
    inputs: [{ id: 'events', type: 'Events' }],
    outputs: [],
    props: {
      eventType: { type: 'enum', values: ['info', 'alert'], default: 'info', titleKey: 'flow.prop.eventType' },
      severity: { type: 'enum', values: ['low', 'medium', 'high'], default: 'medium', titleKey: 'flow.prop.severity' },
      cooldownSeconds: { type: 'number', min: 0, max: 86400, default: 30, titleKey: 'flow.prop.cooldown', unitKey: 'flow.unit.s' },
      snapshot: { type: 'boolean', default: true, titleKey: 'flow.prop.snapshot' },
    },
  }),
};

export const BLOCK_ORDER = Object.keys(BLOCKS);

export function blockDefaults(type) {
  const spec = BLOCKS[type];
  if (!spec) return {};
  return spec.defaults();
}

export function createGraph({ projectId = '', name = '', description = '', locale = 'pt-BR', createdBy = 'user' } = {}) {
  return {
    schema: FLOW_SCHEMA,
    id: rid(),
    projectId,
    version: 1,
    meta: {
      name: String(name || ''),
      description: String(description || ''),
      locale,
      execution: clone(EXECUTION_DEFAULTS),
    },
    target: { device: TARGET_DEVICE, budgetProfile: BUDGET_PROFILE_ID },
    nodes: [],
    edges: [],
    createdBy,
    updatedAt: new Date().toISOString(),
  };
}

function splitRef(ref) {
  const text = String(ref || '');
  const dot = text.indexOf('.');
  if (dot <= 0 || dot === text.length - 1) return null;
  return { id: text.slice(0, dot), port: text.slice(dot + 1) };
}

function parseType(type) {
  const match = /^(Frame|Number|Bool|Events|Detections|Tracks|ZoneEvents|CrossEvents)(?:<([a-z0-9_*]+)>)?$/.exec(String(type || ''));
  if (!match) return null;
  return { family: match[1], cls: match[2] || null };
}

const FAMILY_PARENTS = { ZoneEvents: ['Events'], CrossEvents: ['Events'] };

export function typesCompatible(outType, inType) {
  const out = parseType(outType);
  const inn = parseType(inType);
  if (!out || !inn) return { ok: false, code: 'type' };
  const familyOk = out.family === inn.family || (FAMILY_PARENTS[out.family] || []).includes(inn.family);
  if (!familyOk) return { ok: false, code: 'type' };
  if (out.cls && inn.cls && out.cls !== '*' && inn.cls !== '*' && out.cls !== inn.cls) return { ok: false, code: 'class' };
  return { ok: true };
}

function nodeById(graph, id) {
  return graph.nodes.find(node => node.id === id) || null;
}

export function resolveClass(graph, node, seen = new Set()) {
  if (!node || seen.has(node.id)) return null;
  seen.add(node.id);
  if (node.type === 'detect.person@1') return 'person';
  const incoming = graph.edges.find(edge => edge.to.startsWith(`${node.id}.`));
  if (!incoming) return null;
  const from = splitRef(incoming.from);
  const source = from && nodeById(graph, from.id);
  if (!source) return null;
  const type = resolvedPortType(graph, source, from.port, 'out', seen);
  return parseType(type)?.cls && parseType(type).cls !== '*' ? parseType(type).cls : resolveClass(graph, source, seen);
}

export function resolvedPortType(graph, node, portId, direction, seen = new Set()) {
  const spec = BLOCKS[node?.type];
  if (!spec) return null;
  const list = direction === 'out' ? spec.outputs : spec.inputs;
  const port = list.find(item => item.id === portId);
  if (!port) return null;
  const parsed = parseType(port.type);
  if (parsed?.cls === '*') {
    const cls = resolveClass(graph, node, seen);
    if (cls && cls !== '*') return `${parsed.family}<${cls}>`;
  }
  return port.type;
}

function reaches(graph, start, goal) {
  const stack = [start];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (current === goal) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const edge of graph.edges) {
      if (!edge.from.startsWith(`${current}.`)) continue;
      const next = splitRef(edge.to)?.id;
      const nextNode = next && nodeById(graph, next);
      if (nextNode && BLOCKS[nextNode.type]?.breaksCycle) continue;
      if (next) stack.push(next);
    }
  }
  return false;
}

function wouldCycle(graph, fromId, toId) {
  if (fromId === toId) return true;
  const target = nodeById(graph, toId);
  if (target && BLOCKS[target.type]?.breaksCycle) return false;
  return reaches(graph, toId, fromId);
}

export function connectDiagnosis(graph, fromRef, toRef) {
  const from = splitRef(fromRef);
  const to = splitRef(toRef);
  if (!from || !to) return { ok: false, code: 'port', key: 'flow.reason.port' };
  const source = nodeById(graph, from.id);
  const target = nodeById(graph, to.id);
  if (!source || !target || !BLOCKS[source.type] || !BLOCKS[target.type]) return { ok: false, code: 'port', key: 'flow.reason.port' };
  const outType = resolvedPortType(graph, source, from.port, 'out');
  const inSpec = BLOCKS[target.type].inputs.find(port => port.id === to.port);
  if (!outType || !inSpec) return { ok: false, code: 'port', key: 'flow.reason.port' };
  const compat = typesCompatible(outType, inSpec.type);
  if (!compat.ok) {
    return { ok: false, code: compat.code, key: compat.code === 'class' ? 'flow.reason.class' : 'flow.reason.type', outType, inType: inSpec.type };
  }
  if (from.id === to.id) return { ok: false, code: 'self', key: 'flow.reason.self' };
  const existing = graph.edges.filter(edge => edge.to === toRef);
  if (existing.length && !inSpec.multi) return { ok: false, code: 'single', key: 'flow.reason.single' };
  if (wouldCycle(graph, from.id, to.id)) return { ok: false, code: 'cycle', key: 'flow.reason.cycle' };
  return { ok: true, outType, inType: inSpec.type };
}

export function applyOp(graph, op) {
  if (!graph || graph.schema !== FLOW_SCHEMA) return { error: { code: 'schema', key: 'flow.err.unsupported' } };
  const next = clone(graph);
  next.updatedAt = new Date().toISOString();
  const kind = op?.op;
  if (kind === 'add_node') {
    if (!BLOCKS[op.type] || !op.id || nodeById(next, op.id)) return { error: { code: 'node', key: 'flow.err.props' } };
    next.nodes.push({
      id: String(op.id),
      type: op.type,
      props: { ...blockDefaults(op.type), ...(op.props || {}) },
      ui: { x: Number(op.position?.x) || 0, y: Number(op.position?.y) || 0 },
    });
  } else if (kind === 'update_node') {
    const node = nodeById(next, op.id);
    if (!node) return { error: { code: 'node', key: 'flow.err.props' } };
    if (op.props) node.props = { ...node.props, ...clone(op.props) };
    if (op.position) node.ui = { x: Number(op.position.x) || 0, y: Number(op.position.y) || 0 };
  } else if (kind === 'remove_node') {
    if (!nodeById(next, op.id)) return { error: { code: 'node', key: 'flow.err.props' } };
    next.nodes = next.nodes.filter(node => node.id !== op.id);
    next.edges = next.edges.filter(edge => !edge.from.startsWith(`${op.id}.`) && !edge.to.startsWith(`${op.id}.`));
  } else if (kind === 'connect') {
    const diagnosis = connectDiagnosis(next, op.from, op.to);
    if (!diagnosis.ok) return { error: diagnosis };
    next.edges.push({ id: op.edgeId || rid(), from: op.from, to: op.to });
  } else if (kind === 'disconnect') {
    if (!next.edges.some(edge => edge.id === op.edgeId)) return { error: { code: 'port', key: 'flow.reason.port' } };
    next.edges = next.edges.filter(edge => edge.id !== op.edgeId);
  } else if (kind === 'set_meta') {
    if (op.name !== undefined) next.meta.name = String(op.name);
    if (op.description !== undefined) next.meta.description = String(op.description);
    if (op.locale !== undefined) next.meta.locale = String(op.locale);
    if (op.execution) next.meta.execution = { ...next.meta.execution, ...clone(op.execution) };
  } else return { error: { code: 'op', key: 'flow.err.unsupported' } };
  next.version = (Number(graph.version) || 1) + 1;
  return { graph: next };
}

export function createHistory(limit = HISTORY_LIMIT) {
  return { undo: [], redo: [], limit };
}

function inverseOf(before, op, applied) {
  if (op.op === 'add_node') return [{ op: 'remove_node', id: op.id }];
  if (op.op === 'remove_node') {
    const node = nodeById(before, op.id);
    const edges = before.edges.filter(edge => edge.from.startsWith(`${op.id}.`) || edge.to.startsWith(`${op.id}.`));
    return [
      { op: 'add_node', id: node.id, type: node.type, props: clone(node.props), position: { ...node.ui } },
      ...edges.map(edge => ({ op: 'connect', from: edge.from, to: edge.to, edgeId: edge.id })),
    ];
  }
  if (op.op === 'update_node') {
    const node = nodeById(before, op.id);
    return [{ op: 'update_node', id: op.id, props: clone(node.props), position: { ...node.ui } }];
  }
  if (op.op === 'connect') {
    const edge = applied.edges.find(item => item.from === op.from && item.to === op.to);
    return [{ op: 'disconnect', edgeId: edge?.id }];
  }
  if (op.op === 'disconnect') {
    const edge = before.edges.find(item => item.id === op.edgeId);
    return [{ op: 'connect', from: edge.from, to: edge.to, edgeId: edge.id }];
  }
  if (op.op === 'set_meta') {
    return [{ op: 'set_meta', name: before.meta.name, description: before.meta.description, locale: before.meta.locale, execution: clone(before.meta.execution) }];
  }
  return [];
}

function applyOps(graph, ops) {
  let current = graph;
  for (const op of ops) {
    const result = applyOp(current, op);
    if (result.error) return result;
    current = result.graph;
  }
  return { graph: current };
}

export function pushHistory(history, graph, op) {
  const result = applyOp(graph, op);
  if (result.error) return result;
  const inverse = inverseOf(graph, op, result.graph);
  history.undo.push({ op, inverse });
  if (history.undo.length > history.limit) history.undo.shift();
  history.redo = [];
  return result;
}

export function undoHistory(history, graph) {
  const entry = history.undo.pop();
  if (!entry) return { graph, error: { code: 'empty', key: 'flow.undo' } };
  const result = applyOps(graph, entry.inverse);
  if (result.error) { history.undo.push(entry); return result; }
  history.redo.push(entry);
  return result;
}

export function redoHistory(history, graph) {
  const entry = history.redo.pop();
  if (!entry) return { graph, error: { code: 'empty', key: 'flow.redo' } };
  const result = applyOp(graph, entry.op);
  if (result.error) { history.redo.push(entry); return result; }
  history.undo.push(entry);
  return result;
}

function finite(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return Math.abs(area) / 2;
}

function upstreamCamera(graph, nodeId, seen = new Set()) {
  if (seen.has(nodeId)) return null;
  seen.add(nodeId);
  const node = nodeById(graph, nodeId);
  if (!node) return null;
  if (node.type === 'source.camera@1') return node;
  for (const edge of graph.edges) {
    if (!edge.to.startsWith(`${nodeId}.`)) continue;
    const fromId = splitRef(edge.from)?.id;
    const camera = fromId && upstreamCamera(graph, fromId, seen);
    if (camera) return camera;
  }
  return null;
}

export function estimateBudget(graph, profile = BUDGET_PROFILE) {
  const cameras = new Map();
  const seenDetectors = new Set();
  let tops = 0;
  const contributors = [];
  if (graph?.meta?.labMeasurement && Number.isFinite(graph.meta.labMeasurement.tops)) {
    tops = graph.meta.labMeasurement.tops;
  } else {
    for (const node of graph?.nodes || []) {
      const perFrame = profile.detectors[node.type];
      if (!perFrame) continue;
      const camera = upstreamCamera(graph, node.id);
      if (!camera) continue;
      const key = `${camera.id}:${node.type}`;
      if (seenDetectors.has(key)) continue;
      seenDetectors.add(key);
      const fps = finite(Number(camera.props.fps), 1, 10) ? Number(camera.props.fps) : 0;
      const factor = profile.resolutionFactor[Number(camera.props.resolution)] ?? 1;
      const cost = perFrame * factor * fps;
      tops += cost;
      contributors.push({ nodeId: node.id, cameraId: camera.id, tops: cost });
      const entry = cameras.get(camera.id) || { id: camera.id, fps, name: camera.props.cameraId || '', tops: 0 };
      entry.tops += cost;
      entry.fps = fps;
      cameras.set(camera.id, entry);
    }
  }
  const percent = profile.tops > 0 ? (tops / profile.tops) * 100 : 0;
  const fpsValues = [...cameras.values()].map(camera => camera.fps);
  const fps = fpsValues.length ? Math.max(...fpsValues) : 0;
  let level = 'ok';
  if (percent > 100) level = 'error';
  else if (percent > profile.warnRatio * 100) level = 'warn';
  return {
    tops, percent, level, fps, fpsMax: 10, capacityTops: profile.tops,
    profileId: profile.id, device: profile.device,
    perCamera: [...cameras.values()],
    contributors,
    hotNodeIds: level === 'error' ? contributors.map(item => item.nodeId) : [],
  };
}

export function validateGraph(graph) {
  const errors = [];
  const warnings = [];
  const hints = [];
  const issue = (bucket, code, extra = {}) => bucket.push({ level: bucket === errors ? 'error' : bucket === warnings ? 'warning' : 'hint', code, key: `flow.err.${code}`, ...extra });
  if (!graph || graph.schema !== FLOW_SCHEMA) {
    issue(errors, 'unsupported');
    return { valid: false, errors, warnings, hints };
  }
  const ids = new Set();
  for (const node of graph.nodes) {
    if (ids.has(node.id) || !BLOCKS[node.type]) issue(errors, 'props', { nodeId: node.id });
    ids.add(node.id);
    const spec = BLOCKS[node.type];
    if (!spec) continue;
    let connectedInputs = 0;
    for (const port of spec.inputs) {
      const connected = graph.edges.some(edge => edge.to === `${node.id}.${port.id}`);
      if (connected) connectedInputs += 1;
      else if (!port.optional) issue(errors, 'loose', { nodeId: node.id, port: port.id });
    }
    if (spec.inputs.length && spec.inputs.every(port => port.optional) && connectedInputs === 0) issue(errors, 'loose', { nodeId: node.id });
    const hasOut = spec.outputs.length > 0;
    const connectedOut = graph.edges.some(edge => edge.from.startsWith(`${node.id}.`));
    if (hasOut && !connectedOut && !spec.sink) issue(errors, 'effect', { nodeId: node.id });
    if (!spec.outputs.length && !graph.edges.some(edge => edge.to.startsWith(`${node.id}.`))) issue(errors, 'action', { nodeId: node.id });
    if (node.type === 'source.camera@1' && !finite(Number(node.props.fps), 1, 10)) issue(errors, 'fps', { nodeId: node.id });
    if (node.type === 'detect.person@1' && !finite(Number(node.props.confidence), 0.1, 0.99)) issue(errors, 'props', { nodeId: node.id });
    if (node.type === 'geometry.line@1') {
      const line = node.props.line;
      const length = line?.start && line?.end ? Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y) : 0;
      if (!(length >= 0.01)) issue(errors, 'line', { nodeId: node.id });
    }
    if (node.type === 'geometry.zone@1') {
      const rect = node.props.rect;
      const polygon = Array.isArray(node.props.polygon) ? node.props.polygon : null;
      const degenerate = polygon ? polygonArea(polygon) < 1e-6 : !(rect && finite(rect.x, 0, 1) && finite(rect.y, 0, 1) && finite(rect.width, 0.001, 1) && finite(rect.height, 0.001, 1) && rect.x + rect.width <= 1 + 1e-9 && rect.y + rect.height <= 1 + 1e-9);
      if (degenerate) issue(errors, 'zone', { nodeId: node.id });
    }
    if (node.type === 'logic.dwell@1' && !finite(Number(node.props.thresholdSeconds), 1, 86400)) issue(errors, 'props', { nodeId: node.id });
  }
  for (const edge of graph.edges) {
    const diagnosis = connectDiagnosis({ ...graph, edges: graph.edges.filter(item => item.id !== edge.id) }, edge.from, edge.to);
    if (!diagnosis.ok && diagnosis.code !== 'single') issue(errors, diagnosis.code === 'cycle' ? 'cycle' : diagnosis.code === 'class' ? 'class' : 'type', { edgeId: edge.id });
  }
  const budget = estimateBudget(graph);
  if (budget.level === 'error') issue(errors, 'budget', { percent: budget.percent });
  if (budget.level === 'warn') warnings.push({ level: 'warning', code: 'budget', key: 'flow.warn.budget', percent: budget.percent });
  if (!graph.nodes.length) hints.push({ level: 'hint', code: 'drag', key: 'flow.hint.drag' });
  return { valid: errors.length === 0, errors, warnings, hints, budget };
}

function only(list) {
  return list.length === 1 ? list[0] : null;
}

function hasEdge(graph, from, to) {
  return graph.edges.some(edge => edge.from === from && edge.to === to);
}

export function recognizePipeline(graph) {
  if (!graph || graph.schema !== FLOW_SCHEMA) return null;
  const of = type => graph.nodes.filter(node => node.type === type);
  const cam = only(of('source.camera@1'));
  const person = only(of('detect.person@1'));
  const tracker = only(of('track.tracker@1'));
  const line = only(of('geometry.line@1'));
  const zone = only(of('geometry.zone@1'));
  const counter = only(of('logic.counter@1'));
  const dwell = only(of('logic.dwell@1'));
  const event = only(of('action.event@1'));
  const condition = of('logic.condition@1');
  if (!cam || !person || !tracker || !event || condition.length) return null;
  if (!hasEdge(graph, `${cam.id}.frame`, `${person.id}.frame`)) return null;
  if (!hasEdge(graph, `${person.id}.detections`, `${tracker.id}.detections`)) return null;
  const known = new Set([cam, person, tracker, line, zone, counter, dwell, event].filter(Boolean).map(node => node.id));
  if (graph.nodes.some(node => !known.has(node.id))) return null;
  if (line && !zone && !dwell && graph.nodes.length === (counter ? 6 : 5)) {
    const edges = counter ? 5 : 4;
    if (graph.edges.length === edges
      && hasEdge(graph, `${tracker.id}.tracks`, `${line.id}.tracks`)
      && hasEdge(graph, `${line.id}.events`, `${event.id}.events`)
      && (!counter || hasEdge(graph, `${line.id}.events`, `${counter.id}.events`))) {
      return { kind: 'line_crossing', cam, person, tracker, line, counter, event };
    }
  }
  if (zone && dwell && !line && !counter && graph.nodes.length === 6 && graph.edges.length === 5
    && hasEdge(graph, `${tracker.id}.tracks`, `${zone.id}.tracks`)
    && hasEdge(graph, `${zone.id}.events`, `${dwell.id}.events`)
    && hasEdge(graph, `${dwell.id}.events`, `${event.id}.events`)) {
    return { kind: 'dwell', cam, person, tracker, zone, dwell, event };
  }
  if (zone && !dwell && !line && !counter && graph.nodes.length === 5 && graph.edges.length === 4
    && hasEdge(graph, `${tracker.id}.tracks`, `${zone.id}.tracks`)
    && hasEdge(graph, `${zone.id}.events`, `${event.id}.events`)) {
    return { kind: 'presence', cam, person, tracker, zone, event };
  }
  return null;
}

function rectToPolygon(rect) {
  const { x, y, width, height } = rect;
  return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
}

function geometryOf(zone) {
  if (Array.isArray(zone)) return { polygon: clone(zone), rect: null };
  if (zone && typeof zone === 'object') return { polygon: rectToPolygon(zone), rect: clone(zone) };
  return { polygon: rectToPolygon(ZONE_RECT), rect: clone(ZONE_RECT) };
}

function place(type, props, x, y, id) {
  return { id, type, props: { ...blockDefaults(type), ...props }, ui: { x, y } };
}

export function migrateLegacy(project, { locale = 'pt-BR' } = {}) {
  const configuration = project?.configuration || {};
  const graph = createGraph({
    projectId: project?.id || '',
    name: project?.name || '',
    description: project?.description || '',
    locale,
    createdBy: 'migration',
  });
  graph.meta.execution = {
    ...clone(EXECUTION_DEFAULTS),
    model: configuration.model || EXECUTION_DEFAULTS.model,
    backendPolicy: configuration.backendPolicy || EXECUTION_DEFAULTS.backendPolicy,
    targetVariant: configuration.targetVariant || EXECUTION_DEFAULTS.targetVariant,
    minDurationSeconds: configuration.minDurationSeconds ?? EXECUTION_DEFAULTS.minDurationSeconds,
    line: clone(configuration.line || LINE_GEOM),
    direction: configuration.direction || 'both',
  };
  const zone = geometryOf(configuration.zone);
  const mode = configuration.mode === 'line_crossing' || configuration.mode === 'dwell' ? configuration.mode : 'presence';
  const ids = { cam: rid(), person: rid(), tracker: rid(), geometry: rid(), logic: rid(), counter: rid(), event: rid() };
  const camera = place('source.camera@1', {
    cameraId: project?.labCamera?.cameraId || '',
    fps: configuration.targetFps ?? 10,
    resolution: 640,
    privacyMask: false,
  }, 36, 40, ids.cam);
  const person = place('detect.person@1', {
    confidence: configuration.confidence ?? 0.65,
    classNames: Array.isArray(configuration.classNames) ? configuration.classNames.slice() : ['person'],
    roi: zone.rect ? clone(zone.rect) : null,
    zonePolygon: zone.polygon,
  }, 36, 170, ids.person);
  const tracker = place('track.tracker@1', { minFrames: configuration.minFrames ?? 3 }, 36, 300, ids.tracker);
  const event = place('action.event@1', {
    cooldownSeconds: configuration.cooldownSeconds ?? 30,
    eventType: 'info',
    severity: 'medium',
    snapshot: true,
  }, 320, 400, ids.event);
  graph.nodes.push(camera, person, tracker);
  const link = (from, to) => graph.edges.push({ id: rid(), from, to });
  link(`${ids.cam}.frame`, `${ids.person}.frame`);
  link(`${ids.person}.detections`, `${ids.tracker}.detections`);
  if (mode === 'line_crossing') {
    const line = place('geometry.line@1', {
      line: clone(configuration.line || LINE_GEOM),
      direction: configuration.direction || 'both',
    }, 36, 430, ids.geometry);
    const counter = place('logic.counter@1', { window: 'rolling' }, 36, 580, ids.counter);
    event.ui = { x: 320, y: 430 };
    graph.nodes.push(line, counter, event);
    link(`${ids.tracker}.tracks`, `${ids.geometry}.tracks`);
    link(`${ids.geometry}.events`, `${ids.event}.events`);
    link(`${ids.geometry}.events`, `${ids.counter}.events`);
  } else {
    const zoneNode = place('geometry.zone@1', { name: '', rect: zone.rect, polygon: zone.polygon }, 36, 430, ids.geometry);
    graph.nodes.push(zoneNode);
    link(`${ids.tracker}.tracks`, `${ids.geometry}.tracks`);
    if (mode === 'dwell') {
      const dwell = place('logic.dwell@1', { thresholdSeconds: configuration.minDurationSeconds ?? 30 }, 320, 430, ids.logic);
      event.ui = { x: 600, y: 430 };
      graph.nodes.push(dwell, event);
      link(`${ids.geometry}.events`, `${ids.logic}.events`);
      link(`${ids.logic}.events`, `${ids.event}.events`);
    } else {
      event.ui = { x: 320, y: 430 };
      graph.nodes.push(event);
      link(`${ids.geometry}.events`, `${ids.event}.events`);
    }
  }
  return graph;
}

function zoneValue(node, fallback) {
  if (node?.props?.rect && typeof node.props.rect.x === 'number') return clone(node.props.rect);
  if (Array.isArray(node?.props?.polygon) && node.props.polygon.length >= 3) return clone(node.props.polygon);
  if (node?.props?.roi && typeof node.props.roi.x === 'number') return clone(node.props.roi);
  if (Array.isArray(node?.props?.zonePolygon) && node.props.zonePolygon.length >= 3) return clone(node.props.zonePolygon);
  if (fallback && typeof fallback === 'object') return clone(fallback);
  return clone(ZONE_RECT);
}

export function configurationFromGraph(graph, project = {}) {
  const recognized = recognizePipeline(graph);
  if (!recognized) return null;
  const execution = { ...clone(EXECUTION_DEFAULTS), ...(graph.meta?.execution || {}) };
  const { kind, cam, person, tracker, line, zone, dwell, event } = recognized;
  const configuration = {
    confidence: Number(person.props.confidence),
    zone: kind === 'line_crossing' ? zoneValue(person, project.configuration?.zone) : zoneValue(zone, project.configuration?.zone),
    line: line ? clone(line.props.line) : clone(execution.line),
    classNames: Array.isArray(person.props.classNames) ? person.props.classNames.slice() : ['person'],
    minDurationSeconds: dwell ? Number(dwell.props.thresholdSeconds) : Number(execution.minDurationSeconds),
    cooldownSeconds: Number(event.props.cooldownSeconds),
    minFrames: Number(tracker.props.minFrames),
    targetFps: Number(cam.props.fps),
    direction: line ? line.props.direction : execution.direction,
    backendPolicy: execution.backendPolicy,
    targetVariant: execution.targetVariant,
    mode: kind,
    model: execution.model,
  };
  return configuration;
}

export function compileFlow(graph, project = {}, { deviceId = null, cameraId = null } = {}) {
  const recognized = recognizePipeline(graph);
  const validation = validateGraph(graph);
  if (!recognized) {
    return { supported: false, recognized: null, validation, configuration: null, device: null, rules: null, testPayload: null };
  }
  const configuration = configurationFromGraph(graph, project);
  const wrapped = { ...project, configuration };
  const spec = buildExecutableSpec(wrapped);
  const manifest = buildManifest(wrapped);
  const payloadCamera = cameraId || recognized.cam.props.cameraId || null;
  return {
    supported: validation.valid,
    recognized,
    validation,
    configuration,
    device: spec.device,
    rule: spec.rule,
    rules: manifest.rules,
    testPayload: buildTestPayload(wrapped, { deviceId, cameraId: payloadCamera || null }),
  };
}

export function flowTestGate(project) {
  const graph = project?.flow?.schema === FLOW_SCHEMA ? project.flow : migrateLegacy(project);
  const validation = validateGraph(graph);
  const recognized = recognizePipeline(graph);
  const errors = validation.errors.slice();
  if (!recognized) errors.push({ level: 'error', code: 'unsupported', key: 'flow.err.unsupported' });
  return { ok: errors.length === 0, errors, warnings: validation.warnings, graph, recognized, budget: validation.budget };
}

export function typeLabelKey(type) {
  const parsed = parseType(type);
  if (!parsed) return 'flow.type.Events';
  return `flow.type.${parsed.family}`;
}

export function portAnchor(node, direction, index) {
  const x = direction === 'out' ? node.ui.x + 248 : node.ui.x;
  const y = node.ui.y + 60 + index * 28;
  return { x, y };
}
