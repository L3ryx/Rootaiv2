// ======================================================
// ALI SEARCH AI - PRO VERSION
// ======================================================

const socket = io();
let socketId = null;

// ===============================
// SOCKET
// ===============================

socket.on("connected", (data) => {
  socketId = data.socketId;
});

// ===============================
// LOGIN SYSTEM
// ===============================

async function login() {

  const password = document.getElementById("passwordInput").value;

  const res = await fetch("/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password })
  });

  if (!res.ok) {
    alert("❌ Wrong password");
    return;
  }

  localStorage.setItem("loggedIn", "true");

  document.getElementById("loginSection").style.display = "none";
  document.getElementById("appSection").style.display = "block";
}

// Auto login if session exists
if (localStorage.getItem("loggedIn")) {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("appSection").style.display = "block";
}

// ===============================
// DOM ELEMENTS
// ===============================

const form = document.getElementById("uploadForm");
const logsDiv = document.getElementById("logs");
const resultsDiv = document.getElementById("results");
const progressBar = document.querySelector(".progress-bar");

// ===============================
// LIVE LOGS
// ===============================

socket.on("log", (data) => {

  const line = document.createElement("div");

  line.innerHTML = `
    <span style="color:gray">
      [${new Date(data.time).toLocaleTimeString()}]
    </span>
    <span class="log-${data.type}">
      ${data.message}
    </span>
  `;

  logsDiv.appendChild(line);
  logsDiv.scrollTop = logsDiv.scrollHeight;

});

// ===============================
// ANALYZE
// ===============================

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  logsDiv.innerHTML = "";
  resultsDiv.innerHTML = "";

  const files = document.querySelector("input[type=file]").files;

  if (!files.length) {
    alert("Select images first");
    return;
  }

  progressBar.style.width = "0%";

  const formData = new FormData();

  for (const file of files) {
    formData.append("images", file);
  }

  formData.append("socketId", socketId);

  progressBar.style.width = "30%";

  const response = await fetch("/analyze", {
    method: "POST",
    body: formData
  });

  progressBar.style.width = "80%";

  const data = await response.json();

  displayResults(data.results);

  progressBar.style.width = "100%";

  setTimeout(() => {
    progressBar.style.width = "0%";
  }, 800);

});

// ===============================
// DISPLAY RESULTS
// ===============================

function displayResults(results) {

  if (!results || results.length === 0) {

    resultsDiv.innerHTML =
      "<h3 style='color:red'>❌ No results</h3>";

    return;
  }

  results.forEach(result => {

    const card = document.createElement("div");
    card.className = "product-card";

    let html = `
      <h3>📷 ${result.image}</h3>
    `;

    if (!result.matches || result.matches.length === 0) {

      html += `
        <p style="color:red">
          ❌ No match ≥60%
        </p>
      `;

    } else {

      result.matches.forEach(match => {

        html += `
          <div class="product-item">
            <p>🔥 Match: ${match.similarity}%</p>
            <a href="${match.url}" target="_blank">
              🔗 Open Product
            </a>
          </div>
        `;
      });

    }

    card.innerHTML = html;
    resultsDiv.appendChild(card);

  });

}
