// ======================================================
// ALI SEARCH AI - SCRIPT.JS
// PRO VERSION
// ======================================================

// ===============================
// ELEMENTS
// ===============================

const form = document.getElementById("uploadForm");
const logsDiv = document.getElementById("logs");
const resultsDiv = document.getElementById("results");
const loadingBar = document.querySelector(".loading-bar");

// ===============================
// SOCKET CONNECTION
// ===============================

const socket = io();
let socketId = null;

socket.on("connected", (data) => {
  socketId = data.socketId;
  console.log("🟢 Socket connected:", socketId);
});

// ===============================
// LIVE LOGS
// ===============================

socket.on("log", (data) => {

  const line = document.createElement("div");

  line.innerHTML = `
    <span style="color:gray">[${new Date(data.time).toLocaleTimeString()}]</span>
    <span class="log-${data.type}">
      ${data.message}
    </span>
  `;

  logsDiv.appendChild(line);
  logsDiv.scrollTop = logsDiv.scrollHeight;

});

// ===============================
// LOADING BAR ANIMATION
// ===============================

function startLoading() {
  loadingBar.style.width = "0%";

  let progress = 0;

  const interval = setInterval(() => {

    progress += 10;

    if (progress >= 90) {
      clearInterval(interval);
    }

    loadingBar.style.width = progress + "%";

  }, 300);
}

function stopLoading() {
  loadingBar.style.width = "100%";

  setTimeout(() => {
    loadingBar.style.width = "0%";
  }, 500);
}

// ===============================
// FORM SUBMIT
// ===============================

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  logsDiv.innerHTML = "";
  resultsDiv.innerHTML = "";

  const files = document.querySelector("input[type=file]").files;

  if (!files.length) {
    alert("Please select images");
    return;
  }

  const formData = new FormData();

  for (const file of files) {
    formData.append("images", file);
  }

  formData.append("socketId", socketId);

  startLoading();

  try {

    const response = await fetch("/analyze", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    displayResults(data.results);

  } catch (err) {

    logsDiv.innerHTML += `
      <div style="color:red">
        ❌ Request failed
      </div>
    `;

  }

  stopLoading();

});

// ===============================
// DISPLAY RESULTS
// ===============================

function displayResults(results) {

  if (!results || results.length === 0) {

    resultsDiv.innerHTML = `
      <h3 style="color:red">
        ❌ No results found
      </h3>
    `;

    return;
  }

  results.forEach(result => {

    const card = document.createElement("div");
    card.className = "result-card";

    let html = `
      <h3>📷 ${result.image}</h3>
    `;

    if (!result.matches || result.matches.length === 0) {

      html += `
        <p style="color:red">
          ❌ No AliExpress match ≥60%
        </p>
      `;

    } else {

      result.matches.forEach(match => {

        html += `
          <div class="product">
            <p>🔥 Similarity: ${match.similarity}%</p>
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
