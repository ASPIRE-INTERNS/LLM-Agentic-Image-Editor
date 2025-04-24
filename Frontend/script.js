const canvas = document.getElementById("imageCanvas");
const ctx = canvas.getContext("2d");
let originalImage;

canvas.width = 350;
canvas.height = 350;



document.getElementById("imageInput").addEventListener("change", e => {
  const file = e.target.files[0];
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    originalImage = img;
  };
  img.src = URL.createObjectURL(file);
});

function submitImage() {
  const file = document.getElementById("imageInput").files[0];
  const prompt = document.getElementById("promptInput").value;
  const formData = new FormData();
  formData.append("image", file);
  formData.append("prompt", prompt);

  fetch("http://localhost:8000/edit-image", {
    method: "POST",
    body: formData
  })
    .then(res => res.blob())
    .then(blob => {
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = URL.createObjectURL(blob);
    });
}

function downloadPNG() {
  const link = document.createElement("a");
  link.download = "edited_image.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function downloadPDF() {
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF();
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
  pdf.save("edited_image.pdf");
}


let toolsDisplayed = false;
let lastToolMessage;

function clearLastToolMessage() {
  if (lastToolMessage) {
    lastToolMessage.remove();
    lastToolMessage = null;
  }
}

function appendMessage(sender, text, buttons = [], backAction = null) {
  clearLastToolMessage();
  const chatBody = document.getElementById("chatBody");
  const message = document.createElement("div");
  message.className = "message";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = text;

  if (backAction) {
    const backBtn = document.createElement("button");
    backBtn.textContent = "⬅ Back";
    backBtn.className = "option-btn";
    backBtn.onclick = backAction;
    bubble.appendChild(document.createElement("br"));
    bubble.appendChild(backBtn);
  }

  if (buttons.length > 0) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexWrap = "wrap";
    container.style.gap = "9px";

    buttons.forEach(btn => {
      const button = document.createElement("button");
      button.textContent = btn.label;
      button.className = "option-btn";
      button.onclick = btn.action;
      container.appendChild(button);
    });

    bubble.appendChild(document.createElement("br"));
    bubble.appendChild(container);
  }

  message.appendChild(avatar);
  message.appendChild(bubble);
  chatBody.appendChild(message);

  chatBody.scrollTop = chatBody.scrollHeight;
  lastToolMessage = message;
}

function handlePrompt(presetPrompt) {
  document.getElementById("promptInput").value = presetPrompt;
  submitImage();
}

function showAvailableTools() {
  toolsDisplayed = true;
  appendMessage("🤖", `✅ Here's what I can help you with:`, [
    { label: "Rotate", action: showRotateOptions }, 
    { label: "Blur", action: showBlurOptions },
    { label: "Grayscale", action: () => handlePrompt("Convert to Grayscale") },
  ]);
}

function showBlurOptions() {
  appendMessage("🤖", "Select blur intensity:", [
    { label: "Low Blur", action: () => handlePrompt("Apply low blur") },
    { label: "Medium Blur", action: () => handlePrompt("Apply medium blur") },
    { label: "High Blur", action: () => handlePrompt("Apply high blur") }
  ], showAvailableTools);
}

function showRotateOptions() {
  appendMessage("🤖", "Select rotation angle:", [
    { label: "90°", action: () => handlePrompt("Rotate 90 degrees") },
    { label: "180°", action: () => handlePrompt("Rotate 180 degrees") },
    { label: "270°", action: () => handlePrompt("Rotate 270 degrees") }
  ], showAvailableTools);
}
