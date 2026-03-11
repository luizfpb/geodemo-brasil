"""
build.py — Baixa dados do IBGE e gera JSONs otimizados.

Tabelas confirmadas:
  9514  — População por sexo/idade (faixa etária)
  9923  — População por situação do domicílio (urbanização)
  9543  — Taxa de alfabetização
  4714  — Área territorial (densidade)

Uso:
    cd scripts
    pip install requests
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

UFS = [12,27,16,13,29,23,53,32,52,21,51,50,31,15,25,41,26,22,33,24,43,11,14,42,35,28,17]


def fetch(url, retries=2, timeout=TIMEOUT):
    for i in range(retries + 1):
        try:
            r = requests.get(url, timeout=timeout)
            if r.status_code != 200:
                print(f"    HTTP {r.status_code} — {r.text[:150]}")
                if i < retries:
                    time.sleep(3 * (2**i)); continue
                raise RuntimeError(f"HTTP {r.status_code}")
            return r.json()
        except requests.exceptions.Timeout:
            print(f"    Timeout ({timeout}s)")
        except RuntimeError: raise
        except Exception as e:
            print(f"    {type(e).__name__}: {e}")
        if i < retries: time.sleep(3 * (2**i))
    raise RuntimeError("Falha após todas as tentativas")


def save(data, name):
    p = OUT / name
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",",":"))
    print(f"  -> {name}: {p.stat().st_size/1024:.0f} KB")


def pf(s):
    try: return float(str(s).replace(",",".").strip())
    except: return None


def dk(header):
    """Detect municipality code key and value key."""
    ck, vk = "D3C", "V"
    for k, v in header.items():
        h = str(v).lower()
        if "município" in h and "código" in h: ck = k
        elif h in ("valor","value"): vk = k
    return ck, vk


def get_meta(tid):
    try:
        d = fetch(META.format(tid), retries=1, timeout=15)
        return d
    except:
        return None


# ═══════════════════════════════════════
# 1+2. Malha + bordas
# ═══════════════════════════════════════

def build_mesh():
    print("\n[1/7] Malha municipal...")
    save(fetch("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/json&qualidade=minima&intrarregiao=municipio", timeout=90), "mesh.json")

def build_states():
    print("\n[2/7] Limites estaduais...")
    save(fetch("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/json&qualidade=minima&intrarregiao=UF"), "states.json")


# ═══════════════════════════════════════
# 3. Nomes + população + área (tabela 4714 tem área)
# ═══════════════════════════════════════

def build_municipios():
    print("\n[3/7] Nomes + população + área...")

    # Nomes
    names = fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
    munis = {}
    for item in names:
        code = str(item["id"])
        uf = ""
        try: uf = item["microrregiao"]["mesorregiao"]["UF"]["sigla"]
        except: pass
        munis[code] = {"n": item["nome"] + (f" - {uf}" if uf else ""), "uf": uf, "p": None, "a": None}
    print(f"  {len(munis)} nomes")

    # População (tabela 9514)
    print("  Baixando população (9514)...")
    pop = fetch(f"{SIDRA}/t/9514/n6/all/v/93/p/last%201/c2/6794/c287/100362/c286/113635", timeout=90)
    ck, vk = dk(pop[0])
    n = 0
    for row in pop[1:]:
        code = str(row.get(ck,"")).strip()
        if not code: continue
        try: p = int(str(row.get(vk,"")).replace(".","").replace(",","").strip())
        except: continue
        if code in munis: munis[code]["p"] = p
        n += 1
    print(f"  {n} registros pop")

    # Área territorial (tabela 4714, variável 616 = área em km²)
    print("  Baixando área territorial (4714)...")
    try:
        area = fetch(f"{SIDRA}/t/4714/n6/all/v/allxp/p/last%201", timeout=90)
        ck2, vk2 = dk(area[0])
        na = 0
        for row in area[1:]:
            code = str(row.get(ck2,"")).strip()
            val = pf(row.get(vk2))
            if code and val and val > 0 and code in munis:
                munis[code]["a"] = round(val, 3)
                na += 1
        print(f"  {na} registros área")
    except Exception as e:
        print(f"  Área falhou: {e}")

    save(munis, "municipios.json")


# ═══════════════════════════════════════
# 4. Urbanização (tabela 9923)
# ═══════════════════════════════════════

def build_urbanizacao():
    print("\n[4/7] Urbanização (tabela 9923)...")

    # Buscar metadados para descobrir classificação de situação
    meta = get_meta(9923)
    if meta and meta.get("classificacoes"):
        print(f"  Classificações:")
        for c in meta["classificacoes"]:
            cats_preview = [f"{cat['id']}={cat['nome']}" for cat in c.get("categorias",[])[:5]]
            print(f"    c{c['id']} ({c['nome']}): {cats_preview}")

    # Tabela 9923: pop residente por situação do domicílio
    # Variável 93 = pop residente
    # Preciso descobrir a classificação e códigos de urbana/rural
    # Tentativa: sem classificação (retorna total + por situação)
    url = f"{SIDRA}/t/9923/n6/all/v/93/p/last%201/c1/1,2"
    print(f"  Tentando URL simples (sem classificação)...")

    try:
        data = fetch(url, timeout=120)
    except Exception as e:
        print(f"  Falhou: {e}")
        return

    if not data or len(data) < 2:
        print("  Resposta vazia.")
        return

    header = data[0]
    ck, vk = dk(header)

    # Encontrar coluna que distingue urbano/rural
    # Procurar todas as colunas D*N e ver quais têm "urban" ou "rural"
    class_key = None
    for k, v in header.items():
        if re.match(r"D\d+N$", k):
            hv = str(v).lower()
            if "situação" in hv or "domicílio" in hv:
                class_key = k
                print(f"  Coluna de situação: {k} = {v}")
                break

    # Se não achou por nome, procurar nos dados
    if not class_key:
        for k in header:
            if not re.match(r"D\d+N$", k): continue
            if k in ("D1N",): continue
            # Checar se os dados contêm "urban" ou "rural"
            sample_vals = set()
            for row in data[1:min(50, len(data))]:
                sample_vals.add(str(row.get(k, "")).lower())
            if any("urban" in v or "rural" in v for v in sample_vals):
                class_key = k
                print(f"  Coluna detectada por conteúdo: {k} (valores: {sample_vals})")
                break

    if not class_key:
        # Listar todas as colunas para diagnóstico
        print(f"  Colunas disponíveis:")
        for k, v in header.items():
            sample = str(data[1].get(k, "")) if len(data) > 1 else ""
            print(f"    {k} = {v} | ex: {sample}")
        print("  Não encontrou coluna de situação.")
        return

    # Agrupar por município
    grouped = {}
    for row in data[1:]:
        code = str(row.get(ck,"")).strip()
        label = str(row.get(class_key,"")).strip().lower()
        val = pf(row.get(vk))
        if not code or val is None: continue
        if "total" in label: continue
        if code not in grouped: grouped[code] = {"u":0, "r":0}
        if "urban" in label: grouped[code]["u"] = val
        elif "rural" in label: grouped[code]["r"] = val

    result = {}
    for code, d in grouped.items():
        t = d["u"] + d["r"]
        if t > 0:
            result[code] = {"pct_urbana": round(d["u"]/t*100, 2), "pct_rural": round(d["r"]/t*100, 2)}

    print(f"  {len(result)} municípios")
    if result: save(result, "urbanizacao.json")


# ═══════════════════════════════════════
# 5. Faixa etária (tabela 9514, por UF)
# ═══════════════════════════════════════

def build_faixa_etaria():
    print("\n[5/7] Faixa etária (tabela 9514, por UF)...")

    # Buscar metadados para pegar códigos dos grupos quinquenais
    meta = get_meta(9514)
    if not meta:
        print("  Sem metadados. Pulando.")
        return

    # Classificação 287 = Idade
    c287 = None
    for c in meta.get("classificacoes", []):
        if c["id"] == 287:
            c287 = c
            break

    if not c287:
        print("  Classificação 287 não encontrada.")
        return

    # Filtrar grupos quinquenais: "X a Y anos" ou "X anos ou mais"
    quint = []
    for cat in c287.get("categorias", []):
        nome = cat["nome"]
        if re.match(r"^\d+ a \d+ anos$", nome) or re.match(r"^\d+ anos ou mais$", nome):
            quint.append(str(cat["id"]))

    print(f"  {len(quint)} grupos quinquenais")
    if not quint:
        print("  Nenhum grupo encontrado.")
        return

    codes = ",".join(quint)

    # Buscar por UF individual (evita estourar limite de 50k)
    result = {}
    for i, uf in enumerate(UFS):
        url = f"{SIDRA}/t/9514/n6/in%20n3%20{uf}/v/93/p/last%201/c2/6794/c287/{codes}/c286/113635"
        try:
            data = fetch(url, retries=1, timeout=60)
        except Exception as e:
            print(f"    UF {uf}: FALHOU ({e})")
            continue

        if not data or len(data) < 2: continue
        header = data[0]
        ck, vk = dk(header)

        # Encontrar coluna de idade (não sexo, não variável, não ano)
        # A coluna de idade terá valores como "0 a 4 anos", "5 a 9 anos"
        age_key = None
        for k in header:
            if not re.match(r"D\d+N$", k): continue
            if k == "D1N": continue  # Nível territorial
            # Amostrar valores
            vals = set()
            for row in data[1:min(30, len(data))]:
                vals.add(str(row.get(k, "")))
            # Se algum valor contém "anos", é a coluna de idade
            if any("anos" in v.lower() for v in vals):
                age_key = k
                break

        if not age_key:
            if i == 0: print(f"    Coluna de idade não encontrada para UF {uf}")
            continue

        # Agrupar por município
        grouped = {}
        for row in data[1:]:
            code = str(row.get(ck,"")).strip()
            label = str(row.get(age_key,"")).strip()
            val = pf(row.get(vk))
            if not code or val is None: continue
            if code not in grouped: grouped[code] = []
            grouped[code].append((label, val))

        for code, entries in grouped.items():
            t, c, jv, ad, mi, id = 0, 0, 0, 0, 0, 0
            for label, val in entries:
                t += val
                age = _age(label)
                if age is not None:
                    if age < 15: c += val
                    elif age < 30: jv += val
                    elif age < 50: ad += val
                    elif age < 65: mi += val
                    else: id += val
            if t > 0:
                result[code] = {
                    "pct_0_14": round(c/t*100, 2),
                    "pct_15_29": round(jv/t*100, 2),
                    "pct_30_49": round(ad/t*100, 2),
                    "pct_50_64": round(mi/t*100, 2),
                    "pct_65_mais": round(id/t*100, 2),
                }

        if (i+1) % 9 == 0 or i == len(UFS)-1:
            print(f"    {i+1}/{len(UFS)} UFs (total: {len(result)} munis)")
        time.sleep(0.3)

    print(f"  {len(result)} municípios")
    if result: save(result, "faixa-etaria.json")


def _age(label):
    lo = label.lower()
    if "menos de 1" in lo or "menor de 1" in lo: return 0
    m = re.search(r"(\d+)", label)
    return int(m.group(1)) if m else None


# ═══════════════════════════════════════
# 6. Alfabetização (tabela 9543)
# ═══════════════════════════════════════

def build_educacao():
    print("\n[6/7] Alfabetização (tabela 9543)...")

    # Tabela 9543: Taxa de alfabetização por sexo, cor/raça e idade
    # Variável: provavelmente "Taxa de alfabetização" (%)
    # Buscar com v/allxp para ver o que retorna
    url = f"{SIDRA}/t/9543/n6/all/v/allxp/p/last%201"
    print(f"  URL: .../t/9543/n6/all/v/allxp/...")

    try:
        data = fetch(url, timeout=120)
    except Exception as e:
        print(f"  Falhou: {e}")
        return

    if not data or len(data) < 2:
        print("  Resposta vazia.")
        return

    header = data[0]
    ck, vk = dk(header)

    # Diagnóstico: mostrar primeiras linhas
    print(f"  Linhas: {len(data)-1}")
    print(f"  Header keys: {list(header.keys())}")
    if len(data) > 1:
        print(f"  Exemplo row[1]: code={data[1].get(ck)}, val={data[1].get(vk)}")
        # Mostrar todas as colunas D*N com seus valores
        for k in header:
            if re.match(r"D\d+N$", k):
                print(f"    {k} ({header[k]}): {data[1].get(k, '?')}")

    # Extrair taxa de alfabetização
    # A tabela pode ter múltiplas linhas por município (por sexo, cor, idade)
    # Queremos a taxa TOTAL (sem filtro por sexo/cor/idade)
    # Estratégia: pegar o maior valor por município (taxa total > taxa por subgrupo)
    result = {}
    for row in data[1:]:
        code = str(row.get(ck,"")).strip()
        if not code: continue
        val = pf(row.get(vk))
        if val is not None and 0 < val <= 100:
            existing = result.get(code)
            if not existing or val > existing["taxa_alfabetizacao"]:
                result[code] = {"taxa_alfabetizacao": round(val, 2)}

    print(f"  {len(result)} municípios")
    if result: save(result, "educacao.json")


# ═══════════════════════════════════════
# 7. Renda (placeholder — número da tabela TBD)
# ═══════════════════════════════════════

def build_renda():
    print("\n[7/7] Rendimento (tabela 10295)...")

    # Tabela 10295: rendimento domiciliar per capita, médio e mediano
    # Disponível em nível MU (município)
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
    ck, vk = dk(header)

    # Diagnóstico
    print(f"  Linhas: {len(data)-1}")
    for k in header:
        if re.match(r"D\d+N$", k):
            print(f"    {k} ({header[k]}): ex={data[1].get(k, '?')}")

    # Encontrar coluna de variável
    vnk = None
    for k, v in header.items():
        if re.match(r"D\d+N$", k):
            if "variável" in str(v).lower() or "variable" in str(v).lower():
                vnk = k
                break

    # Extrair rendimento médio per capita
    # Filtrar pela variável que contenha "médio" (não "mediano")
    result = {}
    for row in data[1:]:
        code = str(row.get(ck,"")).strip()
        if not code: continue

        if vnk:
            vn = str(row.get(vnk,"")).lower()
            if "médio" not in vn or "mediano" in vn:
                continue

        val = pf(row.get(vk))
        if val is not None and 0 < val < 50000:
            existing = result.get(code)
            if not existing or val < existing["renda_media"]:
                result[code] = {"renda_media": round(val, 2)}

    print(f"  {len(result)} municípios")
    if result: save(result, "renda.json")

# ═══════════════════════════════════════

def main():
    t0 = time.time()
    print("="*60)
    print("GeoDemoBrasil — Build de dados")
    print(f"Saída: {OUT}")
    print("="*60)

    build_mesh()
    build_states()
    build_municipios()
    build_urbanizacao()
    build_faixa_etaria()
    build_educacao()
    build_renda()

    files = sorted(OUT.glob("*.json"))
    total = sum(f.stat().st_size for f in files) / 1024
    print(f"\n{'='*60}")
    print(f"Concluído em {time.time()-t0:.0f}s")
    for f in files:
        print(f"  {f.name} ({f.stat().st_size/1024:.0f} KB)")
    print(f"Total: {total:.0f} KB")
    print("="*60)

if __name__ == "__main__":
    main()