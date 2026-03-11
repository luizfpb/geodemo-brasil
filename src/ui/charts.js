/* ═══════════════════════════════════════════════════
   ui/charts.js — Utilitários de gráficos (Chart.js)
   ═══════════════════════════════════════════════════

   Módulo de suporte para criação de gráficos reutilizáveis.
   Usado pelo painel de comparação e futuras features.
*/

let chartModulePromise = null;

/**
 * Carrega Chart.js sob demanda (lazy).
 * @returns {Promise<object>}
 */
export async function loadChartJS() {
  if (!chartModulePromise) {
    chartModulePromise = import('chart.js').then((mod) => {
      mod.Chart.register(
        mod.BarController,
        mod.BarElement,
        mod.LineController,
        mod.LineElement,
        mod.PointElement,
        mod.ArcElement,
        mod.DoughnutController,
        mod.CategoryScale,
        mod.LinearScale,
        mod.Tooltip,
        mod.Legend,
        mod.Filler
      );
      return mod;
    });
  }
  return chartModulePromise;
}

/**
 * Opções base para gráficos no tema escuro.
 * @param {object} [overrides]
 * @returns {object}
 */
export function darkThemeOptions(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#9498a8',
          font: { family: "'IBM Plex Sans', sans-serif", size: 11 },
        },
      },
      tooltip: {
        backgroundColor: '#181a22',
        borderColor: '#2a2d3a',
        borderWidth: 1,
        titleColor: '#e4e6ed',
        bodyColor: '#9498a8',
        titleFont: { family: "'IBM Plex Sans', sans-serif" },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
      },
    },
    scales: {
      x: {
        ticks: { color: '#5f6375', font: { size: 11 } },
        grid: { color: '#2a2d3a' },
      },
      y: {
        ticks: {
          color: '#5f6375',
          font: { family: "'JetBrains Mono', monospace", size: 11 },
        },
        grid: { color: '#2a2d3a' },
      },
    },
    ...overrides,
  };
}
