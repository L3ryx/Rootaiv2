import torch
import torchvision.transforms as transforms
from PIL import Image
import requests
from io import BytesIO

model = None
processor = None
device = "cpu"


# ==========================
# LOAD MODEL LAZY
# ==========================
def load_model():
    global model

    if model is None:
        from transformers import CLIPModel, CLIPProcessor

        print("🚀 Loading CLIP model...")

        model = CLIPModel.from_pretrained(
            "openai/clip-vit-base-patch32"
        ).to(device)

        model.eval()

        print("✅ Model loaded")


# ==========================
# IMAGE TO EMBEDDING
# ==========================
def get_embedding(image_url):

    load_model()

    response = requests.get(image_url)
    img = Image.open(BytesIO(response.content)).convert("RGB")

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor()
    ])

    image_tensor = transform(img).unsqueeze(0)

    with torch.no_grad():
        embedding = model.get_image_features(image_tensor)

    return embedding
