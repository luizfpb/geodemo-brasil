# GeoDemoBrasil — Plataforma de Análise Geodemográfica

[![Build & Deploy](https://github.com/luizfpb/geodemo-brasil/actions/workflows/deploy.yml/badge.svg)](https://github.com/luizfpb/geodemo-brasil/actions/workflows/deploy.yml)

Plataforma interativa de análise geodemográfica dos 5.570 municípios brasileiros com dados do Censo Demográfico 2022 (IBGE). Permite visualizar, comparar e exportar indicadores socioeconômicos por município ou região.

![Screenshot do mapa](public/screenshot.png)

**[Demo ao vivo](https://luizfpb.github.io/geodemo-brasil/)**

---

## Funcionalidades

- **Mapa coroplético interativo** com malha municipal completa (renderização via Canvas)
- **Camadas temáticas**: população, densidade, faixa etária, educação, renda, urbanização
- **Busca por nome** com autocomplete e navegação por teclado
- **Seleção individual** por clique (toggle)
- **Seleção por raio** geográfico (1–2000 km) com interseção via Turf.js
- **Grupos de comparação** (A/B) com painel side-by-side e gráficos
- **Ranking** dos top 30 municípios pelo indicador ativo
- **Permalink** via URL hash (compartilhável: tema, subvariável e seleção)
- **Exportação** dos dados selecionados em CSV e Excel (.xlsx)
- **Painel de estatísticas** com contagem e população agregada
- **Limites estaduais** sobrepostos
- **Tooltips dinâmicos** com dados do tema ativo
- **Sidebar retrátil** e layout responsivo
- **Debug mode** via `Ctrl+Shift+D`

## Fontes de dados

| Dado | Fonte | Referência |
|------|-------|------------|
| Malha municipal | IBGE Malhas | [API v3](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3) |
| Nomes dos municípios | IBGE Localidades | [API v1](https://servicodados.ibge.gov.br/api/docs/localidades) |
| População (Censo 2022) | IBGE SIDRA | [Tabela 9514](https://apisidra.ibge.gov.br/) |
| Área territorial | IBGE SIDRA | [Tabela 4714](https://apisidra.ibge.gov.br/) |
| Urbanização | IBGE SIDRA | [Tabela 9923](https://apisidra.ibge.gov.br/) |
| Faixa etária | IBGE SIDRA | [Tabela 9514](https://apisidra.ibge.gov.br/) |
| Alfabetização | IBGE SIDRA | [Tabela 9543](https://apisidra.ibge.gov.br/) |
| Renda per capita | IBGE SIDRA | [Tabela 10295](https://apisidra.ibge.gov.br/) |
| Limites estaduais | IBGE Malhas | [API v3](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3) |

## Stack

- **Frontend**: Vanilla JS (ES modules) + [Leaflet](https://leafletjs.com/) + [Chart.js](https://www.chartjs.org/)
- **Build**: [Vite](https://vitejs.dev/)
- **Geoespacial**: [TopoJSON](https://github.com/topojson/topojson) + [Turf.js](https://turfjs.org/)
- **Exportação**: [SheetJS](https://sheetjs.com/)
- **Pipeline de dados**: Python (requests)
- **Tiles**: [CARTO Basemaps](https://carto.com/basemaps)
- **CI/CD**: GitHub Actions + GitHub Pages
- **Linting**: ESLint + Prettier

## Setup

### Requisitos

- Node.js 18+
- Python 3.10+ (para o pipeline de dados)

### Instalação

```bash
git clone https://github.com/luizfpb/geodemo-brasil
cd geodemo-brasil
npm install
```

### Desenvolvimento

```bash
npm run dev
```

O servidor de desenvolvimento inicia em `http://localhost:3000`.

### Build de produção

```bash
npm run build
npm run preview   # Testar o build localmente
```

### Pipeline de dados

Para gerar/atualizar os JSONs de dados temáticos:

```bash
cd scripts
pip install -r requirements.txt
python build.py
```

Os JSONs são gerados em `public/data/` e ficam commitados no repositório. O CI **não** roda o pipeline Python; apenas builda o frontend.

### Linting e formatação

```bash
npm run lint          # Verificar
npm run lint:fix      # Corrigir automaticamente
npm run format        # Formatar com Prettier
npm run format:check  # Verificar formatação
```

### Testes

```bash
npm test
```

Testes unitários usando `node:test` (nativo do Node 18+), cobrindo funções de formatação e lógica de estado.

Testes do pipeline Python:

```bash
python -m unittest tests/test_pipeline.py
```

## Estrutura do projeto

```
├── .github/workflows/    # CI/CD (GitHub Actions)
├── scripts/
│   ├── build.py          # Pipeline unificado de dados
│   └── requirements.txt
├── src/
│   ├── main.js           # Entry point + permalink
│   ├── map.js            # Leaflet init
│   ├── layers.js         # Renderização e eventos
│   ├── choropleth.js     # Escalas de cor e legenda
│   ├── data.js           # Carregamento de dados
│   ├── state.js          # Estado global reativo
│   ├── ui/               # Módulos de interface
│   │   ├── sidebar.js
│   │   ├── search.js
│   │   ├── stats.js
│   │   ├── selected-list.js
│   │   ├── radius.js
│   │   ├── theme-selector.js
│   │   ├── groups.js
│   │   ├── comparison.js
│   │   ├── export.js
│   │   ├── charts.js
│   │   └── ranking.js
│   ├── utils/            # Utilitários
│   │   ├── fetch.js
│   │   ├── format.js
│   │   └── debug.js
│   └── styles/           # CSS modular
├── tests/
│   ├── format.test.js
│   ├── state.test.js
│   └── test_pipeline.py
├── public/data/          # JSONs gerados pelo pipeline
├── index.html
├── vite.config.js
├── .eslintrc.json
├── .prettierrc
└── package.json
```

## Licença

[MIT](LICENSE)
