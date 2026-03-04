const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

/*
========================================
MULTER CONFIG
========================================
*/
const storage = multer.memoryStorage();
const upload = multer({ storage });

/*
========================================
ROUTE: IMAGE ANALYSIS
========================================
*/
app.post("/analyze", upload.array("images"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    const results = [];

    // Traiter les images une par une (async séquentiel)
    for (const file of req.files) {
      console.log(`Processing image: ${file.originalname}`);

      try {
        /*
        IMPORTANT:
        Zenserp nécessite une image accessible publiquement pour la recherche reverse.
        Ici nous simulons une recherche via Google Images en utilisant un upload temporaire
        ou base64 selon le plan Zenserp.
        
        Si Zenserp demande une URL publique :
        -> Il faudra uploader l'image vers un service comme Cloudinary
        -> Puis envoyer l'URL publique à Zenserp
        */

        // Exemple recherche Google Images via Zenserp
        const response = await axios.get("https://app.zenserp.com/api/v2/search", {
          params: {
            apikey: process.env.ZENSERP_API_KEY,
            q: "site:aliexpress.com",
            tbm: "isch"
          }
        });

        const data = response.data;

        // Extraire uniquement les liens contenant aliexpress.com
        const aliexpressLinks = [];

        if (data.organic) {
          data.organic.forEach(result => {
            if (result.link && result.link.includes("aliexpress.com")) {
              aliexpressLinks.push(result.link);
            }
          });
        }

        results.push({
          imageName: file.originalname,
          aliexpressLinks
        });

      } catch (err) {
        results.push({
          imageName: file.originalname,
          error: "Error processing this image"
        });
      }
    }

    res.json({ results });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

/*
========================================
START SERVER
========================================
*/
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
