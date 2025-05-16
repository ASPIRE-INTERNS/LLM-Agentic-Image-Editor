let canvas = document.getElementById("imageCanvas");
let ctx = canvas.getContext("2d");
let originalMat = null;
let currentMat = null;
let imageHistory = [];
let appliedOperations = new Map();
let lastToolMessage = null;


document.getElementById("imageInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    originalMat = cv.matFromImageData(imgData);
    currentMat = originalMat.clone();
    imageHistory = [currentMat.clone()];
    appliedOperations.clear();
    appendMessage("🤖", "✅ Image uploaded.");
  };
  img.src = URL.createObjectURL(file);
});
//display 
function updateCanvas(mat) {
  let imgData = new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
  ctx.putImageData(imgData, 0, 0);
}

function saveState() {
  imageHistory.push(currentMat.clone());
}

function handleOperation(op, level, applyFn, onReturnToMenu) {
  if (appliedOperations.has(op)) {
    const appliedLevel = appliedOperations.get(op);
    appendWarningMessage(`⚠️ <b>${op} - ${appliedLevel}</b> already applied. Please clear it first to change.`);
    return;
  }

  applyFn();
  saveState();
  appliedOperations.set(op, level);
  appendMessage("🤖", `✅ ${op} (${level}) applied.`);
  if (onReturnToMenu) onReturnToMenu();
}

function clearOperation(op, onReturnToMenu) {
  if (appliedOperations.has(op)) {
    appliedOperations.delete(op);
    recomputeImage();
    appendMessage("🤖", `🧹 ${op} has been cleared.`);
  } else {
    appendMessage("🤖", `❌ ${op} is not applied.`);
  }
  if (onReturnToMenu) onReturnToMenu();
}

function recomputeImage() {
  if (!originalMat) return;
  currentMat = originalMat.clone();
  for (let [op, level] of appliedOperations.entries()) {
    switch (op) {
      case "blur":
        applyBlur(getBlurKernel(level));
        break;
      case "contrast":
        applyContrast(getContrastAlpha(level));
        break;
      case "brightness":
        applyBrightness(getBrightnessBeta(level));
        break;
      case "sharpen":
        applySharpen(getSharpenStrength(level));
        break;
      case "flipH":
        applyFlip(1);
        break;
      case "flipV":
        applyFlip(0);
        break;
      case "canny":
        applyCanny();
        break;
      case "grayscale":
        applyGrayscale();
        break;
    }
  }
  updateCanvas(currentMat);
  saveState();
}

function showAvailableTools() {
  appendMessage("🤖", "Choose a tool:", [
    { label: "Blur", action: showBlurOptions },
    { label: "Contrast", action: showContrastOptions },
    { label: "Brightness", action: showBrightnessOptions },
    { label: "Sharpen", action: showSharpenOptions },
    { label: "Flip", action: showFlipOptions },
    { label: "Canny Edge", action: showCannyOptions },
    { label: "Grayscale", action: showGrayscaleOptions }
  ]);
}

// ----------- TOOL OPTIONS -----------

function showBlurOptions() {
  appendMessage("🤖", "Blur Levels:", [
    { label: "Low", action: () => handleOperation("blur", "Low", () => applyBlur(5), showBlurOptions) },
    { label: "Medium", action: () => handleOperation("blur", "Medium", () => applyBlur(15), showBlurOptions) },
    { label: "High", action: () => handleOperation("blur", "High", () => applyBlur(25), showBlurOptions) },
    { label: "❌ Clear", action: () => clearOperation("blur", showBlurOptions) },
    { label: "🔙 Back", action: showAvailableTools }
  ]);
}
function getBlurKernel(level) {
  return level === "Low" ? 5 : level === "Medium" ? 15 : 25;
}
function applyBlur(ksize) {
  let dst = new cv.Mat();
  cv.GaussianBlur(currentMat, dst, new cv.Size(ksize, ksize), 0, 0);
  currentMat = dst;
  updateCanvas(currentMat);
}

function showContrastOptions() {
  appendMessage("🤖", "Contrast Levels:", [
    { label: "Low", action: () => handleOperation("contrast", "Low", () => applyContrast(0.5), showContrastOptions) },
    { label: "Medium", action: () => handleOperation("contrast", "Medium", () => applyContrast(1.5), showContrastOptions) },
    { label: "High", action: () => handleOperation("contrast", "High", () => applyContrast(2.0), showContrastOptions) },
    { label: "❌ Clear", action: () => clearOperation("contrast", showContrastOptions) },
    { label: "🔙 Back", action: showAvailableTools }
  ]);
}
function getContrastAlpha(level) {
  return level === "Low" ? 0.5 : level === "Medium" ? 1.5 : 2.0;
}
function applyContrast(alpha) {
  let dst = new cv.Mat();
  currentMat.convertTo(dst, -1, alpha, 0);
  currentMat = dst;
  updateCanvas(currentMat);
}

function showBrightnessOptions() {
  appendMessage("🤖", "Brightness Levels:", [
    { label: "Low", action: () => handleOperation("brightness", "Low", () => applyBrightness(-20), showBrightnessOptions) },
    { label: "Medium", action: () => handleOperation("brightness", "Medium", () => applyBrightness(60), showBrightnessOptions) },
    { label: "High", action: () => handleOperation("brightness", "High", () => applyBrightness(90), showBrightnessOptions) },
    { label: "❌ Clear", action: () => clearOperation("brightness", showBrightnessOptions) },
    { label: "🔙 Back", action: showAvailableTools }
  ]);
}
function getBrightnessBeta(level) {
  return level === "Low" ? -20 : level === "Medium" ? 60 : 90;
}
function applyBrightness(beta) {
  let dst = new cv.Mat();
  currentMat.convertTo(dst, -1, 1, beta);
  currentMat = dst;
  updateCanvas(currentMat);
}

function showSharpenOptions() {
  appendMessage("🤖", "Sharpen Levels:", [
    { label: "Low", action: () => handleOperation("sharpen", "Low", () => applySharpen(1.2), showSharpenOptions) },
    { label: "Medium", action: () => handleOperation("sharpen", "Medium", () => applySharpen(1.5), showSharpenOptions) },
    { label: "High", action: () => handleOperation("sharpen", "High", () => applySharpen(2.0), showSharpenOptions) },
    { label: "❌ Clear", action: () => clearOperation("sharpen", showSharpenOptions) },
    { label: "🔙 Back", action: showAvailableTools }
  ]);
}
function getSharpenStrength(level) {
  return level === "Low" ? 1.2 : level === "Medium" ? 1.5 : 2.0;
}
function applySharpen(strength) {
  let kernel = cv.matFromArray(3, 3, cv.CV_32F, [
    0, -1, 0,
    -1, 5 * strength, -1,
    0, -1, 0
  ]);
  let dst = new cv.Mat();
  cv.filter2D(currentMat, dst, cv.CV_8U, kernel);
  currentMat = dst;
  updateCanvas(currentMat);
  kernel.delete();
}

function showFlipOptions() {
  appendMessage("🤖", "Flip Options:", [
    { label: "Horizontal", action: () => handleOperation("flipH", "Horizontal", () => applyFlip(1), showFlipOptions) },
    { label: "Vertical", action: () => handleOperation("flipV", "Vertical", () => applyFlip(0), showFlipOptions) },
    { label: "❌ Clear", action: () => {
      clearOperation("flipH");
      clearOperation("flipV", showFlipOptions);
    }},
    { label: "🔙 Back", action: showAvailableTools }
  ]);
}
function applyFlip(code) {
  let dst = new cv.Mat();
  cv.flip(currentMat, dst, code);
  currentMat = dst;
  updateCanvas(currentMat);
}

function showCannyOptions() {
  appendMessage("🤖", "Canny Edge:", [
    { label: "Apply", action: () => handleOperation("canny", "Edge", applyCanny, showCannyOptions) },
    { label: "❌ Clear", action: () => clearOperation("canny", showCannyOptions) },
    { label: "🔙 Back", action: showAvailableTools }
  ]);
}
function applyCanny() {
  let gray = new cv.Mat();
  let edges = new cv.Mat();
  cv.cvtColor(currentMat, gray, cv.COLOR_RGBA2GRAY);
  cv.Canny(gray, edges, 50, 100);
  cv.cvtColor(edges, currentMat, cv.COLOR_GRAY2RGBA);
  updateCanvas(currentMat);
  gray.delete(); edges.delete();
}

function showGrayscaleOptions() {
  appendMessage("🤖", "Grayscale Options:", [
    { label: "Apply", action: () => handleOperation("grayscale", "On", applyGrayscale, showGrayscaleOptions) },
    { label: "❌ Clear", action: () => clearOperation("grayscale", showGrayscaleOptions) },
    { label: "🔙 Back", action: showAvailableTools }
  ]);
}
function applyGrayscale() {
  let dst = new cv.Mat();
  cv.cvtColor(currentMat, dst, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(dst, currentMat, cv.COLOR_GRAY2RGBA);
  dst.delete();
  updateCanvas(currentMat);
}

// ---------- Prompt Submission ----------
function submitImage() {
  const prompt = document.getElementById("promptInput").value.toLowerCase();
  const file = document.getElementById("imageInput").files[0];
  if (!file || !originalMat) return alert("Please upload an image.");
  if (!prompt) return alert("Please enter a prompt.");

  const formData = new FormData();
  formData.append("image", file);
  formData.append("prompt", prompt);
  formData.append("format", "png");

  fetch("http://localhost:3000/edit-image", {
    method: "POST",
    body: formData,
  })
    .then((res) => res.blob())
    .then((blob) => {
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        currentMat = cv.matFromImageData(imgData);
        saveState();
      };
      img.src = URL.createObjectURL(blob);
    })
    .catch((err) => console.error("Error:", err));
}

// ---------- Chat UI ----------
function appendMessage(sender, text, buttons = []) {
  if (lastToolMessage) lastToolMessage.remove();
  const chatBody = document.getElementById("chatBody");
  const message = document.createElement("div");
  message.classList.add("message");
  message.classList.add(sender === "🤖" ? "bot-message" : "user-message");
  message.innerHTML = `<strong>${sender}</strong>: ${text}`;
  chatBody.appendChild(message);

  if (buttons.length) {
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("button-container");
    buttonContainer.classList.add("tool-buttons-grid");
    buttons.forEach(({ label, action }) => {
      const button = document.createElement("button");
      button.textContent = label;
      button.onclick = action;
      buttonContainer.appendChild(button);
    });
    message.appendChild(buttonContainer);
    lastToolMessage = message;
  }

  chatBody.scrollTop = chatBody.scrollHeight;
}

function appendWarningMessage(text) {
  const chatBody = document.getElementById("chatBody");
  const warning = document.createElement("div");
  warning.classList.add("message", "bot-message");
  warning.innerHTML = `<strong>🤖</strong>: ${text}`;
  chatBody.appendChild(warning);
  chatBody.scrollTop = chatBody.scrollHeight;
}
