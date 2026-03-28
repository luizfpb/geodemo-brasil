// ui/histogram.js -- histograma de distribuicao do tema ativo
//
// bins customizados por tema (log pra pop/renda/densidade, linear pra %).
// quando ha selecao, mostra distribuicao so dos municipios selecionados.
// hover num municipio no mapa destaca o bin correspondente.

import * as state from '../state.js';
import * as data from '../data.js';
import { loadChartJS } from './charts.js';
import { dbg } from '../utils/debug.js';

// breakpoints fixos por tema, escolhidos pra dar significado a cada barra
const THEME_BREAKPOINTS = {
  populacao: [0, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 5000000, Infinity],
  densidade: [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, Infinity],
  'faixa-etaria': [0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 100],
  educacao: [50, 60, 65, 70, 75, 80, 85, 90, 95, 100],
  renda: [0, 200, 400, 600, 800, 1000, 1500, 2000, 3000, 5000, Infinity],
  urbanizacao: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
};

let chart = null;
let $canvas = null;
let $title = null;
let currentBins = [];
let highlightedBin = -1;

export function init() {
  $canvas = document.getElementById('histogram-canvas');
  $title = document.getElementById('histogram-title');
  if (!$canvas) return;

  state.on('theme:changed', rebuild);
  state.on('subvar:changed', rebuild);
  state.on('data:loaded', rebuild);
  state.on('data:ready', () => setTimeout(rebuild, 100));
  state.on('selection:changed', rebuild);
  state.on('hover:municipality', onHover);
}

function rebuild() {
  const themeId = state.ui.activeTheme;
  const subvar = state.ui.activeSubvar;

  // decidir se mostra todos ou so os selecionados
  const hasSelection = state.selection.size > 0;
  const codes = hasSelection ? [...state.selection.keys()] : null;

  const values = collectValues(themeId, subvar, codes);

  if (values.length < 2) {
    hideChart();
    return;
  }

  const breakpoints = getBreakpoints(themeId, values);
  const bins = bucketize(values, breakpoints);
  currentBins = bins;
  highlightedBin = -1;

  updateTitle(themeId, hasSelection);
  renderChart(bins, themeId);
}

function collectValues(themeId, subvar, codes) {
  const values = [];

  if (codes) {
    // so municipios selecionados
    for (const code of codes) {
      const val = themeId === 'populacao'
        ? state.muniData.get(code)?.pop
        : data.getThemeValue(code, themeId, subvar);
      if (val != null && !isNaN(val)) values.push(val);
    }
  } else {
    // todos
    if (themeId === 'populacao') {
      state.muniData.forEach((d) => {
        if (d.pop != null) values.push(d.pop);
      });
    } else {
      const all = data.getAllThemeValues(themeId, subvar);
      values.push(...all);
    }
  }

  return values;
}

function getBreakpoints(themeId, values) {
  const predefined = THEME_BREAKPOINTS[themeId];
  if (predefined) return predefined;

  // fallback: gerar ~10 bins lineares
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min) / 10;
  const bp = [];
  for (let i = 0; i <= 10; i++) {
    bp.push(min + step * i);
  }
  bp[bp.length - 1] = Infinity;
  return bp;
}

function bucketize(values, breakpoints) {
  const bins = [];
  for (let i = 0; i < breakpoints.length - 1; i++) {
    bins.push({
      lo: breakpoints[i],
      hi: breakpoints[i + 1],
      count: 0,
      label: makeLabel(breakpoints[i], breakpoints[i + 1]),
    });
  }

  for (const v of values) {
    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      const inBin = (i === bins.length - 1)
        ? v >= b.lo
        : v >= b.lo && v < b.hi;
      if (inBin) {
        b.count++;
        break;
      }
    }
  }

  // remover bins vazios nas pontas (sem dados)
  while (bins.length > 1 && bins[0].count === 0) bins.shift();
  while (bins.length > 1 && bins[bins.length - 1].count === 0) bins.pop();

  return bins;
}

function makeLabel(lo, hi) {
  const f = (v) => {
    if (v === Infinity) return '+';
    if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 0) + 'k';
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(0);
  };

  if (hi === Infinity) return f(lo) + '+';
  return f(lo);
}

function findBin(value) {
  if (value == null || currentBins.length === 0) return -1;
  for (let i = 0; i < currentBins.length; i++) {
    const b = currentBins[i];
    const inBin = (i === currentBins.length - 1)
      ? value >= b.lo
      : value >= b.lo && value < b.hi;
    if (inBin) return i;
  }
  return -1;
}

function getBarColors(bins, highlighted) {
  const style = getComputedStyle(document.documentElement);
  const normal = style.getPropertyValue('--accent').trim() || '#4a90d9';
  const hl = '#e67e22';
  return bins.map((_, i) => (i === highlighted ? hl : normal));
}

function getBorderColors(bins, highlighted) {
  return bins.map((_, i) => (i === highlighted ? '#fff' : 'transparent'));
}

function updateTitle(themeId, hasSelection) {
  if (!$title) return;
  const theme = data.THEMES[themeId];
  const label = theme?.label || themeId;
  const scope = hasSelection ? ` (${state.selection.size} selecionados)` : ' (todos)';
  $title.textContent = `${label}${scope}`;
}

async function renderChart(bins, themeId) {
  const container = $canvas.parentElement;
  if (container) container.classList.remove('hidden');

  try {
    const ChartModule = await loadChartJS();
    const Chart = ChartModule.Chart;

    if (chart) {
      chart.destroy();
      chart = null;
    }

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-muted').trim() || '#5f6375';
    const gridColor = style.getPropertyValue('--border').trim() || '#2a2d3a';
    const bgSecondary = style.getPropertyValue('--bg-secondary').trim() || '#181a22';
    const textPrimary = style.getPropertyValue('--text-primary').trim() || '#e4e6ed';

    chart = new Chart($canvas, {
      type: 'bar',
      data: {
        labels: bins.map((b) => b.label),
        datasets: [
          {
            data: bins.map((b) => b.count),
            backgroundColor: getBarColors(bins, highlightedBin),
            borderColor: getBorderColors(bins, highlightedBin),
            borderWidth: bins.map((_, i) => (i === highlightedBin ? 2 : 0)),
            barPercentage: 1.0,
            categoryPercentage: 0.92,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: bgSecondary,
            borderColor: gridColor,
            borderWidth: 1,
            titleColor: textPrimary,
            bodyColor: textColor,
            bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
            callbacks: {
              title: (items) => {
                const i = items[0]?.dataIndex;
                if (i == null || !bins[i]) return '';
                const b = bins[i];
                const loStr = makeLabel(b.lo, b.hi);
                if (b.hi === Infinity) return `${loStr}`;
                return `${makeLabel(b.lo, 0)} — ${makeLabel(b.hi, 0)}`;
              },
              label: (item) => ` ${item.raw.toLocaleString('pt-BR')} municípios`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: textColor,
              font: { size: 9, family: "'JetBrains Mono', monospace" },
              maxRotation: 45,
            },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: textColor,
              font: { size: 10, family: "'JetBrains Mono', monospace" },
            },
            grid: { color: gridColor },
          },
        },
      },
    });
  } catch (err) {
    dbg(`Histograma falhou: ${err.message}`, 'warn');
  }
}

function onHover(code) {
  if (!chart || currentBins.length === 0) return;

  let newBin = -1;
  if (code) {
    const themeId = state.ui.activeTheme;
    const subvar = state.ui.activeSubvar;
    const value = themeId === 'populacao'
      ? state.muniData.get(code)?.pop
      : data.getThemeValue(code, themeId, subvar);
    newBin = findBin(value);
  }

  if (newBin === highlightedBin) return;
  highlightedBin = newBin;

  const ds = chart.data.datasets[0];
  ds.backgroundColor = getBarColors(currentBins, highlightedBin);
  ds.borderColor = getBorderColors(currentBins, highlightedBin);
  ds.borderWidth = currentBins.map((_, i) => (i === highlightedBin ? 2 : 0));
  chart.update('none');
}

function hideChart() {
  const container = $canvas?.parentElement;
  if (container) container.classList.add('hidden');
  if (chart) {
    chart.destroy();
    chart = null;
  }
  currentBins = [];
  if ($title) $title.textContent = '';
}
