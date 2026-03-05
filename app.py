from flask import Flask, render_template, request
import os
from utils.imgbb import upload_imgbb
from utils.serpapi_search import search_image
from utils.vision_compare import compare_images

app = Flask(__name__)

@app.route("/", methods=["GET", "POST"])
def index():

    results = []

    if request.method == "POST":

        file = request.files["image"]

        if file:

            # upload imgbb
            img_url = upload_imgbb(file)

            # google search
            links = search_image(img_url)

            # comparer images
            for item in links:

                score = compare_images(img_url, item["image"])

                if score >= 70:
                    results.append({
                        "link": item["link"],
                        "image": item["image"],
                        "score": score
                    })

    return render_template("index.html", results=results)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
