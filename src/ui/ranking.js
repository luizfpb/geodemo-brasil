// ui/ranking.js -- sidebar com top 30 municipios pelo indicador ativo
//
// abre/fecha com botao toggle, atualiza quando tema ou subvar muda,
// click no item navega ate o municipio no mapa

import * as state from '../state.js';
import * as data from '../data.js';
import { getMap } from '../map.js';
import { fmtPop, fmtDec, fmtPercent, fmtCurrency, escapeHtml } from '../utils/format.js';

const MAX_ITEMS = 30;

let $panel = null;
let $list = null;
let $toggleBtn = null;
let visible = false;

export function init() {
  // criar o DOM do ranking (inserido no map-container)
  const container = document.getElementById('map-container');

  $toggleBtn = document.createElement('button');
  $toggleBtn.id = 'ranking-toggle';
  $toggleBtn.className = 'btn btn-ghost';
  $toggleBtn.textContent = 'Ranking';
  $toggleBtn.title = 'Top 30 municípios';
  container.appendChild($toggleBtn);

  $panel = document.createElement('div');
  $panel.id = 'ranking-panel';
  $panel.classList.add('hidden');
  $panel.innerHTML =
    '<div class="ranking-header">' +
    '<span class="ranking-title">Top 30</span>' +
    '<button class="btn-close" id="ranking-close">&times;</button>' +
    '</div>' +
    '<div id="ranking-list"></div>';
  container.appendChild($panel);

  $list = $panel.querySelector('#ranking-list');

  $toggleBtn.addEventListener('click', toggle);
  $panel.querySelector('#ranking-close').addEventListener('click', () => hide());

  state.on('theme:changed', refresh);
  state.on('subvar:changed', refresh);
  state.on('data:loaded', refresh);
}

function toggle() {
  visible ? hide() : show();
}

function show() {
  visible = true;
  $panel.classList.remove('hidden');
  $toggleBtn.classList.add('active');
  refresh();
}

function hide() {
  visible = false;
  $panel.classList.add('hidden');
  $toggleBtn.classList.remove('active');
}

function refresh() {
  if (!visible) return;

  const themeId = state.ui.activeTheme;
  const subvar = state.ui.activeSubvar;
  const theme = data.THEMES[themeId];

  // juntar todos os municipios com valor valido
  const entries = [];

  if (themeId === 'populacao') {
    state.muniData.forEach((d, code) => {
      if (d.pop != null) {
        entries.push({ code, name: d.name || code, value: d.pop });
      }
    });
  } else {
    state.muniData.forEach((d, code) => {
      const val = data.getThemeValue(code, themeId, subvar);
      if (val != null && !isNaN(val)) {
        entries.push({ code, name: d.name || code, value: val });
      }
    });
  }

  // descendente
  entries.sort((a, b) => b.value - a.value);
  const top = entries.slice(0, MAX_ITEMS);

  const label = subvar
    ? theme?.subvars?.find((s) => s.id === subvar)?.label || theme?.label || themeId
    : theme?.label || themeId;

  $panel.querySelector('.ranking-title').textContent = `Top ${top.length} — ${label}`;

  if (top.length === 0) {
    $list.innerHTML = '<div class="ranking-empty">Sem dados para este tema.</div>';
    return;
  }

  $list.innerHTML = top
    .map((item, i) => {
      const safeName = escapeHtml(truncate(item.name, 28));
      const formatted = escapeHtml(formatRankValue(item.value, themeId));
      return (
        `<div class="ranking-item" data-code="${escapeHtml(item.code)}">` +
        `<span class="ranking-pos">${i + 1}</span>` +
        `<span class="ranking-name" title="${escapeHtml(item.name)}">${safeName}</span>` +
        `<span class="ranking-val">${formatted}</span>` +
        `</div>`
      );
    })
    .join('');

  // click navega ate o municipio
  $list.querySelectorAll('.ranking-item').forEach((el) => {
    el.addEventListener('click', () => {
      const code = el.dataset.code;
      const layer = state.muniLayers.get(code);
      if (layer) {
        getMap()?.fitBounds(layer.getBounds(), { maxZoom: 10, padding: [40, 40] });
      }
    });
  });
}

function truncate(str, max) {
  if (!str || str.length <= max) return str || '';
  return str.slice(0, max - 1) + '\u2026';
}

function formatRankValue(value, themeId) {
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
    default:
      return fmtDec(value);
  }
}
