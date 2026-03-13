/* ═══════════════════════════════════════════════════
   ui/districts.js — Limites distritais sob demanda
   ═══════════════════════════════════════════════════

   Carrega geometria de distritos por município quando
   o zoom é suficiente. Renderiza como overlay tracejado.

   Fluxo:
   1. API Localidades → lista de distritos do município
   2. API Malhas v2  → geometria de cada distrito

   Endpoints:
   - /api/v1/localidades/municipios/{cod}/distritos
   - /api/v2/malhas/{codDistrito}?formato=application/vnd.geo+json
*/

import L from 'leaflet';
import { getMap } from '../map.js';
import { dbg } from '../utils/debug.js';

/** Zoom mínimo para exibir distritos */
const MIN_ZOOM = 7;

/** Máximo de municípios carregando em paralelo */
const MAX_CONCURRENT = 4;

/**
 * Cache por município:
 *   undefined = nunca tentou
 *   null      = tentou, sem distritos (ou só 1)
 *   GeoJSON   = distritos prontos
 */
const cache = new Map();

/** Layers ativos no mapa: Map<codMuni, L.GeoJSON> */
const activeLayers = new Map();

/** Municípios sendo baixados agora */
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

  // Carregar municípios visíveis
  let queued = 0;
  for (const code of visibleMunis) {
    if (activeLayers.has(code)) continue;
    if (loading.has(code)) continue;

    // Já tentou e não tem distritos
    if (cache.has(code) && cache.get(code) === null) continue;

    // Já tem cache, renderizar direto
    if (cache.has(code) && cache.get(code) !== null) {
      renderLayer(code, cache.get(code));
      continue;
    }

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
 *
 * Passo 1: buscar lista de distritos via API Localidades
 * Passo 2: buscar geometria de cada distrito via API Malhas v2
 */
async function loadMuni(code) {
  loading.add(code);

  try {
    const codMuni = code.length >= 7 ? code.substring(0, 7) : code;

    // 1. Listar distritos do município
    const listUrl =
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codMuni}/distritos`;

    const listResp = await fetch(listUrl);
    if (!listResp.ok) {
      dbg(`Distritos lista ${codMuni}: HTTP ${listResp.status}`, 'warn');
      cache.set(code, null);
      return;
    }

    const distritos = await listResp.json();

    // Se tem só 1 distrito, não vale renderizar (é o próprio município)
    if (!Array.isArray(distritos) || distritos.length < 2) {
      cache.set(code, null);
      return;
    }

    // 2. Buscar geometria de cada distrito
    const features = [];

    for (const dist of distritos) {
      const distCode = String(dist.id);

      try {
        const geoUrl =
          `https://servicodados.ibge.gov.br/api/v2/malhas/${distCode}?formato=application/vnd.geo+json`;

        const geoResp = await fetch(geoUrl);
        if (!geoResp.ok) continue;

        const geojson = await geoResp.json();

        if (geojson.type === 'FeatureCollection' && geojson.features) {
          for (const f of geojson.features) {
            f.properties = f.properties || {};
            f.properties.nome = dist.nome;
            f.properties.codDistrito = distCode;
            features.push(f);
          }
        } else if (geojson.type === 'Feature') {
          geojson.properties = geojson.properties || {};
          geojson.properties.nome = dist.nome;
          geojson.properties.codDistrito = distCode;
          features.push(geojson);
        }
      } catch (_) {
        // Distrito individual falhou, continuar com os outros
      }
    }

    if (features.length < 2) {
      cache.set(code, null);
      return;
    }

    const fc = { type: 'FeatureCollection', features };
    cache.set(code, fc);
    dbg(`Distritos ${codMuni}: ${features.length} de ${distritos.length}`);

    if (!enabled) return;
    renderLayer(code, fc);
  } catch (err) {
    dbg(`Distritos ${code} falhou: ${err.message}`, 'warn');
    cache.set(code, null);
  } finally {
    loading.delete(code);
  }
}

/**
 * Renderiza um FeatureCollection de distritos no mapa.
 */
function renderLayer(code, geojson) {
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
}

/**
 * Remove todos os layers de distritos do mapa.
 */
function removeAll() {
  const map = getMap();
  activeLayers.forEach((layer) => map.removeLayer(layer));
  activeLayers.clear();
}