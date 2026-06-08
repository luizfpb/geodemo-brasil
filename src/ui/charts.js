// ui/charts.js -- helpers de Chart.js (lazy load, opcoes com tema dinamico)

let chartModulePromise = null;

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

// le as CSS vars do tema ativo para que o grafico respeite tema claro/escuro
export function buildChartOptions(overrides = {}) {
  const style = getComputedStyle(document.documentElement);
  const textMuted = style.getPropertyValue('--text-muted').trim() || '#5f6375';
  const border = style.getPropertyValue('--border').trim() || '#2a2d3a';
  const bgSecondary = style.getPropertyValue('--bg-secondary').trim() || '#181a22';
  const textPrimary = style.getPropertyValue('--text-primary').trim() || '#e4e6ed';

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: textMuted,
          font: { family: "'IBM Plex Sans', sans-serif", size: 11 },
        },
      },
      tooltip: {
        backgroundColor: bgSecondary,
        borderColor: border,
        borderWidth: 1,
        titleColor: textPrimary,
        bodyColor: textMuted,
        titleFont: { family: "'IBM Plex Sans', sans-serif" },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
      },
    },
    scales: {
      x: {
        ticks: { color: textMuted, font: { size: 11 } },
        grid: { color: border },
      },
      y: {
        ticks: {
          color: textMuted,
          font: { family: "'JetBrains Mono', monospace", size: 11 },
        },
        grid: { color: border },
      },
    },
    ...overrides,
  };
}
