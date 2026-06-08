// main.js -- entry point, orquestra boot e permalink

import './styles/main.css';
import './styles/sidebar.css';
import './styles/map.css';
import './styles/components.css';

import { createMap } from './map.js';
import * as state from './state.js';
import * as data from './data.js';
import * as choropleth from './choropleth.js';
import { renderMunicipalities, renderStateBorders, refreshStyles } from './layers.js';
import { dbg } from './utils/debug.js';

import * as sidebar from './ui/sidebar.js';
import * as search from './ui/search.js';
import * as stats from './ui/stats.js';
import * as selectedList from './ui/selected-list.js';
import * as radius from './ui/radius.js';
import * as themeSelector from './ui/theme-selector.js';
import * as groups from './ui/groups.js';
import * as comparison from './ui/comparison.js';
import * as exportModule from './ui/export.js';
import * as ranking from './ui/ranking.js';
import * as histogram from './ui/histogram.js';
import * as stateFilter from './ui/state-filter.js';
import * as themeToggle from './ui/theme-toggle.js';

const $overlay = document.getElementById('loading-overlay');
const $progressBar = document.getElementById('progress-bar');
const $loadingStatus = document.getElementById('loading-status');
const $loadingError = document.getElementById('loading-error');
const $dismissError = document.getElementById('dismiss-error');

function setProgress(pct, text) {
  $progressBar.style.width = `${pct}%`;
  $progressBar.setAttribute('aria-valuenow', String(pct));
  $loadingStatus.textContent = text;
}

function showError(msg) {
  $loadingError.textContent = msg;
  $loadingError.classList.add('visible');
  $dismissError.classList.remove('hidden');
}

function hideOverlay() {
  setProgress(100, 'Pronto.');
  setTimeout(() => $overlay.classList.add('hidden'), 300);
}

// -- Permalink (URL hash) --
// formato: #t=renda&sv=renda_media&a=3100104,3550308&b=2304400

function encodeHash() {
  const parts = [`t=${state.ui.activeTheme}`];
  if (state.ui.activeSubvar) {
    parts.push(`sv=${state.ui.activeSubvar}`);
  }
  const codesA = state.getGroupCodes('A');
  const codesB = state.getGroupCodes('B');
  if (codesA.length > 0) parts.push(`a=${codesA.join(',')}`);
  if (codesB.length > 0) parts.push(`b=${codesB.join(',')}`);
  return '#' + parts.join('&');
}

function updateHash() {
  const hash = encodeHash();
  history.replaceState(null, '', hash);
}

function restoreFromHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const themeId = params.get('t');
  const subvar = params.get('sv');
  const aStr = params.get('a');
  const bStr = params.get('b');

  if (themeId && data.THEMES[themeId]) {
    const $sel = document.getElementById('theme-select');
    if ($sel) $sel.value = themeId;
    state.ui.activeTheme = themeId;
  }

  if (subvar) {
    state.ui.activeSubvar = subvar;
  }

  if (aStr) {
    for (const code of aStr.split(',')) {
      if (code.trim()) state.selection.set(code.trim(), 'A');
    }
  }
  if (bStr) {
    for (const code of bStr.split(',')) {
      if (code.trim()) state.selection.set(code.trim(), 'B');
    }
  }

  if (state.selection.size > 0) {
    state.emit('selection:changed');
  }
}

// -- Boot --

async function boot() {
  dbg('Boot iniciado');

  const map = createMap();

  // init de todos os modulos de UI
  themeToggle.init();
  sidebar.init();
  search.init();
  stats.init();
  selectedList.init();
  radius.init();
  themeSelector.init();
  groups.init();
  comparison.init();
  exportModule.init();
  ranking.init();
  histogram.init();
  stateFilter.init();

  state.on('selection:changed', refreshStyles);

  state.on('selection:changed', updateHash);
  state.on('theme:changed', updateHash);
  state.on('subvar:changed', updateHash);

  $dismissError.addEventListener('click', () => {
    $overlay.classList.add('hidden');
  });

  try {
    const geojson = await data.loadMesh(setProgress);
    renderMunicipalities(map, geojson);
    setProgress(60, 'Malha renderizada.');

    await Promise.all([
      data.loadNames(setProgress),
      data.loadPopulation(setProgress),
      data.loadStateBorders().then((borders) => renderStateBorders(map, borders)),
      data.loadMetadata(),
    ]);

    // todos os dados base carregados: nomes, populacao, areas, UFs
    // modulos que dependem de dados completos escutam este evento
    state.emit('data:ready');

    restoreFromHash();

    if (state.ui.activeTheme !== 'populacao') {
      await data.loadTheme(state.ui.activeTheme);
    }

    // sincroniza os selects de tema/subvar com o estado restaurado do hash
    themeSelector.syncUI();

    choropleth.reapplyAll();
    choropleth.updateLegend(map);

    hideOverlay();
    dbg('Boot completo');
  } catch (err) {
    console.error('Erro fatal:', err);
    dbg(`ERRO FATAL: ${err.message}`, 'error');
    setProgress(0, 'Erro.');
    showError(`Falha ao carregar dados. ${err.message}`);
  }
}

boot();
