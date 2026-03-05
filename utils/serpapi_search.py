import os
import requests


def search_aliexpress_images(file):

    api_key = os.getenv("SERPAPI_KEY")

    query = "aliexpress product"

    url = "https://serpapi.com/search"

    params = {
        "engine": "google_images",
        "q": query,
        "api_key": api_key
    }

    response = requests.get(url, params=params)
    results = response.json()

    items = []

    for item in results.get("images_results", [])[:10]:

        link = item.get("link", "")

        if "aliexpress" in link:

            items.append({
                "title": item.get("title"),
                "url": link,
                "image": item.get("thumbnail")
            })

    return items
