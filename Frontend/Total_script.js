// ... Existing declarations unchanged ...
let canvas = document.getElementById("imageCanvas");
let ctx = canvas.getContext("2d");
let originalMat = null;
let currentMat = null;
let imageHistory = [];
let appliedOperations = new Map();

let cvReady = false;
let freehandBlurActive = false;
let drawing = false;
let blurMask = null;
let preBlurSnapshot = null;

function onOpenCvReady() {
  cvReady = true;
  appendMessage("🤖", " Please upload an image.");
}

document.getElementById("imageInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    originalMat = cv.matFromImageData(imgData);
    currentMat?.delete();
    currentMat = originalMat.clone();
    imageHistory = [currentMat.clone()];
    appliedOperations.clear();
    appendMessage("🤖", "✅ Image uploaded.");
    initBlurMask();
  };
  img.src = URL.createObjectURL(file);
});

function initBlurMask() {
  if (blurMask) blurMask.delete();           //selecting the points to blur
  blurMask = new cv.Mat.zeros(canvas.height, canvas.width, cv.CV_8UC1);
}

// --- Canvas Drawing Events ---
canvas.addEventListener("mousedown", (e) => {
  if (!freehandBlurActive || !originalMat) return;
  drawing = true;
  drawOnMask(e);
});
canvas.addEventListener("mousemove", (e) => {
  if (!drawing || !freehandBlurActive) return;
  drawOnMask(e);
});
canvas.addEventListener("mouseup", async () => {
  if (!freehandBlurActive || !drawing) return;
  drawing = false;
  await applyFreehandBlur();
});
canvas.addEventListener("mouseleave", () => {
  if (!freehandBlurActive || !drawing) return;
  drawing = false;
});

// --- Draw to Blur ---
function drawOnMask(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.round((e.clientX - rect.left) * scaleX);
  const y = Math.round((e.clientY - rect.top) * scaleY);

  cv.circle(blurMask, new cv.Point(x, y), 15, new cv.Scalar(255), -1);
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(0,0,255,0.2)";
  ctx.fill();
}

async function applyFreehandBlur() {
  if (!originalMat || !blurMask) return;
  if (!preBlurSnapshot) preBlurSnapshot = currentMat.clone();

  let blurred = new cv.Mat();
  cv.GaussianBlur(currentMat, blurred, new cv.Size(21, 21), 0);

  let result = new cv.Mat();
  let invertedMask = new cv.Mat();
  cv.bitwise_not(blurMask, invertedMask);

  let fg = new cv.Mat();
  let bg = new cv.Mat();
  cv.bitwise_and(currentMat, currentMat, fg, invertedMask);
  cv.bitwise_and(blurred, blurred, bg, blurMask);
  cv.add(fg, bg, result);

  currentMat.delete();
  currentMat = result;

  fg.delete(); bg.delete(); blurred.delete(); invertedMask.delete();
  blurMask.setTo(new cv.Scalar(0));

  updateCanvas(currentMat);
  appliedOperations.set("freehandBlur", true);
  saveState();
  appendMessage("🤖", "Freehand blur applied.");
}

function toggleFreehandBlur() {
  if (!originalMat) return alert("Upload an image first.");
  freehandBlurActive = !freehandBlurActive;
  appendMessage("🤖", `Freehand blur ${freehandBlurActive ? "enabled" : "disabled"}.`);
}

function updateCanvas(mat) {
  let imgData = new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
  ctx.putImageData(imgData, 0, 0);
}

function saveState() {
  imageHistory.push(currentMat.clone());
}

// --- Image Operations ---
function applyBlur(intensity = "medium") {
  let ksize;
  switch (intensity) {
    case "low": ksize = new cv.Size(3, 3); break;
    case "medium": ksize = new cv.Size(7, 7); break;
    case "high": ksize = new cv.Size(15, 15); break;
    default: ksize = new cv.Size(7, 7);
  }
  let dst = new cv.Mat();
  cv.GaussianBlur(currentMat, dst, ksize, 0, 0, cv.BORDER_DEFAULT);
  currentMat.delete();
  currentMat = dst;
}

function applyBrightness(intensity = "medium") {
  let alpha = 1.0, beta;
  switch (intensity) {
    case "low": beta = 30; break;
    case "medium": beta = 60; break;
    case "high": beta = 90; break;
    default: beta = 60;
  }
  let dst = new cv.Mat();
  currentMat.convertTo(dst, -1, alpha, beta);
  currentMat.delete();
  currentMat = dst;
}

function applyContrast(intensity = "medium") {
  let alpha;
  switch (intensity) {
    case "low": alpha = 1.3; break;
    case "medium": alpha = 1.6; break;
    case "high": alpha = 2.0; break;
    default: alpha = 1.6;
  }
  let dst = new cv.Mat();
  currentMat.convertTo(dst, -1, alpha, 0);
  currentMat.delete();
  currentMat = dst;
}

function applySharpen() {
  let dst = new cv.Mat();
  let kernel = cv.matFromArray(3, 3, cv.CV_32F, [0, -1, 0, -1, 9, -1, 0, -1, 0]);
  cv.filter2D(currentMat, dst, -1, kernel);
  kernel.delete();
  currentMat.delete();
  currentMat = dst;
}

function applyGrayscale() {
  let dst = new cv.Mat();
  cv.cvtColor(currentMat, dst, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);
  currentMat.delete();
  currentMat = dst;
}

function applyFlip(direction = "horizontal") {
  let dst = new cv.Mat();
  let flipCode = direction === "vertical" ? 0 : 1;
  cv.flip(currentMat, dst, flipCode);
  currentMat.delete();
  currentMat = dst;
}

function applyCanny() {
  let gray = new cv.Mat();
  let edges = new cv.Mat();
  cv.cvtColor(currentMat, gray, cv.COLOR_RGBA2GRAY);
  cv.Canny(gray, edges, 50, 150);
  cv.cvtColor(edges, edges, cv.COLOR_GRAY2RGBA);
  gray.delete();
  currentMat.delete();
  currentMat = edges;
}

function applySobel() {
  let gray = new cv.Mat();
  let gradX = new cv.Mat();
  let gradY = new cv.Mat();
  let absX = new cv.Mat();
  let absY = new cv.Mat();
  let dst = new cv.Mat();

  cv.cvtColor(currentMat, gray, cv.COLOR_RGBA2GRAY);
  cv.Sobel(gray, gradX, cv.CV_16S, 1, 0);
  cv.convertScaleAbs(gradX, absX);
  cv.Sobel(gray, gradY, cv.CV_16S, 0, 1);
  cv.convertScaleAbs(gradY, absY);
  cv.addWeighted(absX, 0.5, absY, 0.5, 0, dst);
  cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);

  gray.delete(); gradX.delete(); gradY.delete(); absX.delete(); absY.delete();
  currentMat.delete();
  currentMat = dst;
}

function applyPencilSketch() {
  let gray = new cv.Mat();
  let inv = new cv.Mat();
  let blur = new cv.Mat();
  let blend = new cv.Mat();

  cv.cvtColor(currentMat, gray, cv.COLOR_RGBA2GRAY);
  cv.bitwise_not(gray, inv);
  cv.GaussianBlur(inv, blur, new cv.Size(21, 21), 0);
  cv.divide(gray, cv.bitwise_not(blur), blend, 256);
  cv.cvtColor(blend, blend, cv.COLOR_GRAY2RGBA);

  gray.delete(); inv.delete(); blur.delete();
  currentMat.delete();
  currentMat = blend;
}

// --- Operation Dispatcher ---
function applyOperation(op) {
  const { type, intensity, direction } = op;

  switch (type) {
    case "blur": handleBlur(intensity); break;
    case "brightness": handleBrightness(intensity); break;
    case "contrast": handleContrast(intensity); break;
    case "sharpen": handleSharpen(); break;
    case "grayscale": handleGrayscale(); break;
    case "flip": handleFlip(direction); break;
    case "canny": handleCanny(); break;
    case "sobel": handleSobel(); break;
    case "pencil": handlePencilSketch(); break;
    default: appendMessage("🤖", `⚠️ Operation '${type}' not supported yet.`);
  }
}

// --- Handlers for UI buttons ---
function handleBlur(intensity) {
  if (!originalMat) return alert("Upload an image first.");
  if (appliedOperations.has("blur")) return alert("Blur already applied. Clear first.");
  applyBlur(intensity);
  appliedOperations.set("blur", intensity);
  saveState(); updateCanvas(currentMat);
  appendMessage("🤖", `Blur (${intensity}) applied.`);
}

function handleBrightness(intensity) {
  if (!originalMat) return alert("Upload an image first.");
  if (appliedOperations.has("brightness")) return alert("Brightness already applied. Clear first.");
  applyBrightness(intensity);
  appliedOperations.set("brightness", intensity);
  saveState(); updateCanvas(currentMat);
  appendMessage("🤖", `Brightness (${intensity}) applied.`);
}

function handleContrast(intensity) {
  if (!originalMat) return alert("Upload an image first.");
  if (appliedOperations.has("contrast")) return alert("Contrast already applied. Clear first.");
  applyContrast(intensity);
  appliedOperations.set("contrast", intensity);
  saveState(); updateCanvas(currentMat);
  appendMessage("🤖", `Contrast (${intensity}) applied.`);
}

function handleSharpen() {
  if (!originalMat) return alert("Upload an image first.");
  if (appliedOperations.has("sharpen")) return alert("Sharpen already applied. Clear first.");
  applySharpen();
  appliedOperations.set("sharpen", true);
  saveState(); updateCanvas(currentMat);
  appendMessage("🤖", "Sharpen applied.");
}

function handleGrayscale() {
  if (!originalMat) return alert("Upload an image first.");
  if (appliedOperations.has("grayscale")) return alert("Grayscale already applied. Clear first.");
  applyGrayscale();
  appliedOperations.set("grayscale", true);
  saveState(); updateCanvas(currentMat);
  appendMessage("🤖", "Grayscale applied.");
}

function handleFlip(direction) {
  if (!originalMat) return alert("Upload an image first.");
  const key = direction === "horizontal" ? "flipH" : "flipV";
  if (appliedOperations.has(key)) return alert(`Flip (${direction}) already applied. Clear first.`);
  applyFlip(direction);
  appliedOperations.set(key, true);
  saveState(); updateCanvas(currentMat);
  appendMessage("🤖", `Flip (${direction}) applied.`);
}

function handleCanny() {
  if (!originalMat) return alert("Upload an image first.");
  applyCanny();
  appliedOperations.set("canny", true);
  saveState(); updateCanvas(currentMat);
  appendMessage("🤖", "Canny edge detection applied.");
}

function handleSobel() {
  if (!originalMat) return alert("Upload an image first.");
  applySobel();
  appliedOperations.set("sobel", true);
  saveState(); updateCanvas(currentMat);
  appendMessage("🤖", "Sobel edge detection applied.");
}

function handlePencilSketch() {
  if (!originalMat) return alert("Upload an image first.");
  applyPencilSketch();
  appliedOperations.set("pencil", true);
  saveState(); updateCanvas(currentMat);
  appendMessage("🤖", "Pencil sketch effect applied.");
}


// --- Clear Operation ---

function clearFreehandMask() {
  if (!preBlurSnapshot) {
    appendMessage("🤖", "No freehand blur to clear.");
    return;
  }

  currentMat.delete();
  currentMat = preBlurSnapshot.clone();
  preBlurSnapshot.delete();
  preBlurSnapshot = null;

  blurMask.setTo(new cv.Scalar(0)); // Clear the mask
  appliedOperations.delete("freehandBlur");

  updateCanvas(currentMat);
  appendMessage("🤖", "All freehand blurs cleared.");
}



function clearSingleOperation(type) {
  if (!originalMat) return alert("Upload an image first.");

  currentMat.delete();
  currentMat = originalMat.clone();

  if (type === "flip") {
    appliedOperations.delete("flipH");
    appliedOperations.delete("flipV");
  } else {
    appliedOperations.delete(type);
  }

  const operationsToReapply = Array.from(appliedOperations.entries());
  appliedOperations.clear();

  for (const [opType, value] of operationsToReapply) {
    if (opType === "flipH") applyOperation({ type: "flip", direction: "horizontal" });
    else if (opType === "flipV") applyOperation({ type: "flip", direction: "vertical" });
    else if (opType === "freehandBlur") {
      // skip reapplying freehand blur
      continue;
    }
    else applyOperation({ type: opType, intensity: value });
  }

  updateCanvas(currentMat);
  if (type === "freehandBlur") {
    initBlurMask(); // <-- Reset the mask
    appendMessage("🤖", "Freehand blur cleared.");
  } else {
    appendMessage("🤖", `${type} cleared.`);
  }
}



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
