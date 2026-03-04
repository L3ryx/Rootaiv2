const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token) {
  window.location = "/login";
}

// ==============================
// ADMIN BUTTON
// ==============================

const adminBtn = document.getElementById("adminBtn");

if (role === "admin") {
  adminBtn.style.display = "block";
  adminBtn.onclick = () => window.location = "/admin";
}

// ==============================
// IMAGE UPLOAD
// ==============================

let files = [];

document.getElementById("imageInput").addEventListener("change", e => {

  files = Array.from(e.target.files);

  const preview = document.getElementById("preview");
  preview.innerHTML = "";

  files.forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.width = 200;
    preview.appendChild(img);
  });

});

async function uploadImages() {

  const formData = new FormData();

  files.forEach(f => formData.append("images", f));

  const res = await fetch("/analyze", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  document.getElementById("results").innerText =
    JSON.stringify(data, null, 2);
}

// ==============================
// LOGOUT
// ==============================

async function logout() {

  await fetch("/api/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });

  localStorage.clear();
  window.location = "/login";
}
