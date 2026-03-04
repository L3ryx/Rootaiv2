// ======================================================
// ALI SEARCH AI - ADMIN PANEL
// PRO VERSION
// ======================================================

// ===============================
// ELEMENTS
// ===============================

const passwordInput = document.getElementById("adminPassword");
const serpInput = document.getElementById("serpapi");
const openaiInput = document.getElementById("openai");
const imgbbInput = document.getElementById("imgbb");
const logsContainer = document.getElementById("logsHistory");

// ===============================
// LOAD CONFIG FROM SERVER
// ===============================

async function loadConfig() {

  const password = passwordInput.value;

  if (!password) {
    alert("Enter admin password first");
    return;
  }

  const res = await fetch("/api/config?password=" + password);

  if (!res.ok) {
    alert("Unauthorized");
    return;
  }

  const config = await res.json();

  serpInput.value = config.SERPAPI_KEY || "";
  openaiInput.value = config.OPENAI_KEY || "";
  imgbbInput.value = config.IMGBB_KEY || "";

  loadLogs(password);

}

// ===============================
// SAVE CONFIG
// ===============================

async function saveConfig() {

  const password = passwordInput.value;

  const config = {
    SERPAPI_KEY: serpInput.value,
    OPENAI_KEY: openaiInput.value,
    IMGBB_KEY: imgbbInput.value
  };

  const res = await fetch("/api/config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      password,
      config
    })
  });

  if (!res.ok) {
    alert("Unauthorized");
    return;
  }

  alert("✅ API Keys Saved Successfully");

}

// ===============================
// LOAD LOG HISTORY
// ===============================

async function loadLogs(password) {

  try {

    const res = await fetch("/api/logs?password=" + password);

    if (!res.ok) return;

    const logs = await res.json();

    logsContainer.innerHTML = "";

    logs.forEach(log => {

      const logLine = document.createElement("div");

      logLine.style.padding = "5px";
      logLine.style.borderBottom = "1px solid #333";

      logLine.innerHTML = `
        <span style="color:gray">
          [${new Date(log.time).toLocaleTimeString()}]
        </span>
        <span style="color:white">
          ${log.message}
        </span>
      `;

      logsContainer.appendChild(logLine);

    });

  } catch (err) {
    console.log("Failed to load logs");
  }

}

// ===============================
// AUTO REFRESH LOGS EVERY 5s
// ===============================

setInterval(() => {

  if (passwordInput.value) {
    loadLogs(passwordInput.value);
  }

}, 5000);
