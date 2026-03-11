"""
transform.py — Transformação dos dados brutos em formato processado

Lê os JSONs de data/raw/, limpa, agrega e gera dicts prontos
para exportação como JSON compacto.
"""

import json
from datetime import date
from pathlib import Path

from config import DATA_RAW, SIDRA_TABLES


def load_raw(table_id: str) -> list[dict] | None:
    """Carrega JSON bruto do SIDRA."""
    path = DATA_RAW / f"{table_id}.json"
    if not path.exists():
        print(f"  Arquivo não encontrado: {path}")
        return None

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def detect_sidra_keys(header: dict, config: dict) -> tuple[str, str, str]:
    """
    Detecta as chaves de código, valor e nome no header do SIDRA.
    """
    code_key = config.get("code_key_hint", "D3C")
    val_key = config.get("value_key_hint", "V")
    name_key = config.get("name_key_hint", "D3N")

    for k, v in header.items():
        hv = str(v).lower()
        if "município" in hv and "código" in hv:
            code_key = k
        elif hv in ("valor", "value"):
            val_key = k
        elif "município" in hv and "código" not in hv:
            name_key = k

    return code_key, val_key, name_key


def transform_populacao() -> dict:
    """Transforma dados de população."""
    print("\nProcessando: População")
    raw = load_raw("populacao")
    if not raw:
        return {}

    config = SIDRA_TABLES["populacao"]
    code_key, val_key, name_key = detect_sidra_keys(raw[0], config)

    result = {}
    for row in raw[1:]:
        code = str(row.get(code_key, "")).strip()
        if not code:
            continue

        raw_val = str(row.get(val_key, "")).strip()
        pop = None
        try:
            pop = int(raw_val.replace(".", "").replace(",", ""))
        except ValueError:
            pass

        if pop is not None:
            result[code] = {"pop_total": pop}

    print(f"  Municípios processados: {len(result)}")
    return result


def transform_idhm() -> dict:
    """Transforma dados do IDHM."""
    print("\nProcessando: IDHM")
    path = DATA_RAW / "idhm.json"
    if not path.exists():
        print("  Arquivo não encontrado. Execute fetch_atlas.py primeiro.")
        return {}

    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    result = {}
    for record in raw:
        code = str(record.get("code", "")).strip()
        if not code:
            continue

        entry = {}
        for field in ["idhm", "idhm_e", "idhm_l", "idhm_r"]:
            val = record.get(field)
            if val is not None:
                try:
                    entry[field] = round(float(val), 3)
                except (ValueError, TypeError):
                    pass

        if entry:
            result[code] = entry

    print(f"  Municípios processados: {len(result)}")
    return result


def transform_all() -> dict[str, dict]:
    """Executa todas as transformações e retorna dict de resultados."""
    results = {}

    pop = transform_populacao()
    if pop:
        results["populacao"] = {
            "meta": {
                "source": "SIDRA Tabela 9514",
                "description": "População residente total — Censo Demográfico 2022",
                "updated": date.today().isoformat(),
            },
            "data": pop,
        }

    idhm = transform_idhm()
    if idhm:
        results["idhm"] = {
            "meta": {
                "source": "Atlas Brasil / PNUD",
                "description": "IDHM Municipal — Censo 2010",
                "updated": date.today().isoformat(),
                "note": "Dados baseados no Censo 2010. Atualização com Censo 2022 pendente.",
            },
            "data": idhm,
        }

    return results


if __name__ == "__main__":
    results = transform_all()
    for key, val in results.items():
        count = len(val.get("data", {}))
        print(f"\n{key}: {count} registros prontos")
