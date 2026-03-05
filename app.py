import os
import requests
from flask import Flask, render_template, request
from PIL import Image
from io import BytesIO
import base64

# =========================
# CONFIG
# =========================

app = Flask(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SERPAPI_KEY = os.getenv("SERPAPI_KEY")
IMGBB_KEY = os.getenv("IMGBB_KEY")

# =========================
# IMGBB UPLOAD
# =========================

def upload_to_imgbb(file):
    url = "https://api.imgbb.com/1/upload"

    encoded = base64.b64encode(file.read())

    payload = {
        "key": IMGBB_KEY,
        "image": encoded
    }

    r = requests.post(url, data=payload)
    data = r.json()

    return data["data"]["url"]


# =========================
# GOOGLE REVERSE IMAGE
# =========================

def search_image(image_url):

    url = "https://serpapi.com/search.json"

    params = {
        "engine": "google_reverse_image",
        "image_url": image_url,
        "api_key": SERPAPI_KEY
    }

    r = requests.get(url, params=params)
    data = r.json()

    results = []

    for item in data.get("image_results", []):

        link = item.get("link", "")

        if "aliexpress" in link.lower():

            results.append({
                "link": link,
                "image": item.get("thumbnail")
            })

        if len(results) >= 10:
            break

    return results


# =========================
# OPENAI IMAGE COMPARISON
# =========================

def compare_images(img1_url, img2_url):

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }

    prompt = """
Compare ces deux images.
Donne uniquement un score de similarité entre 0 et 100.
Répond uniquement par un nombre.
"""

    data = {
        "model": "gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": img1_url}},
                    {"type": "image_url", "image_url": {"url": img2_url}}
                ]
            }
        ],
        "max_tokens": 10
    }

    r = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json=data
    )

    try:
        score = int(r.json()["choices"][0]["message"]["content"].strip())
    except:
        score = 0

    return score


# =========================
# ROUTE
# =========================

@app.route("/", methods=["GET", "POST"])
def index():

    results = []

    if request.method == "POST":

        file = request.files["image"]

        if file:

            # 1️⃣ Upload image to IMGBB
            img_url = upload_to_imgbb(file)

            # 2️⃣ Search Google Reverse Image
            links = search_image(img_url)

            # 3️⃣ Compare Images
            for item in links:

                score = compare_images(img_url, item["image"])

                if score >= 70:

                    results.append({
                        "link": item["link"],
                        "image": item["image"],
                        "score": score
                    })

    return render_template("index.html", results=results)


# =========================
# RENDER PORT BINDING
# =========================

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 10000))

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
