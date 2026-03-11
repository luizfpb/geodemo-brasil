"""
export_json.py — Exporta JSONs processados para data/processed/

Gera arquivos JSON compactos, otimizados para o frontend.
"""

import json

from config import DATA_PROCESSED
from transform import transform_all


def export_json(data: dict, filename: str) -> None:
    """Salva dict como JSON compacto (sem indentação para economizar espaço)."""
    path = DATA_PROCESSED / f"{filename}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = path.stat().st_size / 1024
    count = len(data.get("data", {}))
    print(f"  {path.name}: {count} registros, {size_kb:.1f} KB")


def export_all():
    """Exporta todos os datasets processados."""
    print("="*60)
    print("Exportando JSONs para data/processed/")
    print("="*60)

    results = transform_all()

    for theme_id, payload in results.items():
        export_json(payload, theme_id)

    # Gerar metadata.json (índice de temas disponíveis)
    metadata = {
        "themes": {},
        "note": "Gerado automaticamente pelo pipeline de dados.",
    }
    for theme_id, payload in results.items():
        meta = payload.get("meta", {})
        metadata["themes"][theme_id] = {
            "source": meta.get("source", ""),
            "description": meta.get("description", ""),
            "updated": meta.get("updated", ""),
            "records": len(payload.get("data", {})),
        }

    export_json(metadata, "metadata")

    print(f"\nExportação concluída. Arquivos em: {DATA_PROCESSED}")


if __name__ == "__main__":
    export_all()
