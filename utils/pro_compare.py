import torch
from utils.vision_compare import get_embedding


def cosine_similarity(a, b):

    a = torch.nn.functional.normalize(a, dim=1)
    b = torch.nn.functional.normalize(b, dim=1)

    return torch.mm(a, b.T).item()


def compare_images(image1_url, image2_url):

    emb1 = get_embedding(image1_url)
    emb2 = get_embedding(image2_url)

    similarity = cosine_similarity(emb1, emb2)

    # Convert to percentage
    similarity_percent = round(similarity * 100, 2)

    return similarity_percent
