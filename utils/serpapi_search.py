import requests
import os

SERPAPI_KEY = os.getenv("SERPAPI_KEY")

def search_image(image_url):

    params = {
        "engine": "google_reverse_image",
        "image_url": image_url,
        "api_key": SERPAPI_KEY
    }

    url = "https://serpapi.com/search"

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
