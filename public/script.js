// ======================================================
// FORCE AUTH VERIFICATION (SECURITY IMPROVED)
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {

  const token = localStorage.getItem("token");

  if (!token) {
    redirectToLogin();
    return;
  }

  try {

    const res = await fetch("/api/verify", {
      method: "GET",
      headers: {
        "Authorization": token
      }
    });

    if (!res.ok) {

      // ❌ Token invalide → suppression immédiate
      localStorage.clear();
      redirectToLogin();
    }

  } catch (err) {
    console.error("Verification error:", err);
    redirectToLogin();
  }

});

function redirectToLogin() {
  if (window.location.pathname !== "/login.html") {
    window.location = "/login.html";
  }
}

// ======================================================
// LOGOUT SECURE
// ======================================================

async function logout(){

  const token = localStorage.getItem("token");

  await fetch("/api/logout",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({ token })
  });

  localStorage.clear();
  window.location="/login.html";
}
