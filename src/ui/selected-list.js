/* ═══════════════════════════════════════════════════
   ui/selected-list.js — Lista de municípios selecionados
   ═══════════════════════════════════════════════════ */

import * as state from '../state.js';
import { getMap } from '../map.js';
import { fmtPop, escapeHtml } from '../utils/format.js';

const $list = document.getElementById('selected-list');
const $empty = document.getElementById('empty-state');
const $listCount = document.getElementById('list-count');

export function init() {
  state.on('selection:changed', render);
  render();
}

function render() {
  const size = state.selection.size;
  $listCount.textContent = String(size);

  if (size === 0) {
    $list.innerHTML = '';
    $list.appendChild($empty);
    $empty.style.display = 'block';
    return;
  }

  $empty.style.display = 'none';

  // Montar items ordenados por população
  const items = [];
  state.selection.forEach((group, code) => {
    const d = state.muniData.get(code) || {};
    items.push({ code, name: d.name || `Cód. ${code}`, pop: d.pop, group });
  });

  items.sort((a, b) => (b.pop || 0) - (a.pop || 0));

  $list.innerHTML = items
    .map((it) => {
      const safeName = escapeHtml(it.name);
      const safeCode = escapeHtml(it.code);
      const badgeClass = it.group === 'B' ? 'group-b' : 'group-a';
      const badgeLabel = it.group;

      return (
        `<div class="selected-item" data-code="${safeCode}" role="listitem">` +
        `<span class="group-badge ${badgeClass}">${badgeLabel}</span>` +
        `<span class="name" title="${safeName}">${safeName}</span>` +
        `<span class="pop">${fmtPop(it.pop)}</span>` +
        `<button class="remove" data-code="${safeCode}" title="Remover" aria-label="Remover ${safeName}">&times;</button>` +
        `</div>`
      );
    })
    .join('');

  // Event delegation
  $list.addEventListener('click', handleClick, { capture: false });
}

function handleClick(e) {
  const removeBtn = e.target.closest('.remove');
  if (removeBtn) {
    e.stopPropagation();
    state.deselect(removeBtn.dataset.code);
    return;
  }

  const item = e.target.closest('.selected-item');
  if (item) {
    const code = item.dataset.code;
    const layer = state.muniLayers.get(code);
    if (layer) {
      getMap()?.fitBounds(layer.getBounds(), { maxZoom: 10, padding: [40, 40] });
    }
  }
}
