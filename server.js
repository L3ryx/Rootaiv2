const express = require("express");
const multer = require("multer");
const puppeteer = require("puppeteer");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/analyze", upload.array("images"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No images uploaded" });
  }

  const results = [];

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  for (const file of req.files) {
    const page = await browser.newPage();

    try {
      console.log("Processing:", file.originalname);

      const tempPath = path.join(os.tmpdir(), file.originalname);
      fs.writeFileSync(tempPath, file.buffer);

      await page.goto("https://www.aliexpress.com/", {
        waitUntil: "networkidle2"
      });

      // Attendre champ upload
      await page.waitForSelector('input[type="file"]', { timeout: 15000 });

      const inputUploadHandle = await page.$('input[type="file"]');
      await inputUploadHandle.uploadFile(tempPath);

      // Attendre résultats
      await page.waitForTimeout(6000);

      const products = await page.evaluate(() => {
        const items = [];
        const links = document.querySelectorAll("a[href*='/item/']");

        links.forEach(el => {
          const title = el.innerText;
          const url = el.href;
          const img = el.querySelector("img")?.src || null;

          if (title && url) {
            items.push({
              title,
              url,
              image: img
            });
          }
        });

        return items.slice(0, 10);
      });

      results.push({
        imageName: file.originalname,
        products
      });

      await page.close();
      fs.unlinkSync(tempPath);

    } catch (err) {
      console.error(err);

      results.push({
        imageName: file.originalname,
        error: "Search failed (captcha or block)"
      });

      await page.close();
    }
  }

  await browser.close();

  res.json({ results });
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
