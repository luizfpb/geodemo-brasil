// ui/radius.js -- selecao por raio geografico com turf.js

import L from 'leaflet';
import circle from '@turf/circle';
import booleanIntersects from '@turf/boolean-intersects';
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
  $btn.addEventListener('click', toggleMode);

  // click direto no mapa (fora de poligono)
  getMap().on('click', (e) => {
    if (!state.ui.radiusMode) return;
    executeRadius(e.latlng);
  });

  // click em poligono, delegado pelo layers.js
  state.on('radius:click', (latlng) => {
    if (!state.ui.radiusMode) return;
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
  dbg(`Raio: lat=${latlng.lat.toFixed(4)} lng=${latlng.lng.toFixed(4)} r=${radiusKm}km`);

  exitMode();
  clearVisuals();

  let circ;
  try {
    circ = circle([latlng.lng, latlng.lat], radiusKm, {
      steps: 64,
      units: 'kilometers',
    });
  } catch (err) {
    dbg(`turf.circle: ${err.message}`, 'error');
    return;
  }

  const map = getMap();

  radiusCircle = L.geoJSON(circ, {
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

  // pre-filtro por bounding box antes do teste caro booleanIntersects
  const circleBounds = L.geoJSON(circ).getBounds();
  let count = 0;
  state.muniLayers.forEach((layer, code) => {
    try {
      if (!layer.getBounds().intersects(circleBounds)) return;
      if (booleanIntersects(circ, layer.feature)) {
        state.select(code);
        count++;
      }
    } catch (_) {}
  });

  dbg(`Selecionados por raio: ${count}`);
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
