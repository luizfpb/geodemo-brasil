"""
fetch_atlas.py — Download do IDHM (Atlas Brasil / PNUD)

O IDHM municipal mais recente disponível é baseado no Censo 2010.
Os dados atualizados com o Censo 2022 podem ainda não estar publicados.

Este script tenta baixar os dados do Atlas Brasil. Se não conseguir
via API, orienta o usuário a baixar manualmente.
"""

import csv
import json
import sys
from pathlib import Path

import requests

from config import DATA_RAW, REQUEST_TIMEOUT


# URL do Atlas Brasil para download de indicadores municipais
# Nota: a API do Atlas pode mudar. Verificar periodicamente.
ATLAS_DOWNLOAD_URL = (
    "http://atlasbrasil.org.br/api/v1/consulta/planilha"
)

# Fallback: caminho para CSV baixado manualmente
MANUAL_CSV_PATH = DATA_RAW / "idhm_manual.csv"


def fetch_atlas_api() -> list[dict] | None:
    """
    Tenta baixar dados via API do Atlas Brasil.
    Retorna None se falhar (API instável historicamente).
    """
    print("Tentando API do Atlas Brasil...")

    # Parâmetros para o Atlas (formato pode variar)
    params = {
        "atributo[]": ["idhm", "idhm_e", "idhm_l", "idhm_r"],
        "geo": "municipio",
        "periodoInicio": 2010,
        "periodoFim": 2010,
    }

    try:
        resp = requests.get(ATLAS_DOWNLOAD_URL, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            return data
    except Exception as e:
        print(f"  API falhou: {e}")

    return None


def parse_manual_csv() -> list[dict] | None:
    """
    Lê CSV baixado manualmente do Atlas Brasil.
    Espera colunas: cod_ibge, idhm, idhm_e, idhm_l, idhm_r
    """
    if not MANUAL_CSV_PATH.exists():
        return None

    print(f"Lendo CSV manual: {MANUAL_CSV_PATH}")
    records = []

    with open(MANUAL_CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            # Tentar encontrar código IBGE
            code = None
            for key in ["cod_ibge", "codmun", "codibge", "Codmun6", "Codmun7"]:
                if key in row:
                    code = str(row[key]).strip()
                    break

            if not code:
                continue

            # Normalizar para 7 dígitos
            if len(code) == 6:
                code = code + "0"  # Aproximação — verificar

            record = {"code": code}
            for field in ["idhm", "idhm_e", "idhm_l", "idhm_r"]:
                val = row.get(field, "").replace(",", ".").strip()
                try:
                    record[field] = float(val)
                except ValueError:
                    record[field] = None

            records.append(record)

    return records if records else None


def main():
    print("="*60)
    print("Atlas Brasil — Download do IDHM")
    print("="*60)

    data = fetch_atlas_api()

    if not data:
        print("\nAPI indisponível. Tentando CSV manual...")
        data = parse_manual_csv()

    if not data:
        print("\n" + "!"*60)
        print("ATENÇÃO: Não foi possível obter dados do IDHM automaticamente.")
        print()
        print("Para usar o IDHM na plataforma:")
        print("1. Acesse https://atlasbrasil.org.br/acervo/atlas")
        print("2. Baixe os indicadores municipais (IDHM, IDHM-E, IDHM-L, IDHM-R)")
        print(f"3. Salve o CSV como: {MANUAL_CSV_PATH}")
        print("4. Execute este script novamente.")
        print("!"*60)
        sys.exit(1)

    # Salvar como JSON
    output_path = DATA_RAW / "idhm.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nSalvo: {output_path}")
    print(f"Registros: {len(data)}")


if __name__ == "__main__":
    main()
