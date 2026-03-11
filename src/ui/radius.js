/* ═══════════════════════════════════════════════════
   ui/radius.js — Seleção por raio geográfico
   ═══════════════════════════════════════════════════ */

import L from 'leaflet';
import * as state from '../state.js';
import { getMap } from '../map.js';
import { dbg } from '../utils/debug.js';

const $btn = document.getElementById('radius-btn');
const $input = document.getElementById('radius-input');
const $clearRadius = document.getElementById('clear-radius-btn');
const $clearAll = document.getElementById('clear-all-btn');
const $banner = document.getElementById('radius-banner');

let radiusCircle = null;
let radiusMarker = null;

export function init() {
  // Toggle modo raio
  $btn.addEventListener('click', toggleMode);

  // Click no mapa fora de polígonos
  getMap().on('click', (e) => {
    if (!state.ui.radiusMode) return;
    dbg('Click no mapa (fora de polígono) no modo raio');
    executeRadius(e.latlng);
  });

  // Click em polígono delegado pelo layers.js
  state.on('radius:click', (latlng) => {
    if (!state.ui.radiusMode) return;
    dbg('Click em polígono no modo raio');
    executeRadius(latlng);
  });

  $clearRadius.addEventListener('click', clearVisuals);

  $clearAll.addEventListener('click', () => {
    clearVisuals();
    state.deselectAll();
    exitMode();
  });
}

function toggleMode() {
  state.ui.radiusMode = !state.ui.radiusMode;
  const active = state.ui.radiusMode;

  dbg(`Modo raio: ${active ? 'ATIVADO' : 'desativado'}`);
  $btn.textContent = active ? 'Cancelar' : 'Ativar raio';
  $btn.classList.toggle('active', active);
  $banner.classList.toggle('visible', active);
  getMap().getContainer().style.cursor = active ? 'crosshair' : '';

  state.emit('radius:mode', active);
}

function exitMode() {
  state.ui.radiusMode = false;
  $btn.textContent = 'Ativar raio';
  $btn.classList.remove('active');
  $banner.classList.remove('visible');
  getMap().getContainer().style.cursor = '';
}

function executeRadius(latlng) {
  const radiusKm = Math.max(1, Math.min(2000, parseFloat($input.value) || 100));
  dbg(`executeRadius: lat=${latlng.lat.toFixed(4)} lng=${latlng.lng.toFixed(4)} raio=${radiusKm}km`);

  exitMode();
  clearVisuals();

  // Verificar turf
  if (typeof window.turf === 'undefined' || typeof window.turf.circle !== 'function') {
    dbg('ERRO: turf.js não carregado ou turf.circle indisponível', 'error');
    return;
  }

  let circle;
  try {
    circle = window.turf.circle([latlng.lng, latlng.lat], radiusKm, {
      steps: 64,
      units: 'kilometers',
    });
  } catch (err) {
    dbg(`ERRO turf.circle: ${err.message}`, 'error');
    return;
  }

  const map = getMap();

  // Visual do raio
  radiusCircle = L.geoJSON(circle, {
    style: {
      weight: 2,
      color: '#e67e22',
      fillColor: '#e67e22',
      fillOpacity: 0.08,
      dashArray: '6 4',
    },
    interactive: false,
  }).addTo(map);

  radiusMarker = L.circleMarker(latlng, {
    radius: 6,
    color: '#e67e22',
    fillColor: '#fff',
    fillOpacity: 1,
    weight: 3,
    interactive: false,
  }).addTo(map);

  // Selecionar municípios que intersectam o círculo
  let count = 0;
  state.muniLayers.forEach((layer, code) => {
    try {
      if (window.turf.booleanIntersects(circle, layer.feature)) {
        state.select(code);
        count++;
      }
    } catch (_) {
      // Feature inválida, ignorar
    }
  });

  dbg(`Selecionados por raio: ${count} municípios`);
}

export function clearVisuals() {
  const map = getMap();
  if (radiusCircle) {
    map.removeLayer(radiusCircle);
    radiusCircle = null;
  }
  if (radiusMarker) {
    map.removeLayer(radiusMarker);
    radiusMarker = null;
  }
}
