import os
from flask import Flask, render_template, request, jsonify
from utils.vision_compare import compare_images

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = "uploads"

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)


# ==========================
# 🏠 HOME PAGE
# ==========================
@app.route("/")
def home():
    return render_template("index.html")


# ==========================
# 🔎 IMAGE COMPARISON
# ==========================
@app.route("/compare", methods=["POST"])
def compare():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    filepath = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
    file.save(filepath)

    # 🔥 Ici tu appelles ton moteur IA
    result = compare_images(filepath)

    return jsonify({
        "status": "success",
        "result": result
    })


# ==========================
# 🚀 HEALTH CHECK (IMPORTANT POUR RENDER)
# ==========================
@app.route("/health")
def health():
    return {"status": "RootAI V2 running 🚀"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
