// ui/sidebar.js -- toggle do painel lateral

import { getMap } from '../map.js';

const sidebar = document.getElementById('sidebar');
const toggle = document.getElementById('sidebar-toggle');

export function init() {
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    // espera a transicao CSS terminar antes de recalcular o mapa
    setTimeout(() => {
      getMap()?.invalidateSize();
    }, 300);
  });
}
