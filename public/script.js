// ==============================
// LOGIN
// ==============================

async function login() {

  const password = document.getElementById("passwordInput").value;

  const res = await fetch("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });

  if (!res.ok) {
    alert("Wrong password");
    return;
  }

  localStorage.setItem("loggedIn", "true");

  document.getElementById("loginSection").style.display = "none";
  document.getElementById("toolSection").style.display = "block";
}

// Auto login
if (localStorage.getItem("loggedIn")) {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("toolSection").style.display = "block";
}

// ==============================
// IMAGE PREVIEW
// ==============================

const input = document.getElementById("imageInput");
const preview = document.getElementById("preview");
let selectedFiles = [];

input.addEventListener("change", () => {

  preview.innerHTML = "";
  selectedFiles = Array.from(input.files);

  selectedFiles.forEach((file, index) => {

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "preview-img";

    const container = document.createElement("div");
    container.className = "image-block";
    container.appendChild(img);

    const progress = document.createElement("div");
    progress.className = "progress-bar";
    progress.id = "progress-" + index;

    container.appendChild(progress);
    preview.appendChild(container);

  });

});

// ==============================
// START SEARCH
// ==============================

async function startSearch() {

  if (selectedFiles.length === 0) {
    alert("Upload images first");
    return;
  }

  const formData = new FormData();

  selectedFiles.forEach(file => {
    formData.append("images", file);
  });

  const socketId = "";

  formData.append("socketId", socketId);

  const response = await fetch("/analyze", {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  updateProgressBars(data.results);
}

// ==============================
// UPDATE PROGRESS BAR
// ==============================

function updateProgressBars(results) {

  results.forEach((result, index) => {

    const progress = document.getElementById("progress-" + index);

    if (!progress) return;

    let percent = 0;

    if (result.matches && result.matches.length > 0) {
      percent = 100;
    }

    progress.style.width = percent + "%";
  });
}
