import requests
import base64
import os

IMGBB_KEY = os.getenv("IMGBB_KEY")

def upload_imgbb(file):

    url = "https://api.imgbb.com/1/upload"

    payload = {
        "key": IMGBB_KEY,
        "image": base64.b64encode(file.read())
    }

    r = requests.post(url, payload)

    return r.json()["data"]["url"]
