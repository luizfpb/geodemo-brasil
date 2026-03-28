// ui/state-filter.js -- filtro por UF com dropdown multiselect
//
// filtra ranking e busca por UF(s) selecionada(s).
// o coropletico mostra tudo, mas ranking e busca ficam filtrados.
// faz zoom nos bounds das UFs selecionadas como bonus.

import L from 'leaflet';
import * as state from '../state.js';
import { getMap } from '../map.js';

const UF_ORDER = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

let $container = null;
let $button = null;
let $dropdown = null;
let isOpen = false;
let built = false;

export function init() {
  $container = document.getElementById('state-filter-wrap');
  if (!$container) return;

  // dados de UF so estao disponiveis depois que loadNames completa.
  // 'data:ready' e emitido pelo main.js apos toda a carga.
  state.on('data:ready', buildDropdown);

  document.addEventListener('click', (e) => {
    if (isOpen && !e.target.closest('#state-filter-wrap')) {
      close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });
}

function buildDropdown() {
  if (built) return;

  const ufs = new Set();
  const ufCounts = new Map();
  state.muniData.forEach((d) => {
    if (d.uf) {
      ufs.add(d.uf);
      ufCounts.set(d.uf, (ufCounts.get(d.uf) || 0) + 1);
    }
  });

  const sorted = UF_ORDER.filter((uf) => ufs.has(uf));
  if (sorted.length === 0) return;

  built = true;
  $container.innerHTML = '';

  const lbl = document.createElement('label');
  lbl.textContent = 'Filtrar por estado';
  $container.appendChild(lbl);

  const wrap = document.createElement('div');
  wrap.className = 'state-filter-inner';

  $button = document.createElement('button');
  $button.className = 'state-filter-btn';
  $button.type = 'button';
  $button.textContent = 'Todos os estados';
  $button.addEventListener('click', toggle);
  wrap.appendChild($button);

  $dropdown = document.createElement('div');
  $dropdown.className = 'state-filter-dropdown hidden';

  $dropdown.appendChild(createCheckItem('__all__', 'Todos', true, null));

  const sep = document.createElement('div');
  sep.className = 'state-filter-sep';
  $dropdown.appendChild(sep);

  for (const uf of sorted) {
    const count = ufCounts.get(uf) || 0;
    $dropdown.appendChild(createCheckItem(uf, uf, false, count));
  }

  wrap.appendChild($dropdown);
  $container.appendChild(wrap);
}

function createCheckItem(value, label, checked, count) {
  const wrap = document.createElement('label');
  wrap.className = 'state-filter-item';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.value = value;
  cb.checked = checked;
  cb.addEventListener('change', () => onCheckChange(value, cb.checked));

  const span = document.createElement('span');
  span.className = 'state-filter-label';
  span.textContent = label;

  wrap.appendChild(cb);
  wrap.appendChild(span);

  if (count != null) {
    const badge = document.createElement('span');
    badge.className = 'state-filter-count';
    badge.textContent = count.toLocaleString('pt-BR');
    wrap.appendChild(badge);
  }

  return wrap;
}

function onCheckChange(value, checked) {
  if (!$dropdown) return;

  const allCb = $dropdown.querySelector('input[value="__all__"]');
  const ufCbs = [...$dropdown.querySelectorAll('input')].filter(
    (cb) => cb.value !== '__all__'
  );

  if (value === '__all__') {
    ufCbs.forEach((cb) => { cb.checked = false; });
    allCb.checked = true;
    state.ui.activeUFs = null;
    updateButtonLabel();
    state.emit('filter:changed');
    return;
  }

  if (checked) {
    allCb.checked = false;
  }

  const selected = new Set();
  ufCbs.forEach((cb) => {
    if (cb.checked) selected.add(cb.value);
  });

  if (selected.size === 0) {
    allCb.checked = true;
    state.ui.activeUFs = null;
  } else {
    state.ui.activeUFs = selected;
  }

  updateButtonLabel();
  state.emit('filter:changed');
  zoomToUFs();
}

function updateButtonLabel() {
  if (!$button) return;
  if (!state.ui.activeUFs || state.ui.activeUFs.size === 0) {
    $button.textContent = 'Todos os estados';
    $button.classList.remove('active');
    return;
  }
  const ufs = [...state.ui.activeUFs];
  $button.textContent = ufs.length <= 3 ? ufs.join(', ') : `${ufs.length} estados`;
  $button.classList.add('active');
}

function zoomToUFs() {
  if (!state.ui.activeUFs || state.ui.activeUFs.size === 0) return;

  const map = getMap();
  if (!map) return;

  const points = [];
  state.muniLayers.forEach((layer, code) => {
    const d = state.muniData.get(code);
    if (d && state.ui.activeUFs.has(d.uf)) {
      try {
        const b = layer.getBounds();
        points.push(b.getSouthWest());
        points.push(b.getNorthEast());
      } catch (_e) { /* layer sem bounds */ }
    }
  });

  if (points.length > 0) {
    map.fitBounds(L.latLngBounds(points), { padding: [20, 20], maxZoom: 8 });
  }
}

function toggle() {
  isOpen ? close() : open();
}

function open() {
  isOpen = true;
  if ($dropdown) $dropdown.classList.remove('hidden');
}

function close() {
  isOpen = false;
  if ($dropdown) $dropdown.classList.add('hidden');
}

// exportado pra ranking e search usarem
export function matchesFilter(code) {
  if (!state.ui.activeUFs || state.ui.activeUFs.size === 0) return true;
  const d = state.muniData.get(code);
  return d?.uf ? state.ui.activeUFs.has(d.uf) : false;
}
