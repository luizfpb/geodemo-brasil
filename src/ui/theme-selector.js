/* ═══════════════════════════════════════════════════
   ui/theme-selector.js — Seletor de camada temática
   ═══════════════════════════════════════════════════
   
   Correção: NÃO muda state.ui.activeTheme até os dados
   carregarem. Isso evita que o hover descolora o mapa
   enquanto o tema está carregando.
*/

import * as state from '../state.js';
import * as data from '../data.js';
import * as choropleth from '../choropleth.js';
import { refreshStyles } from '../layers.js';
import { getMap } from '../map.js';
import { dbg } from '../utils/debug.js';

const $theme = document.getElementById('theme-select');
const $subvar = document.getElementById('theme-subvar');

export function init() {
  $theme.addEventListener('change', onThemeChange);
  $subvar.addEventListener('change', onSubvarChange);
}

async function onThemeChange() {
  const themeId = $theme.value;
  const theme = data.THEMES[themeId];
  if (!theme) return;

  dbg(`Tema selecionado: ${themeId}`);

  // Se já carregado, aplicar imediatamente
  if (theme.loaded) {
    applyTheme(themeId, theme);
    return;
  }

  // Mostrar loading (sem mudar o tema ativo — mapa continua com tema anterior)
  $theme.disabled = true;
  showSubvarMessage('Carregando dados do SIDRA...');

  const result = await data.loadTheme(themeId);
  $theme.disabled = false;

  if (result.success) {
    applyTheme(themeId, theme);
  } else {
    showSubvarMessage(result.message || 'Dados indisponíveis.');
    // Mapa continua exibindo o tema anterior (sem descolorir)
    dbg(`Tema ${themeId}: ${result.message}`, 'warn');
  }
}

function applyTheme(themeId, theme) {
  // SÓ AGORA muda o tema ativo
  state.ui.activeTheme = themeId;
  updateSubvars(theme);
  refreshStyles();
  choropleth.updateLegend(getMap(), themeId);
  state.emit('theme:changed', themeId);
}

function onSubvarChange() {
  state.ui.activeSubvar = $subvar.value || null;
  refreshStyles();
  choropleth.updateLegend(getMap());
  state.emit('subvar:changed', state.ui.activeSubvar);
}

function updateSubvars(theme) {
  if (!theme.subvars || theme.subvars.length === 0) {
    $subvar.classList.add('hidden');
    state.ui.activeSubvar = null;
    return;
  }
  $subvar.innerHTML = theme.subvars
    .map(sv => `<option value="${sv.id}">${sv.label}</option>`)
    .join('');
  $subvar.classList.remove('hidden');
  state.ui.activeSubvar = theme.subvars[0].id;
}

function showSubvarMessage(msg) {
  $subvar.innerHTML = `<option disabled selected>${msg}</option>`;
  $subvar.classList.remove('hidden');
}
