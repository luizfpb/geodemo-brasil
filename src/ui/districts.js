/* ═══════════════════════════════════════════════════
   ui/districts.js — Limites distritais sob demanda
   ═══════════════════════════════════════════════════

   Carrega geometria de distritos por UF quando o zoom
   é suficiente. Renderiza como overlay tracejado.
   Remove ao dar zoom out.
*/

import L from 'leaflet';
import { getMap } from '../map.js';
import { dbg } from '../utils/debug.js';

/** Zoom mínimo para exibir distritos */
const MIN_ZOOM = 7;

/** Cache de GeoJSON por UF (evita redownload) */
const cache = new Map();

/** Layers ativos no mapa: Map<uf, L.GeoJSON> */
const activeLayers = new Map();

/** UFs atualmente sendo baixadas (evita duplicação) */
const loading = new Set();

/** Toggle global */
let enabled = false;

/** Mapeamento código UF → sigla (para debug) */
const UF_CODES = [
  12, 27, 16, 13, 29, 23, 53, 32, 52, 21,
  51, 50, 31, 15, 25, 41, 26, 22, 33, 24,
  43, 11, 14, 42, 35, 28, 17,
];

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
 * Verifica quais UFs estão visíveis e carrega/remove distritos.
 */
function update() {
  const map = getMap();
  const zoom = map.getZoom();

  // Zoom baixo demais: remover tudo
  if (zoom < MIN_ZOOM) {
    removeAll();
    return;
  }

  const bounds = map.getBounds();
  const visibleUFs = getVisibleUFs(bounds);

  // Remover UFs que saíram da tela
  activeLayers.forEach((layer, uf) => {
    if (!visibleUFs.has(uf)) {
      map.removeLayer(layer);
      activeLayers.delete(uf);
    }
  });

  // Carregar UFs visíveis que ainda não estão no mapa
  for (const uf of visibleUFs) {
    if (!activeLayers.has(uf) && !loading.has(uf)) {
      loadUF(uf);
    }
  }
}

/**
 * Determina quais UFs têm bounding box intersectando a view atual.
 * Usa abordagem simples: checa quais códigos de UF (2 primeiros dígitos)
 * aparecem nos municípios visíveis no viewport.
 */
function getVisibleUFs(bounds) {
  const ufs = new Set();

  // Pegar UFs dos municípios cujo layer está dentro do bounds
  // (importar state aqui pra evitar dependência circular no topo)
  const state = window.__geodemo_state;
  if (!state) return ufs;

  state.muniLayers.forEach((layer, code) => {
    if (!code || code.length < 2) return;
    try {
      const layerBounds = layer.getBounds();
      if (bounds.intersects(layerBounds)) {
        ufs.add(code.substring(0, 2));
      }
    } catch (_) {
      // Layer sem bounds válido
    }
  });

  return ufs;
}

/**
 * Baixa e renderiza distritos de uma UF.
 */
async function loadUF(uf) {
  loading.add(uf);

  try {
    let geojson = cache.get(uf);

    if (!geojson) {
      const url =
        `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}` +
        `?formato=application/json&qualidade=minima&intrarregiao=distrito`;

      dbg(`Distritos: baixando UF ${uf}...`);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const topo = await resp.json();
      const objKey = Object.keys(topo.objects)[0];
      if (!objKey) throw new Error('TopoJSON vazio');

      geojson = window.topojson.feature(topo, topo.objects[objKey]);

      // Filtrar: só exibir se a UF tem mais de 1 distrito por município
      // (senão o distrito === município e a linha é redundante)
      const muniCount = new Map();
      for (const f of geojson.features) {
        const muniCode = f.properties.codarea?.substring(0, 7);
        if (muniCode) {
          muniCount.set(muniCode, (muniCount.get(muniCode) || 0) + 1);
        }
      }

      // Manter só features de municípios que têm 2+ distritos
      geojson = {
        type: 'FeatureCollection',
        features: geojson.features.filter((f) => {
          const mc = f.properties.codarea?.substring(0, 7);
          return mc && (muniCount.get(mc) || 0) > 1;
        }),
      };

      cache.set(uf, geojson);
      dbg(`Distritos UF ${uf}: ${geojson.features.length} polígonos (${muniCount.size} municípios com distritos)`);
    }

    // Se desativou enquanto baixava, não renderizar
    if (!enabled) return;

    // Se já tem layer (race condition), não duplicar
    if (activeLayers.has(uf)) return;

    if (geojson.features.length === 0) return;

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
    activeLayers.set(uf, layer);
  } catch (err) {
    dbg(`Distritos UF ${uf} falhou: ${err.message}`, 'warn');
  } finally {
    loading.delete(uf);
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