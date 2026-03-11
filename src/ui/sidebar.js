/* ═══════════════════════════════════════════════════
   ui/sidebar.js — Toggle e controle do sidebar
   ═══════════════════════════════════════════════════ */

import { getMap } from '../map.js';

const sidebar = document.getElementById('sidebar');
const toggle = document.getElementById('sidebar-toggle');

export function init() {
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    // Dar tempo para a transição CSS antes de recalcular o mapa
    setTimeout(() => {
      getMap()?.invalidateSize();
    }, 300);
  });
}
