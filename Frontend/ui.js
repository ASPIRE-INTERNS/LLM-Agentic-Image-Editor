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
