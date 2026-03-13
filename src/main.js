/* ═══════════════════════════════════════════════════
   main.js — Entry point da aplicação GeoDemoBrasil
   ═══════════════════════════════════════════════════

   Orquestra a inicialização de todos os módulos,
   carrega dados e coordena o fluxo de boot.
*/

// ─── Styles ───
import './styles/main.css';
import './styles/sidebar.css';
import './styles/map.css';
import './styles/components.css';

// ─── Módulos core ───
import { createMap, getMap } from './map.js';
import * as state from './state.js';
import * as data from './data.js';
import * as choropleth from './choropleth.js';
import { renderMunicipalities, renderStateBorders, refreshStyles } from './layers.js';
import { dbg } from './utils/debug.js';

// ─── Módulos UI ───
import * as sidebar from './ui/sidebar.js';
import * as search from './ui/search.js';
import * as stats from './ui/stats.js';
import * as selectedList from './ui/selected-list.js';
import * as radius from './ui/radius.js';
import * as themeSelector from './ui/theme-selector.js';
import * as groups from './ui/groups.js';
import * as comparison from './ui/comparison.js';
import * as exportModule from './ui/export.js';

// ─── DOM refs ───
const $overlay = document.getElementById('loading-overlay');
const $progressBar = document.getElementById('progress-bar');
const $loadingStatus = document.getElementById('loading-status');
const $loadingError = document.getElementById('loading-error');
const $dismissError = document.getElementById('dismiss-error');

// ─── Loading helpers ───

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

// ─── Boot ───

async function boot() {
  dbg('Boot iniciado');
  dbg(`topojson: ${typeof window.topojson !== 'undefined' ? 'OK' : 'FALHA'}`);
  dbg(`turf: ${typeof window.turf !== 'undefined' ? 'OK' : 'FALHA'}`);

  // Criar mapa
  const map = createMap();

  // Inicializar módulos UI (bindEvents)
  sidebar.init();
  search.init();
  stats.init();
  selectedList.init();
  radius.init();
  themeSelector.init();
  groups.init();
  comparison.init();
  exportModule.init();

  // Reagir a mudanças de seleção para atualizar estilos
  state.on('selection:changed', refreshStyles);

  // Dismiss overlay em erro
  $dismissError.addEventListener('click', () => {
    $overlay.classList.add('hidden');
  });

  try {
    // 1. Carregar malha municipal
    const geojson = await data.loadMesh(setProgress);
    renderMunicipalities(map, geojson);
    setProgress(60, 'Malha renderizada.');

    // 2. Carregar nomes, população, bordas e metadados em paralelo
    await Promise.all([
      data.loadNames(setProgress),
      data.loadPopulation(setProgress),
      data.loadStateBorders().then((borders) => renderStateBorders(map, borders)),
      data.loadMetadata(), // Descobre códigos de classificação para temas
    ]);

    // 3. Aplicar coroplético
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

// ─── Start ───
boot();
