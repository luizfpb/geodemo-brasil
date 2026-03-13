/* ═══════════════════════════════════════════════════
   ui/districts.js — Limites distritais sob demanda
   ═══════════════════════════════════════════════════

   Carrega geometria de distritos por município quando
   o zoom é suficiente. Renderiza como overlay tracejado.
   Remove ao dar zoom out.

   Endpoint: /api/v3/malhas/municipios/{cod}?intrarregiao=distrito
*/

import L from 'leaflet';
import { getMap } from '../map.js';
import { dbg } from '../utils/debug.js';

/** Zoom mínimo para exibir distritos */
const MIN_ZOOM = 7;

/** Máximo de municípios carregando em paralelo */
const MAX_CONCURRENT = 6;

/** Cache de GeoJSON por município (null = já tentou e não tem distritos) */
const cache = new Map();

/** Layers ativos no mapa: Map<codMuni, L.GeoJSON> */
const activeLayers = new Map();

/** Municípios atualmente sendo baixados */
const loading = new Set();

/** Toggle global */
let enabled = false;

const $toggle = document.getElementById('districts-toggle');

export function init() {
  const map = getMap();

  $toggle.addEventListener('change', () => {
    enabled = $toggle.checked;
    if (enabled) {
      update();
    } else {
      removeAll();
    }
  });

  map.on('moveend', () => {
    if (enabled) update();
  });
}

/**
 * Verifica quais municípios estão visíveis e carrega/remove distritos.
 */
function update() {
  const map = getMap();
  const zoom = map.getZoom();

  if (zoom < MIN_ZOOM) {
    removeAll();
    return;
  }

  const bounds = map.getBounds();
  const visibleMunis = getVisibleMunis(bounds);

  // Remover municípios que saíram da tela
  activeLayers.forEach((layer, code) => {
    if (!visibleMunis.has(code)) {
      map.removeLayer(layer);
      activeLayers.delete(code);
    }
  });

  // Carregar municípios visíveis que ainda não estão no mapa
  let queued = 0;
  for (const code of visibleMunis) {
    if (activeLayers.has(code)) continue;
    if (loading.has(code)) continue;
    if (cache.has(code) && cache.get(code) === null) continue;

    if (queued >= MAX_CONCURRENT) break;
    loadMuni(code);
    queued++;
  }
}

/**
 * Retorna códigos de municípios visíveis no viewport.
 */
function getVisibleMunis(bounds) {
  const codes = new Set();
  const state = window.__geodemo_state;
  if (!state) return codes;

  state.muniLayers.forEach((layer, code) => {
    if (!code) return;
    try {
      if (bounds.intersects(layer.getBounds())) {
        codes.add(code);
      }
    } catch (_) {}
  });

  return codes;
}

/**
 * Baixa e renderiza distritos de um município.
 */
async function loadMuni(code) {
  loading.add(code);

  try {
    let geojson = cache.get(code);

    if (geojson === undefined) {
      const codMuni = code.length === 7 ? code : code.substring(0, 7);

      const url =
        `https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${codMuni}` +
        `?formato=application/json&qualidade=minima&intrarregiao=distrito`;

      const resp = await fetch(url);
      if (!resp.ok) {
        dbg(`Distritos ${codMuni}: HTTP ${resp.status}`, 'warn');
        cache.set(code, null);
        return;
      }

      const topo = await resp.json();
      const objKey = Object.keys(topo.objects)[0];
      if (!objKey) {
        cache.set(code, null);
        return;
      }

      geojson = window.topojson.feature(topo, topo.objects[objKey]);

      // Só exibir se o município tem 2+ distritos
      if (geojson.features.length < 2) {
        cache.set(code, null);
        return;
      }

      cache.set(code, geojson);
      dbg(`Distritos ${codMuni}: ${geojson.features.length} polígonos`);
    }

    if (!geojson) return;
    if (!enabled) return;
    if (activeLayers.has(code)) return;

    const layer = L.geoJSON(geojson, {
      style: () => ({
        weight: 1.4,
        color: '#f39c12',
        fillColor: 'transparent',
        fillOpacity: 0,
        opacity: 0.7,
        dashArray: '6 4',
      }),
      interactive: false,
      pane: 'districtBordersPane',
    });

    layer.addTo(getMap());
    activeLayers.set(code, layer);
  } catch (err) {
    dbg(`Distritos ${code} falhou: ${err.message}`, 'warn');
    cache.set(code, null);
  } finally {
    loading.delete(code);
  }
}

/**
 * Remove todos os layers de distritos do mapa.
 */
function removeAll() {
  const map = getMap();
  activeLayers.forEach((layer) => map.removeLayer(layer));
  activeLayers.clear();
}