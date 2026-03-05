import requests
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def compare_images(image_path):
    """
    Compare image uploadée avec description visuelle
    """

    with open(image_path, "rb") as f:
        image_data = f.read()

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text",
                     "text": "Analyse cette image produit et décris le produit avec précision."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/jpeg;base64," + image_data.hex()
                        }
                    }
                ]
            }
        ],
        max_tokens=300
    )

    return response.choices[0].message.content
