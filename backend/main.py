"""CLI : python3 -m backend.main <image>"""
import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from backend.analyzer import analyze_artwork


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyse une œuvre d'art et affiche un résumé JSON.")
    parser.add_argument("image", help="Chemin vers un fichier image")
    args = parser.parse_args()

    p = Path(args.image)
    if not p.exists():
        print(f"Fichier introuvable : {args.image}", file=sys.stderr)
        sys.exit(1)

    media_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                   ".gif": "image/gif", ".webp": "image/webp"}
    media_type = media_types.get(p.suffix.lower(), "image/jpeg")

    print("Analyse en cours…", file=sys.stderr)
    result = analyze_artwork(p.read_bytes(), media_type)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
