const socket = io();
let socketId = null;

socket.on("connected", (data) => {
  socketId = data.socketId;
});

socket.on("progress", (data) => {

  const progressDiv = document.getElementById("progress");

  const p = document.createElement("p");
  p.textContent = data.message;

  progressDiv.appendChild(p);

});

const form = document.getElementById("uploadForm");

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  const formData = new FormData(form);
  formData.append("socketId", socketId);

  const response = await fetch("/analyze", {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  console.log(data);
});
