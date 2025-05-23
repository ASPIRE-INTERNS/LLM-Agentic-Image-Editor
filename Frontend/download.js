// --- Chat Prompt to Backend ---
async function submitPrompt() {
  if (!cvReady) return alert("OpenCV.js is not ready yet.");
  const prompt = document.getElementById("promptInput").value.trim();
  if (!prompt) return alert("Please enter a prompt.");
  if (!originalMat) return alert("Please upload an image.");
  appendMessage("🧑", prompt);
  appendMessage("🤖", "Processing your prompt...");

  try {
    const res = await fetch("http://localhost:3000/generate-operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error("Backend error");
    const data = await res.json();

    if (!data.operations) {
      appendMessage("🤖", "❌ Invalid operations returned from backend.");
      return;
    }

    currentMat.delete();
    currentMat = originalMat.clone();
    appliedOperations.clear();

    for (const op of data.operations) {
      await applyOperation(op);
    }
    updateCanvas(currentMat);
    saveState();

  } catch (e) {
    console.error(e);
    appendMessage("🤖", "❌ Failed to get operations from backend.");
  }
}

// --- Chat UI ---
function appendMessage(sender, text) {
  const chatBody = document.getElementById("chatBody");
  const message = document.createElement("div");
  message.classList.add("message", sender === "🤖" ? "bot-message" : "user-message");
  message.innerHTML = `<strong>${sender}</strong>: ${text}`;
  chatBody.appendChild(message);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// --- Downloads ---

function downloadPNG() {
  const link = document.createElement("a");
  link.download = "edited-image.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}


function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const imgData = canvas.toDataURL("image/png");
  const img = new Image();
  img.src = imgData;

  img.onload = () => {
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (img.height * pdfWidth) / img.width;
    pdf.addImage(img, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("edited_image.pdf");
  };

  img.onerror = () => {
    alert("Failed to load image for PDF.");
  };
}



// --- Toggle Tool Sub-options ---
function toggleSubOptions(id) {
  document.querySelectorAll('.sub-options').forEach(el => {
    if (el.id !== id) el.style.display = 'none';
  });
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function hideSubOptions(id) {
  document.getElementById(id).style.display = 'none';
}
