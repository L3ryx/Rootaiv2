import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv

from utils.imgbb import upload_to_imgbb
from utils.serpapi_search import search_aliexpress_images
from utils.pro_compare import compare_images
from utils.vision_compare import load_model

load_dotenv()

app = Flask(__name__)


# ==========================
# HOME
# ==========================
@app.route("/")
def home():
    return {"status": "RootAI V2 running 🚀"}


# ==========================
# UPLOAD + PROCESS
# ==========================
@app.route("/upload", methods=["POST"])
def upload():

    if "image" not in request.files:
        return jsonify({"error": "No image"}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"error": "Empty file"}), 400

    # 1️⃣ Upload image to IMGBB
    image_url = upload_to_imgbb(file)

    # 2️⃣ Search AliExpress images
    results = search_aliexpress_images(file)

    matches = []

    # 3️⃣ Compare images
    for item in results:
        similarity = compare_images(image_url, item["image"])

        if similarity >= 70:
            matches.append({
                "title": item["title"],
                "url": item["url"],
                "image": item["image"],
                "similarity": similarity
            })

    return jsonify({
        "uploaded_image": image_url,
        "matches": matches
    })


# ==========================
# PORT FOR RENDER
# ==========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
