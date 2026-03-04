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

    if (result.products && result.products.length > 0) {
      result.products.forEach(product => {
        html += `
          <div>
            <img src="${product.image}" width="120"/>
            <p>${product.title}</p>
            <a href="${product.url}" target="_blank">Voir produit</a>
          </div>
          <hr/>
        `;
      });
    } else {
      html += "<p>Aucun produit trouvé ou captcha détecté</p>";
    }

    card.innerHTML = html;
    resultsDiv.appendChild(card);
  });
});
