#!/usr/bin/env python3
"""
Publica Tuki en Hugging Face Spaces (gratis, URL fija, sin tarjeta).

Uso:
    python tools/deploy_hf.py                 -> arma la carpeta deploy-hf/ para subir a mano
    python tools/deploy_hf.py <TOKEN>         -> crea el Space y sube todo automáticamente
    set HF_TOKEN=hf_xxx & python tools/deploy_hf.py

El token se saca de https://huggingface.co/settings/tokens (tipo "Write").
"""
import os
import shutil
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "deploy-hf"

README = """---
title: Tuki
emoji: "\U0001F0CF"
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 8080
pinned: false
---

# Tuki · el juego de cartas para dos

Cada uno con su mazo de desafíos y 3 comodines. Sin turnos, sin ganador.
Se crea una sala, se comparte el código de 4 letras y se juega desde los dos teléfonos.

- 4 modos de mazo: Suave, Normal, Picante y Hot 18+ (solo adultos).
- La mesa se ve en las dos pantallas en tiempo real (SSE).
- Instalable como app (PWA).

Hecho con Node.js sin dependencias.
"""


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copy2(ROOT / "server.js", OUT / "server.js")
    shutil.copytree(ROOT / "public", OUT / "public")
    shutil.copy2(ROOT / "Dockerfile", OUT / "Dockerfile")
    with open(OUT / "README.md", "w", encoding="utf-8", newline="\n") as fh:
        fh.write(README)
    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"  carpeta lista: {OUT}  ({size/1024:.0f} KB)")
    return OUT


def deploy(token):
    from huggingface_hub import HfApi

    api = HfApi(token=token)
    who = api.whoami()
    user = who.get("name") or who.get("user")
    repo_id = f"{user}/tuki"
    print(f"  cuenta: {user}")

    build()
    api.create_repo(repo_id, repo_type="space", space_sdk="docker", exist_ok=True, private=False)
    print("  space creado/actualizado:", repo_id)

    api.upload_folder(
        folder_path=str(OUT),
        repo_id=repo_id,
        repo_type="space",
        commit_message="Tuki digital",
        ignore_patterns=["*.pyc", "__pycache__"],
    )
    print("  archivos subidos, esperando el build…")

    url = f"https://{user.lower()}-tuki.hf.space"
    last = None
    for _ in range(90):
        try:
            rt = api.get_space_runtime(repo_id)
            stage = getattr(rt, "stage", None)
            if stage != last:
                print("   ·", stage)
                last = stage
            if stage == "RUNNING":
                print("\n  LISTO →", url)
                return url
            if stage in ("BUILD_ERROR", "CONFIG_ERROR", "RUNTIME_ERROR"):
                print("\n  el build falló:", getattr(rt, "raw", {}))
                return None
        except Exception as e:  # noqa: BLE001
            print("   · esperando…", e.__class__.__name__)
        time.sleep(5)

    print("\n  sigue construyendo. Revisá el Space en https://huggingface.co/spaces/" + repo_id)
    print("  URL esperada:", url)
    return url


if __name__ == "__main__":
    token = os.environ.get("HF_TOKEN", "").strip()
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        token = sys.argv[1].strip()

    print("\nTUKI → Hugging Face Spaces\n")
    if not token:
        build()
        print("\n  Sin token: subí el contenido de deploy-hf/ a un Space nuevo (SDK Docker).")
        print("  O pasá un token Write: python tools/deploy_hf.py hf_xxx\n")
        sys.exit(0)

    deploy(token)
