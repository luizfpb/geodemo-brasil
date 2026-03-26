"""
build.py  --  Baixa dados do IBGE e gera JSONs pro frontend.

Tabelas SIDRA usadas:
  9514  — População por sexo/idade (faixa etária)
  9923  — População por situação do domicílio (urbanização)
  9543  — Taxa de alfabetização
  4714  — Área territorial (densidade)
  10295 — Rendimento domiciliar per capita

Os JSONs vão direto pra public/data/ (Vite serve de lá).

Uso:
    cd scripts
    pip install -r requirements.txt
    python build.py
"""

import json
import re
import time
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parent.parent / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

SIDRA = "https://apisidra.ibge.gov.br/values"
META = "https://servicodados.ibge.gov.br/api/v3/agregados/{}/metadados"
TIMEOUT = 120

UFS = [
    12, 27, 16, 13, 29, 23, 53, 32, 52, 21, 51, 50,
    31, 15, 25, 41, 26, 22, 33, 24, 43, 11, 14, 42, 35, 28, 17,
]


def fetch(url, retries=2, timeout=TIMEOUT):
    """GET com retry e backoff. Retorna JSON parseado."""
    for i in range(retries + 1):
        try:
            r = requests.get(url, timeout=timeout)
            if r.status_code != 200:
                print(f"    HTTP {r.status_code} -- {r.text[:150]}")
                if i < retries:
                    time.sleep(3 * (2 ** i))
                    continue
                raise RuntimeError(f"HTTP {r.status_code}")
            return r.json()
        except requests.exceptions.Timeout:
            print(f"    Timeout ({timeout}s)")
        except RuntimeError:
            raise
        except Exception as e:
            print(f"    {type(e).__name__}: {e}")
        if i < retries:
            time.sleep(3 * (2 ** i))
    raise RuntimeError("Falha apos todas as tentativas")


def save(data, name):
    """Salva JSON compacto em public/data/."""
    p = OUT / name
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  -> {name}: {p.stat().st_size / 1024:.0f} KB")


def parse_float(s):
    """Converte string BR pra float, retorna None se falhar."""
    try:
        return float(str(s).replace(",", ".").strip())
    except (ValueError, TypeError):
        return None


def detect_keys(header):
    """Descobre qual coluna e codigo do municipio e qual e o valor."""
    ck, vk = "D3C", "V"
    for k, v in header.items():
        h = str(v).lower()
        if "município" in h and "código" in h:
            ck = k
        elif h in ("valor", "value"):
            vk = k
    return ck, vk


def get_meta(tid):
    try:
        return fetch(META.format(tid), retries=1, timeout=15)
    except Exception:
        return None


# -- 1. Malha municipal --

def build_mesh():
    print("\n[1/7] Malha municipal...")
    url = (
        "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
        "?formato=application/json&qualidade=minima&intrarregiao=municipio"
    )
    save(fetch(url, timeout=90), "mesh.json")


# -- 2. Limites estaduais --

def build_states():
    print("\n[2/7] Limites estaduais...")
    url = (
        "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
        "?formato=application/json&qualidade=minima&intrarregiao=UF"
    )
    save(fetch(url), "states.json")


# -- 3. Nomes + populacao + area --

def build_municipios():
    print("\n[3/7] Nomes + populacao + area...")

    names = fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
    munis = {}
    for item in names:
        code = str(item["id"])
        uf = ""
        try:
            uf = item["microrregiao"]["mesorregiao"]["UF"]["sigla"]
        except (KeyError, TypeError):
            pass
        munis[code] = {
            "n": item["nome"] + (f" - {uf}" if uf else ""),
            "uf": uf,
            "p": None,
            "a": None,
        }
    print(f"  {len(munis)} nomes")

    # Populacao (tabela 9514, total ambos os sexos, todas as idades)
    print("  Baixando populacao (9514)...")
    pop = fetch(
        f"{SIDRA}/t/9514/n6/all/v/93/p/last%201/c2/6794/c287/100362/c286/113635",
        timeout=90,
    )
    ck, vk = detect_keys(pop[0])
    n = 0
    for row in pop[1:]:
        code = str(row.get(ck, "")).strip()
        if not code:
            continue
        try:
            p = int(str(row.get(vk, "")).replace(".", "").replace(",", "").strip())
        except (ValueError, TypeError):
            continue
        if code in munis:
            munis[code]["p"] = p
        n += 1
    print(f"  {n} registros pop")

    # Area territorial (tabela 4714)
    # v/allxp retorna 3 linhas por municipio: pop, area e densidade
    # preciso filtrar so a linha de area
    print("  Baixando area territorial (4714)...")
    try:
        area = fetch(f"{SIDRA}/t/4714/n6/all/v/allxp/p/last%201", timeout=90)
        header = area[0]
        ck2, vk2 = detect_keys(header)

        # achar coluna que distingue a variavel (pop vs area vs densidade)
        var_name_key = None
        for k, v in header.items():
            if re.match(r"D\d+N$", k):
                hv = str(v).lower()
                if "variável" in hv or "variable" in hv:
                    var_name_key = k
                    break

        na = 0
        for row in area[1:]:
            # filtrar: so pegar linhas de "Área territorial"
            if var_name_key:
                vn = str(row.get(var_name_key, "")).lower()
                if "rea" not in vn or "densidade" in vn:
                    continue

            code = str(row.get(ck2, "")).strip()
            val = parse_float(row.get(vk2))
            if code and val and val > 0 and code in munis:
                munis[code]["a"] = round(val, 3)
                na += 1
        print(f"  {na} registros area")
    except Exception as e:
        print(f"  Area falhou: {e}")

    save(munis, "municipios.json")


# -- 4. Urbanizacao (tabela 9923) --

def build_urbanizacao():
    print("\n[4/7] Urbanizacao (tabela 9923)...")

    # c1/1,2 = urbana, rural
    url = f"{SIDRA}/t/9923/n6/all/v/93/p/last%201/c1/1,2"
    try:
        data = fetch(url, timeout=120)
    except Exception as e:
        print(f"  Falhou: {e}")
        return

    if not data or len(data) < 2:
        print("  Resposta vazia.")
        return

    header = data[0]
    ck, vk = detect_keys(header)

    # achar a coluna que distingue urbano/rural
    class_key = None
    for k, v in header.items():
        if re.match(r"D\d+N$", k):
            hv = str(v).lower()
            if "situação" in hv or "domicílio" in hv:
                class_key = k
                break

    if not class_key:
        for k in header:
            if not re.match(r"D\d+N$", k):
                continue
            if k == "D1N":
                continue
            sample_vals = set()
            for row in data[1:min(50, len(data))]:
                sample_vals.add(str(row.get(k, "")).lower())
            if any("urban" in v or "rural" in v for v in sample_vals):
                class_key = k
                break

    if not class_key:
        print("  Nao encontrou coluna de situacao.")
        return

    grouped = {}
    for row in data[1:]:
        code = str(row.get(ck, "")).strip()
        label = str(row.get(class_key, "")).strip().lower()
        val = parse_float(row.get(vk))
        if not code or val is None:
            continue
        if "total" in label:
            continue
        if code not in grouped:
            grouped[code] = {"u": 0, "r": 0}
        if "urban" in label:
            grouped[code]["u"] = val
        elif "rural" in label:
            grouped[code]["r"] = val

    result = {}
    for code, d in grouped.items():
        t = d["u"] + d["r"]
        if t > 0:
            result[code] = {
                "pct_urbana": round(d["u"] / t * 100, 2),
                "pct_rural": round(d["r"] / t * 100, 2),
            }

    print(f"  {len(result)} municipios")
    if result:
        save(result, "urbanizacao.json")


# -- 5. Faixa etaria (tabela 9514, por UF pra nao estourar 50k) --

def build_faixa_etaria():
    print("\n[5/7] Faixa etaria (tabela 9514, por UF)...")

    meta = get_meta(9514)
    if not meta:
        print("  Sem metadados. Pulando.")
        return

    # classificacao 287 = Idade
    c287 = None
    for c in meta.get("classificacoes", []):
        if c["id"] == 287:
            c287 = c
            break

    if not c287:
        print("  Classificacao 287 nao encontrada.")
        return

    # grupos quinquenais: "X a Y anos" ou "X anos ou mais"
    quint = []
    for cat in c287.get("categorias", []):
        nome = cat["nome"]
        if re.match(r"^\d+ a \d+ anos$", nome) or re.match(r"^\d+ anos ou mais$", nome):
            quint.append(str(cat["id"]))

    print(f"  {len(quint)} grupos quinquenais")
    if not quint:
        return

    codes_str = ",".join(quint)
    result = {}

    for i, uf in enumerate(UFS):
        url = (
            f"{SIDRA}/t/9514/n6/in%20n3%20{uf}/v/93/p/last%201"
            f"/c2/6794/c287/{codes_str}/c286/113635"
        )
        try:
            data = fetch(url, retries=1, timeout=60)
        except Exception as e:
            print(f"    UF {uf}: FALHOU ({e})")
            continue

        if not data or len(data) < 2:
            continue

        header = data[0]
        ck, vk = detect_keys(header)

        # coluna de idade: contem "anos" nos valores
        age_key = None
        for k in header:
            if not re.match(r"D\d+N$", k):
                continue
            if k == "D1N":
                continue
            vals = set()
            for row in data[1:min(30, len(data))]:
                vals.add(str(row.get(k, "")))
            if any("anos" in v.lower() for v in vals):
                age_key = k
                break

        if not age_key:
            continue

        grouped = {}
        for row in data[1:]:
            code = str(row.get(ck, "")).strip()
            label = str(row.get(age_key, "")).strip()
            val = parse_float(row.get(vk))
            if not code or val is None:
                continue
            if code not in grouped:
                grouped[code] = []
            grouped[code].append((label, val))

        for code, entries in grouped.items():
            t = 0
            buckets = [0, 0, 0, 0, 0]  # 0-14, 15-29, 30-49, 50-64, 65+
            for label, val in entries:
                t += val
                age = _extract_age(label)
                if age is not None:
                    if age < 15:
                        buckets[0] += val
                    elif age < 30:
                        buckets[1] += val
                    elif age < 50:
                        buckets[2] += val
                    elif age < 65:
                        buckets[3] += val
                    else:
                        buckets[4] += val
            if t > 0:
                result[code] = {
                    "pct_0_14": round(buckets[0] / t * 100, 2),
                    "pct_15_29": round(buckets[1] / t * 100, 2),
                    "pct_30_49": round(buckets[2] / t * 100, 2),
                    "pct_50_64": round(buckets[3] / t * 100, 2),
                    "pct_65_mais": round(buckets[4] / t * 100, 2),
                }

        if (i + 1) % 9 == 0 or i == len(UFS) - 1:
            print(f"    {i + 1}/{len(UFS)} UFs (total: {len(result)} munis)")
        time.sleep(0.3)

    print(f"  {len(result)} municipios")
    if result:
        save(result, "faixa-etaria.json")


def _extract_age(label):
    """Extrai a idade inicial de labels tipo '5 a 9 anos'."""
    lo = label.lower()
    if "menos de 1" in lo or "menor de 1" in lo:
        return 0
    m = re.search(r"(\d+)", label)
    return int(m.group(1)) if m else None


# -- 6. Alfabetizacao (tabela 9543) --

def build_educacao():
    print("\n[6/7] Alfabetizacao (tabela 9543)...")

    url = f"{SIDRA}/t/9543/n6/all/v/allxp/p/last%201"
    try:
        data = fetch(url, timeout=120)
    except Exception as e:
        print(f"  Falhou: {e}")
        return

    if not data or len(data) < 2:
        print("  Resposta vazia.")
        return

    header = data[0]
    ck, vk = detect_keys(header)

    # a tabela pode ter varias linhas por municipio (sexo, cor, idade)
    # pegar o maior valor por municipio (taxa total > subgrupo)
    result = {}
    for row in data[1:]:
        code = str(row.get(ck, "")).strip()
        if not code:
            continue
        val = parse_float(row.get(vk))
        if val is not None and 0 < val <= 100:
            existing = result.get(code)
            if not existing or val > existing["taxa_alfabetizacao"]:
                result[code] = {"taxa_alfabetizacao": round(val, 2)}

    print(f"  {len(result)} municipios")
    if result:
        save(result, "educacao.json")


# -- 7. Renda (tabela 10295) --

def build_renda():
    print("\n[7/7] Rendimento (tabela 10295)...")

    url = f"{SIDRA}/t/10295/n6/all/v/allxp/p/last%201"
    try:
        data = fetch(url, timeout=120)
    except Exception as e:
        print(f"  Falhou: {e}")
        return

    if not data or len(data) < 2:
        print("  Resposta vazia.")
        return

    header = data[0]
    ck, vk = detect_keys(header)

    # achar coluna de variavel pra filtrar "medio" (ignorar "mediano")
    vnk = None
    for k, v in header.items():
        if re.match(r"D\d+N$", k):
            if "variável" in str(v).lower() or "variable" in str(v).lower():
                vnk = k
                break

    result = {}
    for row in data[1:]:
        code = str(row.get(ck, "")).strip()
        if not code:
            continue
        if vnk:
            vn = str(row.get(vnk, "")).lower()
            if "médio" not in vn or "mediano" in vn:
                continue
        val = parse_float(row.get(vk))
        if val is not None and 0 < val < 50000:
            existing = result.get(code)
            if not existing or val < existing["renda_media"]:
                result[code] = {"renda_media": round(val, 2)}

    print(f"  {len(result)} municipios")
    if result:
        save(result, "renda.json")


# -- Main --

def main():
    t0 = time.time()
    print("=" * 60)
    print("GeoDemoBrasil -- Build de dados")
    print(f"Saida: {OUT}")
    print("=" * 60)

    build_mesh()
    build_states()
    build_municipios()
    build_urbanizacao()
    build_faixa_etaria()
    build_educacao()
    build_renda()

    files = sorted(OUT.glob("*.json"))
    total = sum(f.stat().st_size for f in files) / 1024
    print(f"\n{'=' * 60}")
    print(f"Concluido em {time.time() - t0:.0f}s")
    for f in files:
        print(f"  {f.name} ({f.stat().st_size / 1024:.0f} KB)")
    print(f"Total: {total:.0f} KB")
    print("=" * 60)


if __name__ == "__main__":
    main()
