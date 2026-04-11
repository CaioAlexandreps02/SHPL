from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Converte o export do Live Lab em imagens prontas para treino."
    )
    parser.add_argument("--input", required=True, help="Arquivo JSON exportado pelo Live Lab.")
    parser.add_argument(
        "--output",
        required=True,
        help="Pasta de saida onde o dataset preparado sera criado.",
    )
    return parser.parse_args()


def slugify(value: str) -> str:
    return (
        value.strip()
        .lower()
        .replace(" ", "-")
        .replace("/", "-")
    )


def decode_data_url(data_url: str) -> bytes:
    header, encoded = data_url.split(",", 1)
    if ";base64" not in header:
        raise ValueError("A imagem exportada nao esta em base64.")
    return base64.b64decode(encoded)


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output).expanduser().resolve()

    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo nao encontrado: {input_path}")

    payload = json.loads(input_path.read_text(encoding="utf-8"))
    samples: list[dict[str, Any]] = payload.get("samples", [])

    images_raw_dir = output_dir / "images" / "raw"
    images_rank_dir = output_dir / "images" / "rank"
    images_suit_dir = output_dir / "images" / "suit"

    ensure_dir(images_raw_dir)
    ensure_dir(images_rank_dir)
    ensure_dir(images_suit_dir)

    manifest_samples: list[dict[str, Any]] = []

    for sample in samples:
        rank_label = sample.get("rankLabel")
        suit_label = sample.get("suitLabel")
        image_data_url = sample.get("imageDataUrl")
        file_name = sample.get("fileName") or f"{sample['id']}.png"

        if not rank_label or not suit_label or not image_data_url:
            continue

        image_bytes = decode_data_url(image_data_url)

        raw_path = images_raw_dir / file_name
        rank_path = images_rank_dir / slugify(rank_label) / file_name
        suit_path = images_suit_dir / slugify(suit_label) / file_name

        ensure_dir(rank_path.parent)
        ensure_dir(suit_path.parent)

        raw_path.write_bytes(image_bytes)
        rank_path.write_bytes(image_bytes)
        suit_path.write_bytes(image_bytes)

        manifest_samples.append(
            {
                "id": sample["id"],
                "file_name": file_name,
                "rank_label": rank_label,
                "suit_label": suit_label,
                "board_stage": sample.get("boardStage"),
                "captured_at": sample.get("capturedAt"),
                "source_image_name": sample.get("sourceImageName"),
                "source_card_index": sample.get("sourceCardIndex"),
                "source_card_count": sample.get("sourceCardCount"),
                "width": sample.get("width"),
                "height": sample.get("height"),
                "confidence": sample.get("confidence"),
                "corner_confidence": sample.get("cornerConfidence"),
                "raw_path": str(raw_path.relative_to(output_dir)),
                "rank_path": str(rank_path.relative_to(output_dir)),
                "suit_path": str(suit_path.relative_to(output_dir)),
            }
        )

    manifest = {
        "version": 1,
        "source_export": str(input_path),
        "prepared_at": payload.get("exportedAt"),
        "sample_count": len(manifest_samples),
        "samples": manifest_samples,
    }

    ensure_dir(output_dir)
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Dataset preparado com {len(manifest_samples)} amostra(s).")
    print(f"Manifesto salvo em: {manifest_path}")


if __name__ == "__main__":
    main()
