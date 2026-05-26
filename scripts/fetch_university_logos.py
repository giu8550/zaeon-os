#!/usr/bin/env python3
"""Fetch logos for Brazilian universities → public/assets/universities/

Usage:
    pip install requests
    python scripts/fetch_university_logos.py
"""
import os
import time
import json
import requests
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "assets" / "universities"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Manual Wikipedia logo URLs for known institutions
LOGO_URLS = {
    "ufc":    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Brasao_ufc.png/200px-Brasao_ufc.png",
    "unilab": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Logo_Unilab.png/200px-Logo_Unilab.png",
    "ifce":   "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Marca_IFCE_2021.png/200px-Marca_IFCE_2021.png",
    "ufmg":   "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Bras%C3%A3o_UFMG.svg/200px-Bras%C3%A3o_UFMG.svg.png",
    "unb":    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Universidade_de_Bras%C3%ADlia_%28logo%29.svg/200px-Universidade_de_Bras%C3%ADlia_%28logo%29.svg.png",
    "ufrj":   "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/UFRJ_logo.svg/200px-UFRJ_logo.svg.png",
    "uff":    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/UFF_logo.svg/200px-UFF_logo.svg.png",
    "ufba":   "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/UFBA-logo.svg/200px-UFBA-logo.svg.png",
    "ufrgs":  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Bras%C3%A3o_UFRGS.svg/200px-Bras%C3%A3o_UFRGS.svg.png",
    "ufsc":   "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/UFSC_logo.svg/200px-UFSC_logo.svg.png",
    "ufpe":   "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/UFPE_logo.svg/200px-UFPE_logo.svg.png",
    "ufpr":   "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Bras%C3%A3o_da_UFPR.svg/200px-Bras%C3%A3o_da_UFPR.svg.png",
    "ufscar": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/UFSCar_logo.svg/200px-UFSCar_logo.svg.png",
    "unifesp": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Unifesp_logo.svg/200px-Unifesp_logo.svg.png",
    "ufsm":   "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Bras%C3%A3o_UFSM.svg/200px-Bras%C3%A3o_UFSM.svg.png",
    "ufpa":   "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Logo_UFPA.svg/200px-Logo_UFPA.svg.png",
    "ufam":   "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/UFAM_logo.svg/200px-UFAM_logo.svg.png",
}


def fetch_wiki(uid: str) -> bool:
    if uid not in LOGO_URLS:
        return False
    try:
        r = requests.get(LOGO_URLS[uid], timeout=15, headers={"User-Agent": "Zaeon/1.0"})
        if r.status_code == 200 and len(r.content) > 500:
            (OUTPUT_DIR / f"{uid}.png").write_bytes(r.content)
            print(f"  ✓ wiki → {uid}.png")
            return True
    except Exception as e:
        print(f"  ✗ wiki {uid}: {e}")
    return False


def fetch_clearbit(website: str, uid: str) -> bool:
    domain = website.replace("https://", "").replace("http://", "").split("/")[0]
    try:
        r = requests.get(
            f"https://logo.clearbit.com/{domain}",
            timeout=10,
            headers={"User-Agent": "Zaeon/1.0"},
        )
        if r.status_code == 200 and len(r.content) > 1000:
            (OUTPUT_DIR / f"{uid}.png").write_bytes(r.content)
            print(f"  ✓ clearbit → {uid}.png")
            return True
    except Exception as e:
        print(f"  ✗ clearbit {uid}: {e}")
    return False


def make_placeholder(uid: str, acronym: str, color: str):
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">'
        f'<rect width="200" height="200" rx="20" fill="{color}"/>'
        f'<text x="100" y="115" font-family="Arial" font-size="48" font-weight="bold" '
        f'fill="white" text-anchor="middle">{acronym[:4]}</text>'
        f"</svg>"
    )
    (OUTPUT_DIR / f"{uid}.svg").write_text(svg)
    print(f"  ~ placeholder → {uid}.svg")


def main():
    # Read universities from the TypeScript constants file via a simple parse
    # (avoids needing ts-node — just reads the raw data we know)
    ts_file = Path(__file__).parent.parent / "constants" / "universities.ts"
    if not ts_file.exists():
        print("ERROR: constants/universities.ts not found.")
        return

    # Parse id/acronym/website/color from the TS file via basic string matching
    import re
    content = ts_file.read_text()
    pattern = re.compile(
        r"\{\s*id:\s*'([^']+)',\s*name:\s*'[^']+',\s*acronym:\s*'([^']+)',"
        r".*?website:\s*'([^']+)'.*?color:\s*'([^']+)'",
        re.DOTALL,
    )
    universities = [
        {"id": m.group(1), "acronym": m.group(2), "website": m.group(3), "color": m.group(4)}
        for m in pattern.finditer(content)
    ]

    print(f"\n🎓 Zaeon University Logo Fetcher — {len(universities)} universities\n")
    ok = 0
    for u in universities:
        uid = u["id"]
        if (OUTPUT_DIR / f"{uid}.png").exists():
            print(f"  → {uid}.png already exists, skipping.")
            ok += 1
            continue
        print(f"→ {u['acronym']}")
        if fetch_wiki(uid) or fetch_clearbit(u["website"], uid):
            ok += 1
        else:
            make_placeholder(uid, u["acronym"], u["color"])
        time.sleep(0.4)

    print(f"\nDone: {ok} logos, remainder are SVG placeholders.")
    print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
