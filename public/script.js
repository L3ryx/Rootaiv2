const form = document.getElementById("uploadForm");
const resultsDiv = document.getElementById("results");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  resultsDiv.innerHTML = "Analyse en cours...";

  const formData = new FormData(form);

  const response = await fetch("/analyze", {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  resultsDiv.innerHTML = "";

  data.results.forEach(result => {
    const card = document.createElement("div");
    card.className = "result-card";

    let html = `<h3>${result.imageName}</h3>`;

    if (result.aliexpressLinks && result.aliexpressLinks.length > 0) {
      html += "<ul>";
      result.aliexpressLinks.forEach(link => {
        html += `<li><a href="${link}" target="_blank">${link}</a></li>`;
      });
      html += "</ul>";
    } else {
      html += "<p>Aucun produit AliExpress trouvé</p>";
    }

    card.innerHTML = html;
    resultsDiv.appendChild(card);
  });
});
