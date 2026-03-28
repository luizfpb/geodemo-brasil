// state.js -- estado global reativo com pub/sub
//
// Centraliza selecao, dados de municipios e UI.
// Modulos escutam eventos e reagem sem depender um do outro.

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[state] Erro no listener de "${event}":`, err);
    }
  });
}

// -- Estado --

// Map<codigoIBGE, 'A'|'B'>
export const selection = new Map();

// Map<codigoIBGE, { name, pop, uf, area, ... }>
export const muniData = new Map();

// Map<codigoIBGE, L.Layer>
export const muniLayers = new Map();

// temas ja carregados
export const loadedThemes = new Set();

export const ui = {
  activeTheme: 'populacao',
  activeSubvar: null,
  activeGroup: 'A',
  radiusMode: false,
  meshLoaded: false,
  namesLoaded: false,
  popLoaded: false,
  activeUFs: null,       // null = todos, Set<string> = UFs filtradas
  hoveredMuni: null,     // codigo do municipio em hover, ou null
};

// -- Helpers de selecao --

export function ensure(code) {
  if (!muniData.has(code)) {
    muniData.set(code, { name: null, pop: null, uf: null, area: null });
  }
  return muniData.get(code);
}

export function select(code) {
  if (selection.has(code)) return;
  selection.set(code, ui.activeGroup);
  emit('selection:changed');
}

export function deselect(code) {
  if (!selection.has(code)) return;
  selection.delete(code);
  emit('selection:changed');
}

export function toggleSelect(code) {
  if (selection.has(code)) deselect(code);
  else select(code);
}

export function deselectAll() {
  selection.clear();
  emit('selection:changed');
}

export function getGroupCodes(group) {
  const codes = [];
  selection.forEach((g, code) => {
    if (g === group) codes.push(code);
  });
  return codes;
}

export function swapGroups() {
  selection.forEach((group, code) => {
    selection.set(code, group === 'A' ? 'B' : 'A');
  });
  emit('selection:changed');
}

export function aggregate(codes) {
  let totalPop = 0;
  for (const code of codes) {
    const d = muniData.get(code);
    if (d?.pop != null) totalPop += d.pop;
  }
  return { count: codes.length, totalPop };
}

// util pra debug no console
window.__geodemo_state = { muniLayers };
