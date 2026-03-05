import os
import torch
import requests
import numpy as np

from flask import Flask, request, jsonify
from PIL import Image
from io import BytesIO
from scipy.spatial.distance import cosine
from transformers import CLIPProcessor, CLIPModel

# ==============================
# Flask
# ==============================

app = Flask(__name__)

# ==============================
# Load CLIP Model Once
# ==============================

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)


# ==============================
# Utils
# ==============================

def download_image(url):
    r = requests.get(url)
    img = Image.open(BytesIO(r.content)).convert("RGB")
    return img


def get_image_vector(image):
    inputs = processor(images=image, return_tensors="pt").to(device)

    with torch.no_grad():
        embedding = model.get_image_features(**inputs)

    embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    return embedding.cpu().numpy()[0]


def get_text_vector(text):
    inputs = processor(text=[text], return_tensors="pt").to(device)

    with torch.no_grad():
        embedding = model.get_text_features(**inputs)

    embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    return embedding.cpu().numpy()[0]


def compute_similarity(img_url_1, img_url_2, title):

    img1 = download_image(img_url_1)
    img2 = download_image(img_url_2)

    vec_img1 = get_image_vector(img1)
    vec_img2 = get_image_vector(img2)

    image_similarity = 1 - cosine(vec_img1, vec_img2)
    image_score = float(image_similarity * 100)

    # Text similarity
    vec_text = get_text_vector(title)
    text_similarity = 1 - cosine(vec_img2, vec_text)
    text_score = float(text_similarity * 100)

    final_score = float((image_score * 0.7) + (text_score * 0.3))

    return {
        "image_score": round(image_score, 2),
        "text_score": round(text_score, 2),
        "final_score": round(final_score, 2)
    }


# ==============================
# Routes
# ==============================

@app.route("/")
def home():
    return jsonify({
        "status": "API Running 🚀",
        "endpoint": "/compare"
    })


@app.route("/compare", methods=["POST"])
def compare():

    data = request.json

    img_url_1 = data.get("image_query")
    img_url_2 = data.get("image_product")
    title = data.get("title")

    if not img_url_1 or not img_url_2 or not title:
        return jsonify({"error": "Missing parameters"}), 400

    result = compute_similarity(img_url_1, img_url_2, title)

    return jsonify(result)


# ==============================
# Run
# ==============================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
