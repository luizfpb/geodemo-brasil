/* ═══════════════════════════════════════════════════
   ui/stats.js — Painel de estatísticas agregadas
   ═══════════════════════════════════════════════════ */

import * as state from '../state.js';
import { THEMES } from '../data.js';
import { fmtPop } from '../utils/format.js';

const $count = document.getElementById('stat-count');
const $pop = document.getElementById('stat-pop');
const $theme = document.getElementById('stat-theme');

export function init() {
  state.on('selection:changed', update);
  state.on('theme:changed', updateThemeLabel);
  update();
}

function update() {
  const codes = Array.from(state.selection.keys());
  const { count, totalPop } = state.aggregate(codes);
  $count.textContent = fmtPop(count);
  $pop.textContent = fmtPop(totalPop);
}

function updateThemeLabel() {
  const theme = THEMES[state.ui.activeTheme];
  $theme.textContent = theme?.label || state.ui.activeTheme;
}
