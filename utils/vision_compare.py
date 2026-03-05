import torch
import numpy as np
from scipy.spatial.distance import cosine
from PIL import Image
import requests
from io import BytesIO

# ===============================
# Lazy Loaded Model
# ===============================

model = None
processor = None
device = "cuda" if torch.cuda.is_available() else "cpu"


def load_model():
    """
    Charge CLIP une seule fois
    """
    global model, processor

    if model is None:
        from transformers import CLIPModel, CLIPProcessor

        model = CLIPModel.from_pretrained(
            "openai/clip-vit-base-patch32"
        ).to(device)

        processor = CLIPProcessor.from_pretrained(
            "openai/clip-vit-base-patch32"
        )


# ===============================
# Utils
# ===============================

def download_image(url):
    """
    Télécharge image depuis URL
    """
    response = requests.get(url, timeout=10)
    image = Image.open(BytesIO(response.content)).convert("RGB")
    return image


def get_image_embedding(image):
    """
    Transforme image → vecteur
    """
    inputs = processor(images=image, return_tensors="pt").to(device)

    with torch.no_grad():
        embedding = model.get_image_features(**inputs)

    embedding = embedding / embedding.norm(dim=-1, keepdim=True)

    return embedding.cpu().numpy()[0]


# ===============================
# Main Function
# ===============================

def compare_images(image_url_1, image_url_2):
    """
    Compare deux images
    Retourne score % de similarité
    """

    # Charger modèle si pas encore chargé
    load_model()

    try:
        img1 = download_image(image_url_1)
        img2 = download_image(image_url_2)

        vec1 = get_image_embedding(img1)
        vec2 = get_image_embedding(img2)

        similarity = 1 - cosine(vec1, vec2)

        score = float(similarity * 100)

        return {
            "similarity_score": round(score, 2),
            "match": score >= 70
        }

    except Exception as e:
        return {
            "error": str(e),
            "similarity_score": 0,
            "match": False
        }
