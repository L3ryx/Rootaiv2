// ======================================================
// AUTH CHECK (RUN ON EVERY PAGE)
// ======================================================

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token) {
  window.location = "/login.html";
} else {
  fetch("/api/verify", {
    method: "GET",
    headers: {
      "Authorization": token
    }
  })
  .then(res => {
    if (!res.ok) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      window.location = "/login.html";
    }
  });
}

// ======================================================
// LOGOUT
// ======================================================

async function logout() {

  await fetch("/api/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });

  localStorage.clear();
  window.location = "/login.html";
}
