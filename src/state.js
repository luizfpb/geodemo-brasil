/* ═══════════════════════════════════════════════════
   state.js — Estado global reativo com pub/sub
   ═══════════════════════════════════════════════════

   Centraliza o estado da aplicação. Módulos subscrevem
   a eventos e reagem a mudanças, sem dependências circulares.
*/

/** @typedef {'A'|'B'} GroupId */

/**
 * Eventos emitidos pelo state:
 * - selection:changed    — seleção de municípios mudou
 * - theme:changed        — camada temática mudou
 * - subvar:changed       — subvariável da camada mudou
 * - group:changed        — grupo ativo mudou
 * - radius:mode          — modo raio ativado/desativado
 * - data:loaded          — dataset carregado (payload: themeId)
 * - mesh:loaded          — malha municipal renderizada
 */

const listeners = new Map();

/**
 * Subscribir a um evento.
 * @param {string} event
 * @param {Function} fn
 * @returns {Function} unsubscribe
 */
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

/**
 * Emitir evento.
 * @param {string} event
 * @param {any} [payload]
 */
export function emit(event, payload) {
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[state] Erro no listener de "${event}":`, err);
    }
  });
}

// ─── Estado ───

/** Municípios selecionados por grupo: Map<código, GroupId> */
export const selection = new Map();

/** Dados de cada município: Map<código, MuniRecord> */
export const muniData = new Map();

/** Layers Leaflet por código */
export const muniLayers = new Map();

/** Datasets temáticos carregados: Set<themeId> */
export const loadedThemes = new Set();

/** Estado mutável da UI */
export const ui = {
  /** @type {string} Tema ativo */
  activeTheme: 'populacao',

  /** @type {string|null} Subvariável ativa */
  activeSubvar: null,

  /** @type {GroupId} Grupo ativo para novas seleções */
  activeGroup: 'A',

  /** @type {boolean} Modo raio */
  radiusMode: false,

  /** @type {boolean} Malha carregada */
  meshLoaded: false,

  /** @type {boolean} Nomes carregados */
  namesLoaded: false,

  /** @type {boolean} População carregada */
  popLoaded: false,
};

// ─── Helpers de seleção ───

/**
 * Retorna dados de um município, criando registro se necessário.
 * @param {string} code
 * @returns {object}
 */
export function ensure(code) {
  if (!muniData.has(code)) {
    muniData.set(code, { name: null, pop: null, uf: null, area: null });
  }
  return muniData.get(code);
}

/**
 * Seleciona um município no grupo ativo.
 * @param {string} code
 */
export function select(code) {
  if (selection.has(code)) return;
  selection.set(code, ui.activeGroup);
  emit('selection:changed');
}

/**
 * Remove um município da seleção.
 * @param {string} code
 */
export function deselect(code) {
  if (!selection.has(code)) return;
  selection.delete(code);
  emit('selection:changed');
}

/**
 * Toggle seleção de um município.
 * @param {string} code
 */
export function toggleSelect(code) {
  if (selection.has(code)) deselect(code);
  else select(code);
}

/**
 * Limpa toda a seleção.
 */
export function deselectAll() {
  selection.clear();
  emit('selection:changed');
}

/**
 * Retorna todos os códigos de um grupo.
 * @param {GroupId} group
 * @returns {string[]}
 */
export function getGroupCodes(group) {
  const codes = [];
  selection.forEach((g, code) => {
    if (g === group) codes.push(code);
  });
  return codes;
}

/**
 * Troca os grupos A e B.
 */
export function swapGroups() {
  selection.forEach((group, code) => {
    selection.set(code, group === 'A' ? 'B' : 'A');
  });
  emit('selection:changed');
}

/**
 * Calcula agregados de um conjunto de códigos.
 * @param {string[]} codes
 * @returns {{ count: number, totalPop: number }}
 */
export function aggregate(codes) {
  let totalPop = 0;
  for (const code of codes) {
    const d = muniData.get(code);
    if (d?.pop != null) totalPop += d.pop;
  }
  return { count: codes.length, totalPop };
}
