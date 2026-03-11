/* ═══════════════════════════════════════════════════
   choropleth.js — Escalas coropléticas e legenda
   ═══════════════════════════════════════════════════

   Gera funções de cor parametrizadas por tema.
   Suporta escalas sequenciais e divergentes.
*/

import L from 'leaflet';
import * as data from './data.js';
import * as state from './state.js';

// ─── Paletas por tema ───

const PALETTES = {
  populacao: {
    type: 'sequential',
    scale: 'log',
    colors: ['#fff7ec', '#fee8c8', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#990000'],
    domain: [800, 12_000_000],
    labels: ['< 1 mil', '10 mil', '100 mil', '1 mi', '10 mi+'],
  },
  densidade: {
    type: 'sequential',
    scale: 'log',
    colors: ['#f7fcf5', '#c7e9c0', '#74c476', '#31a354', '#006d2c'],
    domain: [0.5, 15_000],
    labels: ['< 1', '10', '100', '1 mil', '10 mil+'],
  },
  'faixa-etaria': {
    type: 'sequential',
    scale: 'linear',
    colors: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#084594'],
    domain: [0, 40],
    labels: ['0%', '10%', '20%', '30%', '40%+'],
  },
  educacao: {
    type: 'sequential',
    scale: 'linear',
    colors: ['#fff5f0', '#fcbba1', '#fb6a4a', '#cb181d', '#67000d'],
    domain: [50, 100],
    labels: ['50%', '60%', '70%', '80%', '90%+'],
  },
  renda: {
    type: 'sequential',
    scale: 'log',
    colors: ['#ffffd4', '#fed98e', '#fe9929', '#d95f0e', '#993404'],
    domain: [200, 5000],
    labels: ['R$ 200', 'R$ 500', 'R$ 1 mil', 'R$ 2 mil', 'R$ 5 mil+'],
  },
  idhm: {
    type: 'divergent',
    scale: 'linear',
    colors: ['#d73027', '#fc8d59', '#fee08b', '#d9ef8b', '#91cf60', '#1a9850'],
    domain: [0.4, 0.9],
    labels: ['0,400', '0,500', '0,600', '0,700', '0,800', '0,900'],
  },
  urbanizacao: {
    type: 'sequential',
    scale: 'linear',
    colors: ['#f7fcfd', '#ccece6', '#66c2a4', '#238b45', '#00441b'],
    domain: [0, 100],
    labels: ['0%', '25%', '50%', '75%', '100%'],
  },
};

// ─── Estilo sem dados ───

const STYLE_NO_DATA = {
  weight: 0.4,
  color: '#555',
  fillColor: '#b0b8c8',
  fillOpacity: 0.25,
};

const STYLE_SELECTED_A = {
  weight: 1.2,
  color: '#2980b9',
  fillColor: '#3498db',
  fillOpacity: 0.5,
};

const STYLE_SELECTED_B = {
  weight: 1.2,
  color: '#c0392b',
  fillColor: '#e74c3c',
  fillOpacity: 0.5,
};

// ─── Interpolação de cor ───

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToStr([r, g, b]) {
  return `rgb(${r},${g},${b})`;
}

function lerpColor(colors, t) {
  t = Math.max(0, Math.min(1, t));
  const n = colors.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1);
  const f = t * n - i;
  const a = hexToRgb(colors[i]);
  const b = hexToRgb(colors[i + 1]);
  return rgbToStr([
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ]);
}

/**
 * Normaliza um valor para [0,1] dado domínio e escala.
 */
function normalize(value, domain, scale) {
  const [min, max] = domain;
  if (scale === 'log') {
    const logMin = Math.log10(Math.max(min, 0.01));
    const logMax = Math.log10(max);
    const logVal = Math.log10(Math.max(value, min));
    return (logVal - logMin) / (logMax - logMin);
  }
  return (value - min) / (max - min);
}

// ─── API pública ───

/**
 * Retorna a cor para um valor no tema atual.
 * @param {number|null} value
 * @param {string} [themeId]
 * @returns {string|null} Cor CSS ou null se sem dados
 */
export function valueToColor(value, themeId) {
  themeId = themeId || state.ui.activeTheme;
  if (value == null || isNaN(value)) return null;

  const palette = PALETTES[themeId];
  if (!palette) return null;

  const t = normalize(value, palette.domain, palette.scale);
  return lerpColor(palette.colors, t);
}

/**
 * Retorna o estilo Leaflet para um município com base no tema ativo.
 * @param {string} code
 * @returns {object} Leaflet path style
 */
export function getStyle(code) {
  // Selecionado? Estilo do grupo
  if (state.selection.has(code)) {
    const group = state.selection.get(code);
    return group === 'B' ? STYLE_SELECTED_B : STYLE_SELECTED_A;
  }

  const themeId = state.ui.activeTheme;
  const subvar = state.ui.activeSubvar;
  const value = data.getThemeValue(code, themeId, subvar);
  const color = valueToColor(value, themeId);

  if (!color) return STYLE_NO_DATA;

  return {
    weight: 0.4,
    color: '#555',
    fillColor: color,
    fillOpacity: 0.7,
  };
}

/**
 * Retorna estilo de hover.
 * @param {string} code
 * @returns {object}
 */
export function getHoverStyle(code) {
  if (state.selection.has(code)) return getStyle(code);

  const themeId = state.ui.activeTheme;
  const subvar = state.ui.activeSubvar;
  const value = data.getThemeValue(code, themeId, subvar);
  const color = valueToColor(value, themeId);

  if (!color) {
    return { weight: 1.2, color: '#333', fillColor: '#d0d6e0', fillOpacity: 0.45 };
  }

  return { weight: 1.2, color: '#333', fillColor: color, fillOpacity: 0.9 };
}

/**
 * Retorna estilo para municípios selecionados.
 * @param {string} group
 * @returns {object}
 */
export function getSelectedStyle(group) {
  return group === 'B' ? STYLE_SELECTED_B : STYLE_SELECTED_A;
}

// ─── Legenda ───

let legendControl = null;

/**
 * Adiciona ou atualiza a legenda no mapa.
 * @param {L.Map} map
 * @param {string} [themeId]
 */
export function updateLegend(map, themeId) {
  themeId = themeId || state.ui.activeTheme;
  const palette = PALETTES[themeId];
  if (!palette) return;

  // Remove legenda anterior
  if (legendControl) {
    map.removeControl(legendControl);
    legendControl = null;
  }

  const theme = data.THEMES[themeId];
  const title = theme?.label || themeId;

  legendControl = L.control({ position: 'bottomleft' });
  legendControl.onAdd = function () {
    const div = L.DomUtil.create('div', 'pop-legend');

    let barHtml = '<div class="legend-bar">';
    for (const hex of palette.colors) {
      barHtml += `<div class="legend-stop" style="background:${hex}"></div>`;
    }
    barHtml += '</div>';

    const labels = palette.labels;
    const labelsHtml = `<div class="legend-labels"><span>${labels[0]}</span><span>${labels[labels.length - 1]}</span></div>`;

    div.innerHTML = `<div class="legend-title">${title}</div>${barHtml}${labelsHtml}`;
    return div;
  };
  legendControl.addTo(map);
}

/**
 * Reaplica estilos coropléticos a todos os municípios.
 */
export function reapplyAll() {
  state.muniLayers.forEach((layer, code) => {
    layer.setStyle(getStyle(code));
  });
}
