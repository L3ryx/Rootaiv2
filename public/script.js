const token = localStorage.getItem("token");
if (!token) window.location = "/login.html";

let files = [];

document.getElementById("imageInput").addEventListener("change", e => {
  files = Array.from(e.target.files);

  const preview = document.getElementById("preview");
  preview.innerHTML = "";

  files.forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "preview-img";
    preview.appendChild(img);
  });

});

async function uploadImages() {
  alert("Images ready");
}

async function startSearch() {

  const formData = new FormData();

  files.forEach(f => formData.append("images", f));
  formData.append("token", token);

  const res = await fetch("/analyze", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  document.getElementById("results").innerText =
    JSON.stringify(data, null, 2);
}

async function logout() {

  await fetch("/api/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });

  localStorage.removeItem("token");
  window.location = "/login.html";
}
