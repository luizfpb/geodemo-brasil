/* ═══════════════════════════════════════════════════
   ui/search.js — Busca de municípios com autocomplete
   ═══════════════════════════════════════════════════ */

import * as state from '../state.js';
import { getMap } from '../map.js';
import { fmtPop, escapeHtml } from '../utils/format.js';

const input = document.getElementById('search-input');
const results = document.getElementById('search-results');

let debounceTimer = null;
let activeIndex = -1;
let currentResults = [];

export function init() {
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, 180);
  });

  input.addEventListener('focus', () => {
    if (input.value.length >= 2) doSearch();
  });

  // Navegação por teclado
  input.addEventListener('keydown', (e) => {
    if (!results.classList.contains('visible')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
      updateActiveItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, -1);
      updateActiveItem();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && currentResults[activeIndex]) {
        selectResult(currentResults[activeIndex].code);
      }
    } else if (e.key === 'Escape') {
      hide();
    }
  });

  // Fechar ao clicar fora
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) hide();
  });
}

function doSearch() {
  const query = sanitizeQuery(input.value);
  if (query.length < 2) {
    hide();
    return;
  }

  const qLower = query.toLowerCase();
  currentResults = [];

  state.muniData.forEach((d, code) => {
    if (d.name && d.name.toLowerCase().includes(qLower)) {
      currentResults.push({ code, name: d.name, pop: d.pop });
    }
    if (currentResults.length >= 30) return;
  });

  // Ordenar: prefixo primeiro, depois alfabético
  currentResults.sort((a, b) => {
    const aPrefix = a.name.toLowerCase().startsWith(qLower) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(qLower) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  activeIndex = -1;
  render(qLower);
}

function render(query) {
  if (currentResults.length === 0) {
    results.innerHTML = '<div class="search-item search-item--empty"><span class="name">Nenhum resultado</span></div>';
    results.classList.add('visible');
    return;
  }

  results.innerHTML = currentResults
    .map(
      (r, i) =>
        `<div class="search-item" data-index="${i}" data-code="${escapeHtml(r.code)}" role="option">` +
        `<span class="name">${highlightMatch(r.name, query)}</span>` +
        `<span class="pop">${fmtPop(r.pop)}</span>` +
        `</div>`
    )
    .join('');

  results.classList.add('visible');

  // Event delegation para cliques
  results.querySelectorAll('.search-item[data-code]').forEach((el) => {
    el.addEventListener('click', () => selectResult(el.dataset.code));
  });
}

function selectResult(code) {
  state.select(code);
  const d = state.muniData.get(code);
  const layer = state.muniLayers.get(code);
  if (layer) {
    getMap()?.fitBounds(layer.getBounds(), { maxZoom: 10, padding: [40, 40] });
  }
  hide();
  input.value = '';
}

function highlightMatch(text, query) {
  const safe = escapeHtml(text);
  const idx = safe.toLowerCase().indexOf(query);
  if (idx === -1) return safe;
  return (
    safe.substring(0, idx) +
    '<strong>' +
    safe.substring(idx, idx + query.length) +
    '</strong>' +
    safe.substring(idx + query.length)
  );
}

function updateActiveItem() {
  results.querySelectorAll('.search-item').forEach((el, i) => {
    el.classList.toggle('active', i === activeIndex);
  });
  // Scroll into view
  const activeEl = results.querySelector('.search-item.active');
  activeEl?.scrollIntoView({ block: 'nearest' });
}

function hide() {
  results.classList.remove('visible');
  activeIndex = -1;
}

/**
 * Sanitiza input: remove caracteres perigosos, limita tamanho.
 * @param {string} raw
 * @returns {string}
 */
function sanitizeQuery(raw) {
  return raw.replace(/[<>"'&]/g, '').trim().substring(0, 100);
}
