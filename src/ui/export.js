// ui/export.js -- exportacao de dados selecionados em CSV e XLSX

import * as state from '../state.js';
import * as data from '../data.js';
import { dbg } from '../utils/debug.js';

const $csvBtn = document.getElementById('export-csv-btn');
const $xlsxBtn = document.getElementById('export-xlsx-btn');

export function init() {
  $csvBtn.addEventListener('click', exportCSV);
  $xlsxBtn.addEventListener('click', exportXLSX);

  state.on('selection:changed', updateButtons);
  updateButtons();
}

function updateButtons() {
  const hasSelection = state.selection.size > 0;
  $csvBtn.disabled = !hasSelection;
  $xlsxBtn.disabled = !hasSelection;
}

function buildExportData() {
  const themeId = state.ui.activeTheme;
  const subvar = state.ui.activeSubvar;
  const theme = data.THEMES[themeId];

  const headers = ['Código IBGE', 'Município', 'UF', 'Grupo', 'População'];

  const hasThemeCol = themeId !== 'populacao' && theme?.loaded;
  if (hasThemeCol) {
    const label = subvar
      ? theme.subvars?.find((s) => s.id === subvar)?.label || theme.label
      : theme.label;
    headers.push(label);
  }

  const rows = [];
  state.selection.forEach((group, code) => {
    const d = state.muniData.get(code) || {};
    const row = [code, d.name || '', d.uf || '', group, d.pop ?? ''];

    if (hasThemeCol) {
      const val = data.getThemeValue(code, themeId, subvar);
      row.push(val ?? '');
    }

    rows.push(row);
  });

  rows.sort((a, b) => (Number(b[4]) || 0) - (Number(a[4]) || 0));

  return { headers, rows };
}

function exportCSV() {
  const { headers, rows } = buildExportData();

  const csvContent = [
    headers.map(escapeCSV).join(';'),
    ...rows.map((row) => row.map(escapeCSV).join(';')),
  ].join('\n');

  // BOM pro Excel reconhecer UTF-8
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, generateFilename('csv'));
  dbg(`CSV exportado: ${rows.length} linhas`);
}

async function exportXLSX() {
  try {
    const XLSX = await import('xlsx');
    const { headers, rows } = buildExportData();

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = headers.map((h, i) => {
      if (i === 0) return { wch: 12 };
      if (i === 1) return { wch: 35 };
      return { wch: 18 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Municípios');

    const meta = [
      ['GeoDemoBrasil — Exportação de dados'],
      ['Data', new Date().toLocaleDateString('pt-BR')],
      ['Tema ativo', data.THEMES[state.ui.activeTheme]?.label || state.ui.activeTheme],
      ['Municípios selecionados', String(state.selection.size)],
      ['Fonte', 'IBGE — Censo Demográfico 2022'],
    ];
    const wsMeta = XLSX.utils.aoa_to_sheet(meta);
    wsMeta['!cols'] = [{ wch: 30 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadados');

    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, generateFilename('xlsx'));
    dbg(`XLSX exportado: ${rows.length} linhas`);
  } catch (err) {
    dbg(`Erro XLSX: ${err.message}`, 'error');
    alert('Erro ao gerar Excel. Tente CSV.');
  }
}

function escapeCSV(value) {
  const str = String(value ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function generateFilename(ext) {
  const date = new Date().toISOString().slice(0, 10);
  return `geodemo-brasil_${date}.${ext}`;
}
