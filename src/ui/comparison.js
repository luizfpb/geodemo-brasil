/* ═══════════════════════════════════════════════════
   ui/comparison.js — Painel de comparação side-by-side
   ═══════════════════════════════════════════════════ */

import * as state from '../state.js';
import * as data from '../data.js';
import { fmtPop, fmtDec, fmtPercent, fmtCurrency, fmtDec2, escapeHtml } from '../utils/format.js';
import { getCompareBtn } from './groups.js';

const $panel = document.getElementById('comparison-panel');
const $content = document.getElementById('comparison-content');
const $charts = document.getElementById('comparison-charts');
const $close = document.getElementById('close-comparison');

export function init() {
  getCompareBtn().addEventListener('click', show);
  $close.addEventListener('click', hide);

  // ESC para fechar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$panel.classList.contains('hidden')) {
      hide();
    }
  });
}

function show() {
  const codesA = state.getGroupCodes('A');
  const codesB = state.getGroupCodes('B');

  if (codesA.length === 0 || codesB.length === 0) return;

  const aggA = buildAggregates(codesA);
  const aggB = buildAggregates(codesB);

  renderTable(aggA, aggB);
  renderCharts(aggA, aggB);

  $panel.classList.remove('hidden');
}

function hide() {
  $panel.classList.add('hidden');
}

function buildAggregates(codes) {
  let totalPop = 0;
  let popCount = 0;

  for (const code of codes) {
    const d = state.muniData.get(code);
    if (d?.pop != null) {
      totalPop += d.pop;
      popCount++;
    }
  }

  return {
    count: codes.length,
    totalPop,
    avgPop: popCount > 0 ? totalPop / popCount : 0,
    codes,
  };
}

function renderTable(a, b) {
  const rows = [
    ['Municípios', fmtPop(a.count), fmtPop(b.count)],
    ['População total', fmtPop(a.totalPop), fmtPop(b.totalPop)],
    ['Pop. média', fmtPop(Math.round(a.avgPop)), fmtPop(Math.round(b.avgPop))],
  ];

  // Adicionar dados do tema ativo se disponível
  const themeId = state.ui.activeTheme;
  const subvar = state.ui.activeSubvar;
  const theme = data.THEMES[themeId];

  if (themeId !== 'populacao' && theme?.loaded) {
    const avgA = computeThemeAvg(a.codes, themeId, subvar);
    const avgB = computeThemeAvg(b.codes, themeId, subvar);
    const label = subvar
      ? theme.subvars?.find((s) => s.id === subvar)?.label || theme.label
      : theme.label;

    rows.push([
      `${label} (média)`,
      formatVal(avgA, themeId),
      formatVal(avgB, themeId),
    ]);
  }

  $content.innerHTML =
    '<table class="comp-table">' +
    '<thead><tr><th>Métrica</th><th class="col-a">Grupo A</th><th class="col-b">Grupo B</th></tr></thead>' +
    '<tbody>' +
    rows
      .map(
        ([label, va, vb]) =>
          `<tr><td>${escapeHtml(label)}</td><td class="col-a">${escapeHtml(va)}</td><td class="col-b">${escapeHtml(vb)}</td></tr>`
      )
      .join('') +
    '</tbody></table>';
}

function computeThemeAvg(codes, themeId, subvar) {
  let sum = 0;
  let count = 0;
  for (const code of codes) {
    const val = data.getThemeValue(code, themeId, subvar);
    if (val != null) {
      sum += val;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}

function formatVal(val, themeId) {
  if (val == null) return '\u2014';
  switch (themeId) {
    case 'densidade':
      return fmtDec(val) + ' hab/km²';
    case 'faixa-etaria':
    case 'educacao':
    case 'urbanizacao':
      return fmtPercent(val);
    case 'renda':
      return fmtCurrency(val);
    case 'idhm':
      return fmtDec2(val);
    default:
      return fmtDec(val);
  }
}

function renderCharts(a, b) {
  // Chart.js será carregado dinamicamente quando necessário
  $charts.innerHTML =
    '<div class="comp-chart-wrap"><canvas id="comp-bar-chart"></canvas></div>';

  import('chart.js').then((ChartModule) => {
    const Chart = ChartModule.Chart || ChartModule.default;
    // Registrar componentes necessários
    ChartModule.Chart.register(
      ChartModule.BarController,
      ChartModule.BarElement,
      ChartModule.CategoryScale,
      ChartModule.LinearScale,
      ChartModule.Tooltip,
      ChartModule.Legend
    );

    const canvas = document.getElementById('comp-bar-chart');
    if (!canvas) return;

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Municípios', 'Pop. total (mil)', 'Pop. média (mil)'],
        datasets: [
          {
            label: 'Grupo A',
            data: [a.count, a.totalPop / 1000, a.avgPop / 1000],
            backgroundColor: 'rgba(52, 152, 219, 0.7)',
            borderColor: '#3498db',
            borderWidth: 1,
          },
          {
            label: 'Grupo B',
            data: [b.count, b.totalPop / 1000, b.avgPop / 1000],
            backgroundColor: 'rgba(231, 76, 60, 0.7)',
            borderColor: '#e74c3c',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#9498a8', font: { family: "'IBM Plex Sans', sans-serif", size: 11 } },
          },
          tooltip: {
            backgroundColor: '#181a22',
            borderColor: '#2a2d3a',
            borderWidth: 1,
            titleColor: '#e4e6ed',
            bodyColor: '#9498a8',
          },
        },
        scales: {
          x: {
            ticks: { color: '#5f6375', font: { size: 11 } },
            grid: { color: '#2a2d3a' },
          },
          y: {
            ticks: { color: '#5f6375', font: { family: "'JetBrains Mono', monospace", size: 11 } },
            grid: { color: '#2a2d3a' },
          },
        },
      },
    });
  }).catch(() => {
    $charts.innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:8px">Gráfico indisponível.</p>';
  });
}
