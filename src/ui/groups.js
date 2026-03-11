/* ═══════════════════════════════════════════════════
   ui/groups.js — Gestão de grupos de comparação
   ═══════════════════════════════════════════════════ */

import * as state from '../state.js';
import { refreshStyles } from '../layers.js';

const $groupSelect = document.getElementById('active-group-select');
const $compareBtn = document.getElementById('compare-btn');
const $swapBtn = document.getElementById('swap-groups-btn');
const $clearBtn = document.getElementById('clear-groups-btn');

export function init() {
  $groupSelect.addEventListener('change', () => {
    state.ui.activeGroup = $groupSelect.value;
    state.emit('group:changed', state.ui.activeGroup);
  });

  $swapBtn.addEventListener('click', () => {
    state.swapGroups();
    refreshStyles();
  });

  $clearBtn.addEventListener('click', () => {
    state.deselectAll();
    refreshStyles();
  });

  // Habilitar botão "comparar" quando ambos os grupos têm municípios
  state.on('selection:changed', updateCompareBtn);
}

function updateCompareBtn() {
  const hasA = state.getGroupCodes('A').length > 0;
  const hasB = state.getGroupCodes('B').length > 0;
  $compareBtn.disabled = !(hasA && hasB);
}

/**
 * Retorna referência ao botão de comparar (para o módulo comparison).
 */
export function getCompareBtn() {
  return $compareBtn;
}
