/* ═══════════════════════════════════════════════════
   data.js — Carregamento de dados pré-processados
   ═══════════════════════════════════════════════════

   Tudo vem de JSONs locais gerados por scripts/build.py.
   Zero chamadas ao SIDRA em runtime = carregamento rápido.

   Fallback: se o JSON local não existir, tenta SIDRA direto.
*/

import { fetchRetry, fetchJSON } from './utils/fetch.js';
import { dbg } from './utils/debug.js';
import * as state from './state.js';

const BASE = `${import.meta.env.BASE_URL}data/`;

// URLs de fallback (SIDRA direto, caso JSONs locais não existam)
const FALLBACK = {
  mesh: 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/json&qualidade=minima&intrarregiao=municipio',
  states: 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/json&qualidade=minima&intrarregiao=UF',
  names: 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios',
  pop: 'https://apisidra.ibge.gov.br/values/t/9514/n6/all/v/93/p/last%201/c2/6794/c287/100362/c286/113635',
};

// ─── Temas ───

export const THEMES = {
  populacao: { label: 'População', subvars: null, unit: 'hab.', loaded: true, status: null },
  densidade: { label: 'Densidade demográfica', subvars: null, unit: 'hab/km²', loaded: false, status: null },
  urbanizacao: {
    label: 'Urbanização',
    subvars: [{ id: 'pct_urbana', label: '% Urbana' }, { id: 'pct_rural', label: '% Rural' }],
    unit: '%', loaded: false, status: null, file: 'urbanizacao.json',
  },
  'faixa-etaria': {
    label: 'Faixa etária',
    subvars: [
      { id: 'pct_0_14', label: '% 0-14 anos' },
      { id: 'pct_15_29', label: '% 15-29 anos' },
      { id: 'pct_30_49', label: '% 30-49 anos' },
      { id: 'pct_50_64', label: '% 50-64 anos' },
      { id: 'pct_65_mais', label: '% 65+ anos' },
    ],
    unit: '%', loaded: false, status: null, file: 'faixa-etaria.json',
  },
  educacao: { label: 'Alfabetização', subvars: null, unit: '%', loaded: false, status: null, file: 'educacao.json' },
  renda: { label: 'Rendimento do responsável', subvars: null, unit: 'R$', loaded: false, status: null, file: 'renda.json' },
  idhm: {
    label: 'IDHM (2010)', subvars: null, unit: '', loaded: false,
    status: 'IDHM 2022 ainda não publicado pelo PNUD. Último disponível: 2010.',
  },
};

const themeCache = new Map();

// ─── Helpers ───

/**
 * Tenta carregar JSON local, com fallback para URL externa.
 */
async function loadLocalOrFallback(localFile, fallbackUrl, timeout = 30000) {
  try {
    return await fetchJSON(BASE + localFile, { timeout: 10000, retries: 0 });
  } catch (_) {
    dbg(`Local ${localFile} não encontrado, usando fallback...`, 'warn');
    if (fallbackUrl) return await fetchJSON(fallbackUrl, { timeout, retries: 2 });
    throw new Error(`${localFile} não encontrado. Rode: cd scripts && python build.py`);
  }
}

// ─── Boot ───

export async function loadMesh(onProgress) {
  onProgress(5, 'Carregando malha municipal...');
  const topo = await loadLocalOrFallback('mesh.json', FALLBACK.mesh, 60000);
  onProgress(35, 'Processando geometrias...');
  const objKey = Object.keys(topo.objects)[0];
  if (!objKey) throw new Error('TopoJSON vazio');
  if (typeof window.topojson === 'undefined') throw new Error('topojson não carregado');
  const geojson = window.topojson.feature(topo, topo.objects[objKey]);
  onProgress(50, `Renderizando ${geojson.features.length} municípios...`);
  return geojson;
}

export async function loadStateBorders() {
  try {
    const topo = await loadLocalOrFallback('states.json', FALLBACK.states);
    const objKey = Object.keys(topo.objects)[0];
    if (!objKey) return null;
    return window.topojson.feature(topo, topo.objects[objKey]);
  } catch (err) {
    dbg(`Bordas falhou: ${err.message}`, 'warn');
    return null;
  }
}

export async function loadNames(onProgress) {
  onProgress(60, 'Carregando dados dos municípios...');

  // Tentar JSON combinado (municipios.json tem nomes + população)
  try {
    const munis = await fetchJSON(BASE + 'municipios.json', { timeout: 10000, retries: 0 });

    let nameCount = 0;
    let popCount = 0;
    for (const [code, m] of Object.entries(munis)) {
      const d = state.ensure(code);
      if (m.n) { d.name = m.n; nameCount++; }
      if (m.uf) d.uf = m.uf;
      if (m.p != null) { d.pop = m.p; popCount++; }
      if (m.a != null) d.area = m.a;
    }

    state.ui.namesLoaded = true;
    state.ui.popLoaded = true;
    state.loadedThemes.add('populacao');
    onProgress(90, `${nameCount} municípios, ${popCount} com população.`);
    dbg(`Municipios.json: ${nameCount} nomes, ${popCount} pop`);
    return;
  } catch (_) {
    dbg('municipios.json não encontrado, usando fallback IBGE...', 'warn');
  }

  // Fallback: carregar separado
  try {
    const data = await fetchJSON(FALLBACK.names, { timeout: 30000 });
    for (const item of data) {
      const code = String(item.id);
      let uf = '';
      try { uf = item.microrregiao.mesorregiao.UF.sigla; } catch (_) {}
      const d = state.ensure(code);
      d.name = item.nome + (uf ? ` - ${uf}` : '');
      d.uf = uf;
    }
    state.ui.namesLoaded = true;
    onProgress(68, `${data.length} nomes.`);
  } catch (err) {
    dbg(`Nomes falhou: ${err.message}`, 'error');
  }
}

export async function loadPopulation(onProgress) {
  // Se municipios.json já carregou a população, pular
  if (state.ui.popLoaded) {
    onProgress(95, 'População já carregada.');
    return;
  }

  onProgress(70, 'Baixando população (SIDRA)...');
  try {
    const data = await fetchJSON(FALLBACK.pop, { timeout: 60000 });
    if (!data || data.length < 2) return;

    const header = data[0];
    let ck = 'D3C', vk = 'V', nk = 'D3N';
    for (const k in header) {
      const hv = String(header[k]).toLowerCase();
      if (hv.includes('município') && hv.includes('código')) ck = k;
      else if (hv === 'valor' || hv === 'value') vk = k;
      else if (hv.includes('município') && !hv.includes('código')) nk = k;
    }

    let loaded = 0;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const code = String(row[ck] || '').trim();
      if (!code) continue;
      const pop = parseInt(String(row[vk] || '').replace(/\D/g, ''), 10);
      const d = state.ensure(code);
      if (!isNaN(pop)) { d.pop = pop; loaded++; }
      if (row[nk] && !d.name) d.name = row[nk];
    }

    state.ui.popLoaded = true;
    state.loadedThemes.add('populacao');
    onProgress(95, `${loaded} registros populacionais.`);
  } catch (err) {
    dbg(`Pop falhou: ${err.message}`, 'error');
  }
}

// Stub (metadados não necessários com JSONs locais)
export async function loadMetadata() {}

// ─── Loaders temáticos ───

export async function loadTheme(themeId) {
  const theme = THEMES[themeId];
  if (!theme) return { success: false, message: 'Tema desconhecido.' };
  if (theme.loaded) return { success: true };
  if (theme.status) return { success: false, message: theme.status };

  // Densidade é computada, não precisa de arquivo
  if (themeId === 'densidade') {
    const cache = new Map();
    state.muniData.forEach((d, code) => {
      if (d.pop != null && d.area != null && d.area > 0) {
        cache.set(code, { densidade: d.pop / d.area });
      }
    });
    if (cache.size === 0) return { success: false, message: 'Área não calculada.' };
    themeCache.set('densidade', cache);
    THEMES.densidade.loaded = true;
    state.loadedThemes.add('densidade');
    state.emit('data:loaded', 'densidade');
    return { success: true };
  }

  // Carregar de arquivo local
  if (!theme.file) return { success: false, message: 'Sem arquivo de dados.' };

  try {
    dbg(`Carregando ${theme.file}...`);
    const json = await fetchJSON(BASE + theme.file, { timeout: 10000, retries: 0 });

    const cache = new Map();
    for (const [code, value] of Object.entries(json)) {
      cache.set(code, value);
    }

    if (cache.size === 0) return { success: false, message: 'Arquivo vazio.' };

    themeCache.set(themeId, cache);
    THEMES[themeId].loaded = true;
    state.loadedThemes.add(themeId);
    state.emit('data:loaded', themeId);
    dbg(`${themeId}: ${cache.size} municípios`);
    return { success: true };
  } catch (err) {
    dbg(`${themeId} falhou: ${err.message}`, 'warn');
    return {
      success: false,
      message: `Arquivo ${theme.file} não encontrado. Rode: cd scripts && python build.py`,
    };
  }
}

// ─── Getters ───

export function getThemeValue(code, themeId, subvar) {
  if (themeId === 'populacao') return state.muniData.get(code)?.pop ?? null;
  const cache = themeCache.get(themeId);
  if (!cache) return null;
  const entry = cache.get(code);
  if (entry == null) return null;
  if (subvar && typeof entry === 'object') return entry[subvar] ?? null;
  if (typeof entry === 'number') return entry;
  if (typeof entry === 'object') return entry[Object.keys(entry)[0]] ?? null;
  return null;
}

export function getAllThemeValues(themeId, subvar) {
  const values = [];
  if (themeId === 'populacao') {
    state.muniData.forEach(d => { if (d.pop != null) values.push(d.pop); });
    return values;
  }
  const cache = themeCache.get(themeId);
  if (!cache) return values;
  cache.forEach(entry => {
    let val = null;
    if (typeof entry === 'number') val = entry;
    else if (subvar && typeof entry === 'object') val = entry[subvar];
    else if (typeof entry === 'object') val = entry[Object.keys(entry)[0]];
    if (val != null && !isNaN(val)) values.push(val);
  });
  return values;
}