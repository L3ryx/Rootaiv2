import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def compare_images(img1, img2):

    prompt = f"""
Compare ces deux images et donne uniquement un score de similarité entre 0 et 100.
Image1: {img1}
Image2: {img2}
Répond uniquement par un nombre.
"""

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role":"user","content":prompt}
        ]
    )

    try:
        score = int(response.choices[0].message.content.strip())
    except:
        score = 0

    return score
