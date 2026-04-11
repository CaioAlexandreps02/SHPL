from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from PIL import Image, ImageEnhance
from sklearn.neighbors import KNeighborsClassifier


RANK_IMAGE_SIZE = (48, 72)
SUIT_IMAGE_SIZE = (40, 40)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Treina classificadores iniciais de rank e naipe para o Live Lab."
    )
    parser.add_argument("--manifest", required=True, help="Manifesto gerado pelo prepare_dataset.py")
    parser.add_argument("--output", required=True, help="Pasta de saida dos modelos treinados.")
    return parser.parse_args()


def load_manifest(manifest_path: Path) -> dict[str, Any]:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def open_card_image(image_path: Path) -> Image.Image:
    return Image.open(image_path).convert("L")


def build_augmented_images(image: Image.Image) -> list[Image.Image]:
    variants: list[Image.Image] = []
    width, height = image.size
    brightness_values = [0.92, 1.0, 1.08]
    contrast_values = [0.92, 1.0, 1.12]
    rotation_values = [-8, -4, 0, 4, 8]
    offsets = [(-4, -4), (0, 0), (4, 4)]

    for brightness in brightness_values:
        brightened = ImageEnhance.Brightness(image).enhance(brightness)

        for contrast in contrast_values:
            contrasted = ImageEnhance.Contrast(brightened).enhance(contrast)

            for rotation in rotation_values:
                rotated = contrasted.rotate(
                    rotation,
                    resample=Image.Resampling.BICUBIC,
                    expand=False,
                    fillcolor=255,
                )

                for offset_x, offset_y in offsets:
                    canvas = Image.new("L", (width, height), 255)
                    canvas.paste(rotated, (offset_x, offset_y))
                    variants.append(canvas)

    variants.append(image)
    return variants


def read_rank_features(image: Image.Image) -> np.ndarray:
    width, height = image.size
    crop = image.crop((0, 0, int(width * 0.45), int(height * 0.48)))
    resized = crop.resize(RANK_IMAGE_SIZE)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    return array.flatten()


def read_suit_features(image: Image.Image) -> np.ndarray:
    width, height = image.size
    crop = image.crop((0, int(height * 0.14), int(width * 0.38), int(height * 0.6)))
    resized = crop.resize(SUIT_IMAGE_SIZE)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    return array.flatten()


def main() -> None:
    args = parse_args()
    manifest_path = Path(args.manifest).expanduser().resolve()
    output_dir = Path(args.output).expanduser().resolve()

    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifesto nao encontrado: {manifest_path}")

    manifest = load_manifest(manifest_path)
    base_dir = manifest_path.parent
    samples: list[dict[str, Any]] = manifest.get("samples", [])

    rank_vectors: list[np.ndarray] = []
    rank_labels: list[str] = []
    suit_vectors: list[np.ndarray] = []
    suit_labels: list[str] = []
    augmented_sample_count = 0

    for sample in samples:
        image_path = base_dir / sample["raw_path"]
        if not image_path.exists():
            continue

        image = open_card_image(image_path)
        augmented_images = build_augmented_images(image)
        augmented_sample_count += len(augmented_images)

        for variant in augmented_images:
            rank_vectors.append(read_rank_features(variant))
            rank_labels.append(sample["rank_label"])
            suit_vectors.append(read_suit_features(variant))
            suit_labels.append(sample["suit_label"])

    if not rank_vectors or not suit_vectors:
        raise RuntimeError("Nao existem amostras suficientes para treinar os classificadores.")

    rank_model = KNeighborsClassifier(n_neighbors=3, metric="euclidean", weights="distance")
    suit_model = KNeighborsClassifier(n_neighbors=3, metric="euclidean", weights="distance")

    rank_model.fit(np.asarray(rank_vectors), np.asarray(rank_labels))
    suit_model.fit(np.asarray(suit_vectors), np.asarray(suit_labels))

    output_dir.mkdir(parents=True, exist_ok=True)
    rank_model_path = output_dir / "rank-model.joblib"
    suit_model_path = output_dir / "suit-model.joblib"

    joblib.dump(
        {
            "image_size": RANK_IMAGE_SIZE,
            "model": rank_model,
            "labels": sorted(set(rank_labels)),
        },
        rank_model_path,
    )
    joblib.dump(
        {
            "image_size": SUIT_IMAGE_SIZE,
            "model": suit_model,
            "labels": sorted(set(suit_labels)),
        },
        suit_model_path,
    )

    summary = {
        "base_sample_count": len(samples),
        "augmented_sample_count": augmented_sample_count,
        "rank_sample_count": len(rank_labels),
        "suit_sample_count": len(suit_labels),
        "rank_classes": sorted(set(rank_labels)),
        "suit_classes": sorted(set(suit_labels)),
        "rank_model_path": str(rank_model_path),
        "suit_model_path": str(suit_model_path),
    }
    summary_path = output_dir / "training-summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Modelo de rank salvo em: {rank_model_path}")
    print(f"Modelo de naipe salvo em: {suit_model_path}")
    print(f"Resumo salvo em: {summary_path}")


if __name__ == "__main__":
    main()
