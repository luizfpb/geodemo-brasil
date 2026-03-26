// map.js -- Leaflet init, tiles, panes

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// corrigir paths de icones do Leaflet com Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

let map = null;

export function createMap() {
  // canvas ao inves de SVG -- muito mais rapido pra 5570 poligonos
  map = L.map('map', {
    center: [-14.2, -51.9],
    zoom: 4,
    minZoom: 3,
    maxZoom: 18,
    renderer: L.canvas({ padding: 0.5 }),
    zoomControl: false,
    preferCanvas: true,
    maxBounds: [[-85, -200], [85, 200]],
    maxBoundsViscosity: 1.0,
  });

  L.control.zoom({ position: 'topright' }).addTo(map);

  // CARTO Light sem labels -- bom contraste com coropletico
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> | IBGE',
    subdomains: 'abcd',
    maxZoom: 18,
    noWrap: true,
  }).addTo(map);

  // pane separado pra bordas estaduais ficarem acima dos poligonos
  map.createPane('stateBordersPane');
  const bordersPane = map.getPane('stateBordersPane');
  bordersPane.style.zIndex = '450';
  bordersPane.style.pointerEvents = 'none';

  return map;
}

export function getMap() {
  return map;
}
