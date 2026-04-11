from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Executa inferencia local de rank e naipe para recortes de cartas."
    )
    parser.add_argument("--rank-model", required=True, help="Caminho do modelo de rank.")
    parser.add_argument("--suit-model", required=True, help="Caminho do modelo de naipe.")
    return parser.parse_args()


def load_model_bundle(model_path: Path) -> dict[str, Any]:
    bundle = joblib.load(model_path)

    if not isinstance(bundle, dict) or "model" not in bundle or "image_size" not in bundle:
        raise RuntimeError(f"Formato de modelo invalido: {model_path}")

    return bundle


def decode_data_url(data_url: str) -> Image.Image:
    if "," not in data_url:
        raise RuntimeError("Imagem invalida recebida para classificacao.")

    _, encoded = data_url.split(",", 1)
    image_bytes = base64.b64decode(encoded)
    return Image.open(io.BytesIO(image_bytes)).convert("L")


def read_rank_features(image: Image.Image, image_size: tuple[int, int]) -> np.ndarray:
    width, height = image.size
    crop = image.crop((0, 0, int(width * 0.45), int(height * 0.48)))
    resized = crop.resize(image_size)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    return array.flatten()


def read_suit_features(image: Image.Image, image_size: tuple[int, int]) -> np.ndarray:
    width, height = image.size
    crop = image.crop((0, int(height * 0.14), int(width * 0.38), int(height * 0.6)))
    resized = crop.resize(image_size)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    return array.flatten()


def score_distance(distance: float) -> float:
    return max(0.0, min(1.0, 1.0 / (1.0 + max(distance, 0.0) * 6.0)))


def classify_single_image(
    image: Image.Image,
    rank_bundle: dict[str, Any],
    suit_bundle: dict[str, Any],
) -> dict[str, Any]:
    best_result: dict[str, Any] | None = None

    for rotation in (0, 90, 180, 270):
        rotated = image.rotate(rotation, expand=True) if rotation else image
        rank_features = read_rank_features(rotated, tuple(rank_bundle["image_size"]))
        suit_features = read_suit_features(rotated, tuple(suit_bundle["image_size"]))

        rank_distances, rank_indices = rank_bundle["model"].kneighbors([rank_features], n_neighbors=1)
        suit_distances, suit_indices = suit_bundle["model"].kneighbors([suit_features], n_neighbors=1)
        rank_label = rank_bundle["model"].predict([rank_features])[0]
        suit_label = suit_bundle["model"].predict([suit_features])[0]
        rank_confidence = score_distance(float(rank_distances[0][0]))
        suit_confidence = score_distance(float(suit_distances[0][0]))
        combined_confidence = (rank_confidence + suit_confidence) / 2

        current = {
            "rotation": rotation,
            "rankGuess": str(rank_label),
            "suitGuess": str(suit_label),
            "rankConfidence": round(rank_confidence, 4),
            "suitConfidence": round(suit_confidence, 4),
            "combinedConfidence": round(combined_confidence, 4),
        }

        if best_result is None or current["combinedConfidence"] > best_result["combinedConfidence"]:
            best_result = current

    if not best_result:
        return {
            "rankGuess": None,
            "suitGuess": None,
            "rankConfidence": None,
            "suitConfidence": None,
            "combinedConfidence": None,
            "label": None,
        }

    return {
        **best_result,
        "label": f"{best_result['rankGuess']} de {best_result['suitGuess']}",
    }


def main() -> None:
    args = parse_args()
    rank_model_path = Path(args.rank_model).expanduser().resolve()
    suit_model_path = Path(args.suit_model).expanduser().resolve()

    if not rank_model_path.exists():
        raise FileNotFoundError(f"Modelo de rank nao encontrado: {rank_model_path}")

    if not suit_model_path.exists():
        raise FileNotFoundError(f"Modelo de naipe nao encontrado: {suit_model_path}")

    payload = json.loads(sys.stdin.read())
    images = payload.get("images", [])

    if not isinstance(images, list) or not images:
        raise RuntimeError("Nenhuma imagem enviada para classificacao.")

    rank_bundle = load_model_bundle(rank_model_path)
    suit_bundle = load_model_bundle(suit_model_path)
    predictions: list[dict[str, Any]] = []

    for image_data_url in images:
        image = decode_data_url(str(image_data_url))
        predictions.append(classify_single_image(image, rank_bundle, suit_bundle))

    print(
        json.dumps(
            {
                "predictions": predictions,
                "rankModelPath": str(rank_model_path),
                "suitModelPath": str(suit_model_path),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
