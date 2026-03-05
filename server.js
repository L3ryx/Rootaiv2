require("dotenv").config()

const express = require("express")
const multer = require("multer")
const axios = require("axios")
const FormData = require("form-data")
const cheerio = require("cheerio")
const cors = require("cors")

const { OpenAI } = require("openai")

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static("public"))

const upload = multer({ storage: multer.memoryStorage() })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const SERPAPI_KEY = process.env.SERPAPI_KEY
const IMGBB_KEY = process.env.IMGBB_KEY

// upload image to imgbb

async function uploadToImgBB(buffer) {

  const form = new FormData()

  form.append("image", buffer.toString("base64"))

  const res = await axios.post(
    `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
    form,
    { headers: form.getHeaders() }
  )

  return res.data.data.url
}

// serpapi search

async function searchAliExpress(imageUrl) {

  const res = await axios.get("https://serpapi.com/search.json", {
    params: {
      engine: "google_lens",
      url: imageUrl,
      api_key: SERPAPI_KEY
    }
  })

  const results = res.data.visual_matches || []

  return results
    .filter(r => r.link.includes("aliexpress"))
    .slice(0, 10)
}

// scrape product images

async function extractAliImages(url) {

  const res = await axios.get(url)

  const $ = cheerio.load(res.data)

  let images = []

  $("img").each((i, el) => {

    const src = $(el).attr("src")

    if (src && src.includes("alicdn")) {
      images.push(src)
    }

  })

  return images.slice(0, 10)
}

// openai vision comparison

async function compareImages(img1, img2) {

  const response = await openai.chat.completions.create({

    model: "gpt-4.1-mini",

    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Compare these images and return similarity percentage only." },
          { type: "image_url", image_url: { url: img1 } },
          { type: "image_url", image_url: { url: img2 } }
        ]
      }
    ]

  })

  const text = response.choices[0].message.content

  const percent = parseInt(text.replace(/\D/g, ""))

  return percent
}

// main route

app.post("/search", upload.single("image"), async (req, res) => {

  try {

    const imageUrl = await uploadToImgBB(req.file.buffer)

    const aliResults = await searchAliExpress(imageUrl)

    let matches = []

    for (const item of aliResults) {

      const images = await extractAliImages(item.link)

      for (const img of images) {

        const score = await compareImages(imageUrl, img)

        if (score >= 70) {

          matches.push({
            similarity: score,
            product: item.link,
            image: img
          })

        }

      }

    }

    res.json(matches)

  } catch (error) {

    console.error(error)
    res.status(500).send("error")

  }

})

app.listen(3000, () => {
  console.log("Server running")
})
