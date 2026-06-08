// ui/comparison.js -- painel de comparacao side-by-side entre grupos A e B

import * as state from '../state.js';
import * as data from '../data.js';
import { fmtPop, fmtDec, fmtPercent, fmtCurrency, escapeHtml } from '../utils/format.js';
import { getCompareBtn } from './groups.js';
import { loadChartJS, buildChartOptions } from './charts.js';

const $panel = document.getElementById('comparison-panel');
const $content = document.getElementById('comparison-content');
const $charts = document.getElementById('comparison-charts');
const $close = document.getElementById('close-comparison');

export function init() {
  getCompareBtn().addEventListener('click', show);
  $close.addEventListener('click', hide);

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
  if (val == null) return '—';
  switch (themeId) {
    case 'densidade':
      return fmtDec(val) + ' hab/km²';
    case 'faixa-etaria':
    case 'educacao':
    case 'urbanizacao':
      return fmtPercent(val);
    case 'renda':
      return fmtCurrency(val);
    default:
      return fmtDec(val);
  }
}

async function renderCharts(a, b) {
  $charts.innerHTML =
    '<div class="comp-chart-wrap"><canvas id="comp-bar-chart"></canvas></div>';

  try {
    const ChartModule = await loadChartJS();

    const canvas = document.getElementById('comp-bar-chart');
    if (!canvas) return;

    const style = getComputedStyle(document.documentElement);
    const colorA = style.getPropertyValue('--color-group-a').trim() || '#3498db';
    const colorB = style.getPropertyValue('--color-group-b').trim() || '#e74c3c';

    new ChartModule.Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Municípios', 'Pop. total (mil)', 'Pop. média (mil)'],
        datasets: [
          {
            label: 'Grupo A',
            data: [a.count, a.totalPop / 1000, a.avgPop / 1000],
            backgroundColor: colorA + 'b3',
            borderColor: colorA,
            borderWidth: 1,
          },
          {
            label: 'Grupo B',
            data: [b.count, b.totalPop / 1000, b.avgPop / 1000],
            backgroundColor: colorB + 'b3',
            borderColor: colorB,
            borderWidth: 1,
          },
        ],
      },
      options: buildChartOptions(),
    });
  } catch (_) {
    $charts.innerHTML =
      '<p style="color:var(--text-muted);font-size:12px;padding:8px">Gráfico indisponível.</p>';
  }
}
