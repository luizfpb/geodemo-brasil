"""
build_data.py — Orquestra o pipeline completo de dados

Executa em sequência:
1. Download do SIDRA (fetch_sidra.py)
2. Download do IDHM (fetch_atlas.py)
3. Transformação (transform.py)
4. Exportação JSON (export_json.py)

Uso:
    python scripts/build_data.py          # Pipeline completo
    python scripts/build_data.py --skip-download   # Só transforma/exporta
"""

import sys
import time

from fetch_sidra import fetch_all as fetch_sidra
from fetch_atlas import main as fetch_atlas
from export_json import export_all


def main():
    skip_download = "--skip-download" in sys.argv

    start = time.time()
    print("\n" + "═"*60)
    print("GeoDemoBrasil — Pipeline de Dados")
    print("═"*60)

    if not skip_download:
        # Etapa 1: Download SIDRA
        print("\n[1/3] Download de tabelas do SIDRA...")
        try:
            fetch_sidra()
        except Exception as e:
            print(f"ERRO no SIDRA: {e}")
            print("Continuando sem dados SIDRA...\n")

        # Etapa 2: Download IDHM
        print("\n[2/3] Download do IDHM (Atlas Brasil)...")
        try:
            fetch_atlas()
        except SystemExit:
            print("IDHM indisponível. Continuando sem IDHM.\n")
        except Exception as e:
            print(f"ERRO no Atlas: {e}")
            print("Continuando sem IDHM...\n")
    else:
        print("\n[1-2/3] Download pulado (--skip-download)")

    # Etapa 3: Transformar e exportar
    print("\n[3/3] Transformação e exportação...")
    export_all()

    elapsed = time.time() - start
    print(f"\n{'═'*60}")
    print(f"Pipeline concluído em {elapsed:.1f}s")
    print(f"{'═'*60}\n")


if __name__ == "__main__":
    main()
