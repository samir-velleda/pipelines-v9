import { BLOCKS, BLOCK_ORDER, blockDefaults, connectDiagnosis, estimateBudget, portAnchor, typeLabelKey, validateGraph } from './flow.js';

const ICONS = {
  'source.camera@1': 'camera',
  'detect.person@1': 'person',
  'track.tracker@1': 'people',
  'geometry.zone@1': 'target',
  'geometry.line@1': 'crossing',
  'logic.counter@1': 'spark',
  'logic.dwell@1': 'clock',
  'logic.condition@1': 'settings',
  'action.event@1': 'bell',
};

const BLOCK_KEY = {
  'source.camera@1': 'camera',
  'detect.person@1': 'person',
  'track.tracker@1': 'tracker',
  'geometry.zone@1': 'zone',
  'geometry.line@1': 'line',
  'logic.counter@1': 'counter',
  'logic.dwell@1': 'dwell',
  'logic.condition@1': 'condition',
  'action.event@1': 'event',
};

const ENUM_PREFIX = {
  direction: 'dir.',
  window: 'flow.win.',
  operator: 'flow.op.',
  severity: 'flow.sev.',
  eventType: 'flow.ev.',
};

function noticeText(notice, t) {
  if (!notice?.key) return '';
  return t(notice.key, {
    out: notice.outType ? t(typeLabelKey(notice.outType)) : '',
    inn: notice.inType ? t(typeLabelKey(notice.inType)) : '',
    pct: Number.isFinite(notice.percent) ? String(Math.round(notice.percent)) : '',
  });
}

function wirePath(x1, y1, x2, y2) {
  const bend = Math.max(48, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

function optionLabel(key, value, t) {
  if (key === 'resolution') return `${value} px`;
  const prefix = ENUM_PREFIX[key];
  if (!prefix) return String(value);
  const label = t(prefix + value);
  return label === prefix + value ? String(value) : label;
}

function fieldControl(node, key, field, t, esc) {
  const value = node.props[key];
  const title = esc(t(field.titleKey));
  const unit = field.unitKey ? `<span>${esc(t(field.unitKey))}</span>` : '';
  if (field.type === 'classes') {
    const names = (Array.isArray(value) ? value : ['person']).map(id => {
      const label = t('class.' + id);
      return label === 'class.' + id ? id : label;
    });
    return `<label class="field"><span>${title}</span><input class="input" value="${esc(names.join(', '))}" readonly></label>`;
  }
  if (field.type === 'boolean') {
    return `<label class="fx-check"><input type="checkbox" data-prop="${esc(key)}" ${value ? 'checked' : ''}> <span>${title}</span></label>`;
  }
  if (field.type === 'enum') {
    const current = String(value ?? field.default);
    const options = field.values.map(item => `<option value="${esc(item)}" ${String(item) === current ? 'selected' : ''}>${esc(optionLabel(key, item, t))}</option>`).join('');
    return `<label class="field"><span>${title}</span><select class="select" data-prop="${esc(key)}">${options}</select></label>`;
  }
  if (field.type === 'string') {
    return `<label class="field"><span>${title}</span><input class="input" data-prop="${esc(key)}" value="${esc(value ?? '')}" maxlength="120"></label>`;
  }
  if (field.type === 'rect' || field.type === 'line') {
    const parts = field.type === 'rect'
      ? [['x', 'flow.prop.x', value?.x], ['y', 'flow.prop.y', value?.y], ['width', 'flow.prop.w', value?.width], ['height', 'flow.prop.h', value?.height]]
      : [['start.x', 'flow.start', value?.start?.x], ['start.y', 'flow.prop.y', value?.start?.y], ['end.x', 'flow.end', value?.end?.x], ['end.y', 'flow.prop.y', value?.end?.y]];
    const inputs = parts.map(([part, label, partValue]) => `<label class="field"><span>${esc(t(label))}</span><input class="input" type="number" step="0.01" min="0" max="1" data-prop="${esc(key)}" data-part="${esc(part)}" value="${esc(partValue ?? 0)}"></label>`).join('');
    return `<fieldset class="fx-geom"><legend>${title} ${unit}</legend><div class="fx-geom-grid">${inputs}</div></fieldset>`;
  }
  const step = field.type === 'integer' ? '1' : '0.01';
  return `<label class="field"><span>${title} ${unit}</span><input class="input" type="number" data-prop="${esc(key)}" min="${field.min ?? ''}" max="${field.max ?? ''}" step="${step}" value="${esc(value ?? field.default ?? '')}"></label>`;
}

function readFormProps(form, node) {
  const spec = BLOCKS[node.type];
  const props = {};
  for (const [key, field] of Object.entries(spec.props)) {
    if (field.type === 'classes') continue;
    if (field.type === 'boolean') {
      props[key] = Boolean(form.querySelector(`[data-prop="${key}"]`)?.checked);
      continue;
    }
    if (field.type === 'rect' || field.type === 'line') {
      const next = field.type === 'rect' ? { x: 0, y: 0, width: 0, height: 0 } : { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
      for (const input of form.querySelectorAll(`[data-prop="${key}"]`)) {
        const part = input.dataset.part;
        const number = Number(input.value);
        if (part === 'x') next.x = number;
        else if (part === 'y') next.y = number;
        else if (part === 'width') next.width = number;
        else if (part === 'height') next.height = number;
        else if (part === 'start.x') next.start.x = number;
        else if (part === 'start.y') next.start.y = number;
        else if (part === 'end.x') next.end.x = number;
        else if (part === 'end.y') next.end.y = number;
      }
      props[key] = next;
      continue;
    }
    const input = form.querySelector(`[data-prop="${key}"]`);
    if (!input) continue;
    if (field.type === 'integer' || field.type === 'number' || field.type === 'enum' && typeof field.default === 'number') props[key] = Number(input.value);
    else if (field.type === 'enum') props[key] = input.value;
    else props[key] = input.value;
  }
  return props;
}

export function flowEditorHtml({ graph, view, history, t, icon, esc }) {
  const validation = validateGraph(graph);
  const budget = validation.budget || estimateBudget(graph);
  const query = (view.query || '').trim().toLocaleLowerCase();
  const categories = ['source', 'detect', 'track', 'geometry', 'logic', 'action'];
  const palette = categories.map(category => {
    const items = BLOCK_ORDER.filter(type => BLOCKS[type].category === category).filter(type => {
      if (!query) return true;
      return `${t('flow.block.' + BLOCK_KEY[type])} ${t('flow.cat.' + category)}`.toLocaleLowerCase().includes(query);
    });
    if (!items.length) return '';
    return `<section class="fx-cat"><h3>${esc(t('flow.cat.' + category))}</h3>${items.map(type => `<button type="button" class="fx-palette-item" data-block="${esc(type)}"><span class="fx-palette-icon">${icon(ICONS[type], 18)}</span><span><strong>${esc(t('flow.block.' + BLOCK_KEY[type]))}</strong><small>${esc(t('flow.help.' + BLOCK_KEY[type]))}</small></span></button>`).join('')}</section>`;
  }).join('');
  const selected = graph.nodes.find(node => node.id === view.selectedId) || null;
  const wires = graph.edges.map(edge => {
    const from = edge.from.split('.');
    const to = edge.to.split('.');
    const source = graph.nodes.find(node => node.id === from[0]);
    const target = graph.nodes.find(node => node.id === to[0]);
    if (!source || !target) return '';
    const sourceIndex = BLOCKS[source.type].outputs.findIndex(port => port.id === from[1]);
    const targetIndex = BLOCKS[target.type].inputs.findIndex(port => port.id === to[1]);
    const a = portAnchor(source, 'out', Math.max(0, sourceIndex));
    const b = portAnchor(target, 'in', Math.max(0, targetIndex));
    return `<path data-action="flow-disconnect" data-edge="${esc(edge.id)}" d="${wirePath(a.x, a.y, b.x, b.y)}"/>`;
  }).join('');
  const nodes = graph.nodes.map(node => {
    const spec = BLOCKS[node.type];
    const key = BLOCK_KEY[node.type];
    const inputs = spec.inputs.map((port, index) => `<button type="button" class="fx-port in" data-dir="in" data-node="${esc(node.id)}" data-port="${esc(port.id)}" style="top:${46 + index * 28}px"><i></i><span>${esc(t('flow.port.' + port.id))}</span></button>`).join('');
    const outputs = spec.outputs.map((port, index) => `<button type="button" class="fx-port out" data-dir="out" data-node="${esc(node.id)}" data-port="${esc(port.id)}" style="top:${46 + index * 28}px"><span>${esc(t('flow.port.' + port.id))}</span><i></i></button>`).join('');
    const hot = budget.hotNodeIds?.includes(node.id) ? ' is-hot' : '';
    const on = node.id === view.selectedId ? ' is-selected' : '';
    const rows = Math.max(spec.inputs.length, spec.outputs.length, 1);
    return `<article class="fx-node${on}${hot}" data-node="${esc(node.id)}" style="left:${node.ui.x}px;top:${node.ui.y}px;min-height:${46 + rows * 28 + 12}px"><header><span class="fx-node-mark">${icon(ICONS[node.type], 18)}</span><div><strong>${esc(t('flow.block.' + key))}</strong><small>${esc(t('flow.cat.' + spec.category))}</small></div></header>${inputs}${outputs}</article>`;
  }).join('');
  const issues = [...validation.errors, ...validation.warnings];
  const detail = issues.slice(0, 2).map(item => esc(t(item.key, { pct: Number.isFinite(item.percent) ? String(Math.round(item.percent)) : '' }))).join(' · ');
  const props = selected
    ? `<h3>${esc(t('flow.block.' + BLOCK_KEY[selected.type]))}</h3><p class="fx-help">${esc(t('flow.help.' + BLOCK_KEY[selected.type]))}</p><form id="fx-props" data-node="${esc(selected.id)}">${Object.entries(BLOCKS[selected.type].props).map(([key, field]) => fieldControl(selected, key, field, t, esc)).join('')}${selected.type === 'source.camera@1' ? `<p class="help">${esc(t('flow.resolutionHint'))}</p>` : ''}<div class="fx-prop-actions"><button type="button" class="btn secondary" data-action="flow-restore" data-node="${esc(selected.id)}">${esc(t('flow.restore'))}</button><button type="button" class="btn danger" data-action="flow-delete" data-node="${esc(selected.id)}">${esc(t('flow.delete'))}</button></div></form>`
    : `<div class="fx-empty-props"><h3>${esc(t('flow.props'))}</h3><p>${esc(t('flow.emptyProps'))}</p></div>`;
  const canUndo = history?.undo?.length ? '' : 'disabled';
  const canRedo = history?.redo?.length ? '' : 'disabled';
  const tone = budget.level === 'error' || validation.errors.length ? 'over' : budget.level === 'warn' ? 'warn' : 'ok';
  return `<div class="fx-editor" id="fx-editor">
    <div class="fx-toolbar"><div><span class="section-eyebrow">${esc(t('flow.eyebrow'))}</span><h2>${esc(t('flow.title'))}</h2></div><div class="fx-toolbar-actions"><button type="button" class="btn secondary" data-action="flow-undo" ${canUndo}>${icon('undo', 16)} ${esc(t('flow.undo'))}</button><button type="button" class="btn secondary" data-action="flow-redo" ${canRedo}>${icon('redo', 16)} ${esc(t('flow.redo'))}</button><button type="button" class="btn ghost" data-action="flow-zoom-out">${esc(t('flow.zoomOut'))}</button><button type="button" class="btn ghost" data-action="flow-zoom-in">${esc(t('flow.zoomIn'))}</button><button type="button" class="btn ghost" data-action="flow-fit">${esc(t('flow.fit'))}</button></div></div>
    <p class="fx-intro">${esc(t('flow.intro'))}</p>
    <div class="fx-body">
      <aside class="fx-palette" aria-label="${esc(t('flow.palette'))}"><label class="search-field">${icon('search', 16)}<input class="input" id="fx-search" type="search" placeholder="${esc(t('flow.searchPh'))}" value="${esc(view.query || '')}" aria-label="${esc(t('flow.searchPh'))}"></label><div id="fx-palette-list">${palette || `<p class="help">${esc(t('flow.hint.drag'))}</p>`}</div></aside>
      <div class="fx-stage" id="fx-stage" role="application" aria-label="${esc(t('flow.canvasLabel'))}" style="--fx-pan-x:${view.panX}px;--fx-pan-y:${view.panY}px;--fx-zoom:${view.zoom}"><div class="fx-world" id="fx-world" style="transform:translate(${view.panX}px,${view.panY}px) scale(${view.zoom})"><svg class="fx-wires" aria-hidden="true">${wires}<path id="fx-draft" hidden/></svg>${nodes}</div>${view.notice ? `<p class="fx-notice" role="alert">${esc(noticeText(view.notice, t))}</p>` : ''}</div>
      <aside class="fx-inspector" aria-label="${esc(t('flow.props'))}">${props}</aside>
    </div>
    <footer class="fx-bar" id="fx-bar" data-tone="${tone}" role="status"><div><strong id="fx-budget-text">${esc(t('flow.budget', { pct: Math.round(budget.percent), fps: budget.fps || 0, max: budget.fpsMax }))}</strong><span id="fx-budget-device">${esc(t('flow.budgetOf'))}</span></div><p id="fx-budget-detail">${detail}</p></footer>
  </div>`;
}

function worldPoint(stage, view, clientX, clientY) {
  const rect = stage.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.panX) / view.zoom,
    y: (clientY - rect.top - view.panY) / view.zoom,
  };
}

function snap(value) {
  return Math.round(value / 16) * 16;
}

function freePosition(graph) {
  const overlaps = (x, y) => graph.nodes.some(node => Math.abs(node.ui.x - x) < 250 && Math.abs(node.ui.y - y) < 130);
  for (let y = 48; y < 1600; y += 150) {
    for (let x = 48; x < 1600; x += 280) {
      if (!overlaps(x, y)) return { x, y };
    }
  }
  return { x: 48, y: 48 };
}

export function paintFlowBudget(graph, t) {
  const validation = validateGraph(graph);
  const budget = validation.budget;
  const bar = document.getElementById('fx-bar');
  const text = document.getElementById('fx-budget-text');
  const detail = document.getElementById('fx-budget-detail');
  if (!bar || !text || !budget) return;
  const tone = budget.level === 'error' || validation.errors.length ? 'over' : budget.level === 'warn' ? 'warn' : 'ok';
  bar.dataset.tone = tone;
  text.textContent = t('flow.budget', { pct: Math.round(budget.percent), fps: budget.fps || 0, max: budget.fpsMax });
  const issues = [...validation.errors, ...validation.warnings];
  if (detail) detail.textContent = issues.slice(0, 2).map(item => t(item.key, { pct: Number.isFinite(item.percent) ? String(Math.round(item.percent)) : '' })).join(' · ');
  document.querySelectorAll('.fx-node').forEach(node => node.classList.toggle('is-hot', budget.hotNodeIds.includes(node.dataset.node)));
}

export function mountFlowEditor(ctx) {
  const root = document.getElementById('fx-editor');
  const stage = document.getElementById('fx-stage');
  if (!root || !stage) return null;
  ctx.abort?.abort();
  const abort = new AbortController();
  const { signal } = abort;
  const view = ctx.view();
  let snapshot = null;

  const search = document.getElementById('fx-search');
  search?.addEventListener('input', () => {
    view.query = search.value;
    const list = document.getElementById('fx-palette-list');
    if (!list) return;
    const holder = document.createElement('div');
    holder.innerHTML = flowEditorHtml({ graph: ctx.graph(), view, history: ctx.history(), t: ctx.t, icon: ctx.icon, esc: ctx.esc });
    const next = holder.querySelector('#fx-palette-list');
    if (next) list.innerHTML = next.innerHTML;
  }, { signal });

  document.getElementById('fx-palette-list')?.addEventListener('pointerdown', event => {
    const item = event.target.closest?.('.fx-palette-item');
    if (!item || event.button !== 0) return;
    const startDrag = () => {
      if (event.button !== 0) return;
      const startX = event.clientX;
      const startY = event.clientY;
      let dragging = false;
      let ghost = null;
      const move = ev => {
        if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        dragging = true;
        if (!ghost) {
          ghost = document.createElement('div');
          ghost.className = 'fx-ghost';
          ghost.textContent = item.querySelector('strong')?.textContent || '';
          document.body.append(ghost);
        }
        ghost.style.left = `${ev.clientX + 12}px`;
        ghost.style.top = `${ev.clientY + 12}px`;
      };
      const up = ev => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        ghost?.remove();
        const point = worldPoint(stage, view, ev.clientX, ev.clientY);
        const rect = stage.getBoundingClientRect();
        const inside = ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom;
        const position = dragging && inside
          ? { x: snap(point.x), y: snap(point.y) }
          : freePosition(ctx.graph());
        if (!dragging && !inside) {
          ctx.commit({ op: 'add_node', id: ctx.uid(), type: item.dataset.block, props: blockDefaults(item.dataset.block), position });
          return;
        }
        if (dragging && !inside) return;
        ctx.commit({ op: 'add_node', id: ctx.uid(), type: item.dataset.block, props: blockDefaults(item.dataset.block), position });
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    };
    startDrag();
  }, { signal });

  stage.addEventListener('pointerdown', event => {
    const port = event.target.closest?.('.fx-port');
    const node = event.target.closest?.('.fx-node');
    if (port?.dataset.dir === 'out') {
      event.preventDefault();
      const from = `${port.dataset.node}.${port.dataset.port}`;
      const draft = document.getElementById('fx-draft');
      const move = ev => {
        const point = worldPoint(stage, view, ev.clientX, ev.clientY);
        const source = ctx.graph().nodes.find(item => item.id === port.dataset.node);
        const index = BLOCKS[source.type].outputs.findIndex(item => item.id === port.dataset.port);
        const anchor = portAnchor(source, 'out', Math.max(0, index));
        if (draft) {
          draft.hidden = false;
          draft.setAttribute('d', wirePath(anchor.x, anchor.y, point.x, point.y));
        }
        document.querySelectorAll('.fx-port.in').forEach(input => {
          const diagnosis = connectDiagnosis(ctx.graph(), from, `${input.dataset.node}.${input.dataset.port}`);
          input.classList.toggle('is-dim', !diagnosis.ok);
          input.classList.toggle('is-ready', diagnosis.ok);
        });
      };
      const up = ev => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        if (draft) draft.hidden = true;
        document.querySelectorAll('.fx-port.in').forEach(input => input.classList.remove('is-dim', 'is-ready'));
        const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.fx-port.in');
        if (!hit) return;
        const result = ctx.commit({ op: 'connect', from, to: `${hit.dataset.node}.${hit.dataset.port}` });
        if (result?.error) ctx.showNotice(result.error);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      return;
    }
    if (port) return;
    if (node) {
      const id = node.dataset.node;
      const origin = ctx.graph().nodes.find(item => item.id === id);
      const start = worldPoint(stage, view, event.clientX, event.clientY);
      const base = { x: origin.ui.x, y: origin.ui.y };
      let moved = false;
      let x = base.x;
      let y = base.y;
      const move = ev => {
        const point = worldPoint(stage, view, ev.clientX, ev.clientY);
        x = snap(base.x + point.x - start.x);
        y = snap(base.y + point.y - start.y);
        if (x !== base.x || y !== base.y) moved = true;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        view.selectedId = id;
        if (moved) ctx.commit({ op: 'update_node', id, position: { x, y } });
        else ctx.refresh();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      return;
    }
    if (event.target.closest?.('[data-action="flow-disconnect"]')) return;
    const start = { x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY };
    const move = ev => {
      view.panX = start.panX + ev.clientX - start.x;
      view.panY = start.panY + ev.clientY - start.y;
      const world = document.getElementById('fx-world');
      if (world) world.style.transform = `translate(${view.panX}px,${view.panY}px) scale(${view.zoom})`;
      stage.style.setProperty('--fx-pan-x', `${view.panX}px`);
      stage.style.setProperty('--fx-pan-y', `${view.panY}px`);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }, { signal });

  stage.addEventListener('wheel', event => {
    event.preventDefault();
    const before = worldPoint(stage, view, event.clientX, event.clientY);
    const next = Math.min(1.8, Math.max(0.45, view.zoom * (event.deltaY > 0 ? 0.92 : 1.08)));
    view.zoom = next;
    const rect = stage.getBoundingClientRect();
    view.panX = event.clientX - rect.left - before.x * view.zoom;
    view.panY = event.clientY - rect.top - before.y * view.zoom;
    const world = document.getElementById('fx-world');
    if (world) world.style.transform = `translate(${view.panX}px,${view.panY}px) scale(${view.zoom})`;
    stage.style.setProperty('--fx-zoom', String(view.zoom));
    stage.style.setProperty('--fx-pan-x', `${view.panX}px`);
    stage.style.setProperty('--fx-pan-y', `${view.panY}px`);
  }, { signal, passive: false });

  const form = document.getElementById('fx-props');
  form?.addEventListener('focusin', () => {
    const node = ctx.graph().nodes.find(item => item.id === form.dataset.node);
    snapshot = node ? structuredClone(node.props) : null;
  }, { signal });
  form?.addEventListener('input', () => {
    const graph = ctx.graph();
    const node = graph.nodes.find(item => item.id === form.dataset.node);
    if (!node) return;
    Object.assign(node.props, readFormProps(form, node));
    paintFlowBudget(graph, ctx.t);
  }, { signal });
  form?.addEventListener('change', () => {
    const node = ctx.graph().nodes.find(item => item.id === form.dataset.node);
    if (!node || !snapshot) return;
    const after = readFormProps(form, node);
    const before = snapshot;
    snapshot = structuredClone({ ...node.props, ...after });
    node.props = before;
    ctx.commit({ op: 'update_node', id: node.id, props: after });
  }, { signal });

  return abort;
}

export { blockDefaults };
