import torch
import requests
import numpy as np
from PIL import Image
from io import BytesIO
from scipy.spatial.distance import cosine
from transformers import CLIPProcessor, CLIPModel

# ===============================
# Load CLIP model once
# ===============================

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)


# ===============================
# Download image
# ===============================

def load_image(url):
    r = requests.get(url)
    img = Image.open(BytesIO(r.content)).convert("RGB")
    return img


# ===============================
# Image Embedding
# ===============================

def get_image_vector(image):

    inputs = processor(images=image, return_tensors="pt").to(device)

    with torch.no_grad():
        embedding = model.get_image_features(**inputs)

    embedding = embedding / embedding.norm(dim=-1, keepdim=True)

    return embedding.cpu().numpy()[0]


# ===============================
# Text Embedding
# ===============================

def get_text_vector(text):

    inputs = processor(text=[text], return_tensors="pt").to(device)

    with torch.no_grad():
        embedding = model.get_text_features(**inputs)

    embedding = embedding / embedding.norm(dim=-1, keepdim=True)

    return embedding.cpu().numpy()[0]


# ===============================
# Main Comparison
# ===============================

def compare_product(image_url_1, image_url_2, product_title):

    img1 = load_image(image_url_1)
    img2 = load_image(image_url_2)

    vec_img1 = get_image_vector(img1)
    vec_img2 = get_image_vector(img2)

    image_similarity = 1 - cosine(vec_img1, vec_img2)
    image_score = image_similarity * 100

    # Text similarity
    vec_text = get_text_vector(product_title)

    text_similarity = 1 - cosine(vec_img2, vec_text)
    text_score = text_similarity * 100

    # Weighted final score
    final_score = (image_score * 0.7) + (text_score * 0.3)

    return {
        "image_score": round(image_score, 2),
        "text_score": round(text_score, 2),
        "final_score": round(final_score, 2)
    }
