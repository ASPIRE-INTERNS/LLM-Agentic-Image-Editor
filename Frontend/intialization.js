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
  if (blurMask) blurMask.delete();
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
