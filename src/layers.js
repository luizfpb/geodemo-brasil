/* ═══════════════════════════════════════════════════
   layers.js — Renderização da malha, tooltips, eventos
   ═══════════════════════════════════════════════════ */

import L from 'leaflet';
import * as state from './state.js';
import * as data from './data.js';
import * as choropleth from './choropleth.js';
import { fmtPop, fmtDec, fmtPercent, fmtCurrency, fmtDec2, escapeHtml } from './utils/format.js';
import { dbg } from './utils/debug.js';

/**
 * Renderiza o GeoJSON municipal no mapa.
 * @param {L.Map} map
 * @param {GeoJSON.FeatureCollection} geojson
 */
export function renderMunicipalities(map, geojson) {
  L.geoJSON(geojson, {
    style: () => choropleth.getStyle(''),
    onEachFeature: (feature, layer) => {
      const code = feature.properties.codarea;
      if (!code) return;

      // Registrar layer e dados
      state.muniLayers.set(code, layer);
      const d = state.ensure(code);
      d.layer = layer;

      // Computar área em km² a partir da geometria (para densidade)
      try {
        if (typeof window.turf?.area === 'function') {
          const areaM2 = window.turf.area(feature);
          d.area = areaM2 / 1_000_000; // m² → km²
        }
      } catch (_) { /* geometria inválida, ignorar */ }

      // Tooltip
      layer.bindTooltip(() => buildTooltip(code), {
        className: 'muni-tooltip',
        sticky: true,
        direction: 'top',
        offset: [0, -8],
      });

      // Hover
      layer.on('mouseover', function () {
        if (!state.selection.has(code)) {
          this.setStyle(choropleth.getHoverStyle(code));
        }
      });

      layer.on('mouseout', function () {
        if (!state.selection.has(code)) {
          this.setStyle(choropleth.getStyle(code));
        }
      });

      // Click
      layer.on('click', (e) => {
        if (state.ui.radiusMode) {
          // Delegado ao módulo radius via evento custom
          state.emit('radius:click', e.latlng);
        } else {
          state.toggleSelect(code);
          layer.setStyle(choropleth.getStyle(code));
        }
      });
    },
  }).addTo(map);

  state.ui.meshLoaded = true;
  state.emit('mesh:loaded');
  dbg(`Malha renderizada. Layers: ${state.muniLayers.size}`);
}

/**
 * Renderiza bordas estaduais.
 * @param {L.Map} map
 * @param {GeoJSON.FeatureCollection} geojson
 */
export function renderStateBorders(map, geojson) {
  if (!geojson) return;

  L.geoJSON(geojson, {
    style: () => ({
      weight: 2.2,
      color: '#1a1a2e',
      fillColor: 'transparent',
      fillOpacity: 0,
      opacity: 0.8,
    }),
    interactive: false,
    pane: 'stateBordersPane',
  }).addTo(map);

  dbg(`Limites estaduais renderizados: ${geojson.features.length} UFs`);
}

/**
 * Constrói HTML do tooltip para um município.
 * @param {string} code
 * @returns {string}
 */
function buildTooltip(code) {
  const d = state.muniData.get(code);
  const name = d?.name ? escapeHtml(d.name) : `Cód. ${escapeHtml(code)}`;
  const themeId = state.ui.activeTheme;
  const subvar = state.ui.activeSubvar;

  let popLine = '';
  if (d?.pop != null) {
    popLine = `<div class="tooltip-line">Pop: ${fmtPop(d.pop)}</div>`;
  } else {
    popLine = `<div class="tooltip-line secondary">${state.ui.popLoaded ? 'sem dados' : 'carregando...'}</div>`;
  }

  // Linha extra com valor do tema ativo (se diferente de pop)
  let themeLine = '';
  if (themeId !== 'populacao') {
    const value = data.getThemeValue(code, themeId, subvar);
    if (value != null) {
      const theme = data.THEMES[themeId];
      const formatted = formatThemeValue(value, themeId);
      const label = subvar
        ? theme?.subvars?.find((s) => s.id === subvar)?.label || themeId
        : theme?.label || themeId;
      themeLine = `<div class="tooltip-line">${escapeHtml(label)}: ${escapeHtml(formatted)}</div>`;
    }
  }

  return `<span class="tooltip-name">${name}</span>${popLine}${themeLine}`;
}

/**
 * Formata valor de tema para exibição.
 * @param {number} value
 * @param {string} themeId
 * @returns {string}
 */
function formatThemeValue(value, themeId) {
  switch (themeId) {
    case 'populacao':
      return fmtPop(value);
    case 'densidade':
      return fmtDec(value) + ' hab/km²';
    case 'faixa-etaria':
    case 'educacao':
    case 'urbanizacao':
      return fmtPercent(value);
    case 'renda':
      return fmtCurrency(value);
    case 'idhm':
      return fmtDec2(value).replace('.', ',');
    default:
      return fmtDec(value);
  }
}

/**
 * Atualiza estilos de todos os municípios (após mudança de tema ou seleção).
 */
export function refreshStyles() {
  state.muniLayers.forEach((layer, code) => {
    layer.setStyle(choropleth.getStyle(code));
  });
}
