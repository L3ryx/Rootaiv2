import os
import requests


def upload_to_imgbb(file):

    api_key = os.getenv("IMGBB_KEY")

    url = "https://api.imgbb.com/1/upload"

    payload = {
        "key": api_key
    }

    files = {
        "image": file.read()
    }

    response = requests.post(url, data=payload, files={"image": files["image"]})

    data = response.json()

    return data["data"]["url"]
