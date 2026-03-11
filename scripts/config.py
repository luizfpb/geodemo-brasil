"""
config.py — Configuração do pipeline de dados

Centraliza tabelas SIDRA, URLs e parâmetros de extração.
"""

from pathlib import Path

# ─── Caminhos ───

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_RAW = ROOT_DIR / "data" / "raw"
DATA_PROCESSED = ROOT_DIR / "data" / "processed"

# Criar diretórios se não existem
DATA_RAW.mkdir(parents=True, exist_ok=True)
DATA_PROCESSED.mkdir(parents=True, exist_ok=True)

# ─── SIDRA ───

SIDRA_BASE = "https://apisidra.ibge.gov.br/values"

# Nível geográfico: n6 = municípios
# p/last%201 = último período disponível

SIDRA_TABLES = {
    "populacao": {
        "url": f"{SIDRA_BASE}/t/9514/n6/all/v/93/p/last%201/c2/6794/c287/100362/c286/113635",
        "description": "População residente total (Censo 2022)",
        "code_key_hint": "D3C",
        "value_key_hint": "V",
        "name_key_hint": "D3N",
    },
    # Tabela 9513: População por sexo e faixa etária
    # Nota: essa tabela é grande. Pode precisar de paginação.
    # Verificar disponibilidade no SIDRA antes de usar.
    "faixa_etaria": {
        "url": f"{SIDRA_BASE}/t/9513/n6/all/v/93/p/last%201/c2/6794/c287/100362",
        "description": "População por sexo e faixa etária (Censo 2022)",
        "code_key_hint": "D3C",
        "value_key_hint": "V",
        "name_key_hint": "D3N",
    },
}

# ─── Atlas Brasil (IDHM) ───

ATLAS_IDHM_URL = "http://www.interage.atlasbrasil.org.br/api/v1/consulta/planilha"
# O download do Atlas Brasil pode exigir POST com parâmetros específicos.
# Alternativa: baixar CSV diretamente do site do Atlas.
# URL de fallback (CSV pré-disponibilizado):
ATLAS_IDHM_CSV = "https://atlasbrasil.org.br/acervo/atlas"

# ─── Parâmetros de request ───

REQUEST_TIMEOUT = 60  # segundos
MAX_RETRIES = 3
RETRY_DELAY = 2  # segundos (base, cresce exponencialmente)

# ─── Campos de saída ───

# Formato dos JSONs processados:
# {
#   "meta": { "source": "...", "updated": "YYYY-MM-DD", "description": "..." },
#   "data": { "3100104": { "campo1": valor, ... }, ... }
# }
