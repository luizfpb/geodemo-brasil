"""
fetch_sidra.py — Download de tabelas do SIDRA/IBGE

Baixa dados do SIDRA e salva em data/raw/ como JSON.
Inclui retry com backoff exponencial e validação.
"""

import json
import sys
import time
from pathlib import Path

import requests

from config import SIDRA_TABLES, DATA_RAW, REQUEST_TIMEOUT, MAX_RETRIES, RETRY_DELAY


def fetch_with_retry(url: str, retries: int = MAX_RETRIES) -> list[dict]:
    """Faz GET no SIDRA com retry e backoff exponencial."""
    for attempt in range(retries + 1):
        try:
            print(f"  Tentativa {attempt + 1}/{retries + 1}...")
            response = requests.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()

            data = response.json()

            # SIDRA retorna lista de dicts; primeiro item é o header
            if not isinstance(data, list) or len(data) < 2:
                raise ValueError(f"Resposta inesperada: {len(data) if isinstance(data, list) else type(data)} itens")

            return data

        except requests.exceptions.Timeout:
            print(f"  Timeout ({REQUEST_TIMEOUT}s)")
        except requests.exceptions.HTTPError as e:
            print(f"  HTTP {e.response.status_code}")
            # 429 = rate limit, esperar mais
            if e.response.status_code == 429:
                wait = RETRY_DELAY * (2 ** attempt) * 3
                print(f"  Rate limit. Esperando {wait}s...")
                time.sleep(wait)
                continue
        except (requests.exceptions.ConnectionError, ValueError) as e:
            print(f"  Erro: {e}")

        if attempt < retries:
            wait = RETRY_DELAY * (2 ** attempt)
            print(f"  Retentando em {wait}s...")
            time.sleep(wait)

    raise RuntimeError(f"Falha após {retries + 1} tentativas")


def fetch_table(table_id: str) -> None:
    """Baixa uma tabela SIDRA e salva em data/raw/."""
    config = SIDRA_TABLES.get(table_id)
    if not config:
        print(f"Tabela desconhecida: {table_id}")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"Baixando: {config['description']}")
    print(f"URL: {config['url'][:80]}...")
    print(f"{'='*60}")

    data = fetch_with_retry(config["url"])

    output_path = DATA_RAW / f"{table_id}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    rows = len(data) - 1  # -1 para o header
    size_kb = output_path.stat().st_size / 1024
    print(f"  Salvo: {output_path}")
    print(f"  Registros: {rows}")
    print(f"  Tamanho: {size_kb:.1f} KB")


def fetch_all():
    """Baixa todas as tabelas configuradas."""
    print("="*60)
    print("Pipeline SIDRA — Download de dados brutos")
    print("="*60)

    for table_id in SIDRA_TABLES:
        try:
            fetch_table(table_id)
        except Exception as e:
            print(f"\n  ERRO em {table_id}: {e}")
            print("  Continuando com próxima tabela...\n")

    print(f"\nDownload concluído. Dados em: {DATA_RAW}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        for tid in sys.argv[1:]:
            fetch_table(tid)
    else:
        fetch_all()
