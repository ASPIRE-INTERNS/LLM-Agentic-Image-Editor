import sys
import json
import re
from io import BytesIO
from PIL import Image
import cv2
import numpy as np
from llama_service import query_llama

# Retrieve arguments from the command line
image_path, prompt, output_format = sys.argv[1:4]
print(f"Prompt received: {prompt}", file=sys.stderr)

# Load image
img = Image.open(image_path).convert("RGB")
img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

# Query LLaMA
llama_response_raw = query_llama(prompt)
print("LLaMA raw response:", llama_response_raw, file=sys.stderr)

# Extract first JSON object using regex(regular expression)
json_match = re.search(r'{.*}', llama_response_raw, re.DOTALL)
if not json_match:
    print("No valid JSON found in LLaMA response", file=sys.stderr)
    llama_response = {}
else:
    try:
        llama_response = json.loads(json_match.group(0))
    except Exception as e:
        print(f"Failed to parse JSON: {e}", file=sys.stderr)
        llama_response = {}

# Parse operations list
operations = []
if isinstance(llama_response.get("operations"), list):
    operations = llama_response["operations"]
elif "operation" in llama_response:
    operations = [{"type": llama_response["operation"]}]

print(f"Operations to apply: {operations}", file=sys.stderr)




# Helper function to get adjustment value from any of the keys
def get_adjustment(op, default=0):
    val = op.get("adjustment") or op.get("amount") or op.get("intensity") or op.get("level", default)
    try:
        return int(val)
    except:
        levels = {"low": 30, "medium": 60, "high": 90}
        return levels.get(str(val).lower(), default)

# Apply operations
for op in operations:
    op_type = op.get("type", "").lower()

    match op_type:
        case "brightness":
            beta = get_adjustment(op, 60)
            img_cv = cv2.convertScaleAbs(img_cv, alpha=1, beta=beta)
            print(f"Applied brightness (beta: {beta})", file=sys.stderr)

        case "contrast":
            beta = get_adjustment(op, 40)
            img_cv = cv2.convertScaleAbs(img_cv, alpha=1.3, beta=beta)
            print(f"Applied contrast (beta: {beta})", file=sys.stderr)

        case "blur":
            k = get_adjustment(op, 15)
            k = abs(k)
            k = k if k % 2 == 1 else k + 1
            img_cv = cv2.GaussianBlur(img_cv, (k, k), 0)
            print(f"Applied blur (kernel size: {k})", file=sys.stderr)

        case "sharpen":
            kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
            img_cv = cv2.filter2D(img_cv, -1, kernel)
            print("Applied sharpening", file=sys.stderr)

        case "canny":
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY) if len(img_cv.shape) == 3 else img_cv
            img_cv = cv2.Canny(gray, 100, 200)
            print("Applied Canny edge detection", file=sys.stderr)

        case "negative" | "inversion":
            img_cv = cv2.bitwise_not(img_cv)
            print("Applied negative", file=sys.stderr)

        case "grayscale":
            img_cv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            print("Applied grayscale", file=sys.stderr)

        case "flip":
            direction = op.get("direction", "horizontal")
            flip_code = 1 if direction == "horizontal" else 0
            img_cv = cv2.flip(img_cv, flip_code)
            print(f"Applied flip ({direction})", file=sys.stderr)

        case "pencil_sketch":
            print("Applying sharp pencil sketch effect", file=sys.stderr)
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            inverted_gray = 255 - gray
            blurred = cv2.GaussianBlur(inverted_gray, (21, 21), sigmaX=0, sigmaY=0)
            sketch = cv2.divide(gray, 255 - blurred, scale=256)
            edges = cv2.Canny(gray, 50, 150)
            img_cv = cv2.addWeighted(sketch, 0.8, edges, 0.2, 0)
            print("Applied sharp pencil sketch", file=sys.stderr)

        case "watershed":
            print("Applying Watershed segmentation", file=sys.stderr)
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            kernel = np.ones((3, 3), np.uint8)
            opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
            sure_bg = cv2.dilate(opening, kernel, iterations=3)
            dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
            _, sure_fg = cv2.threshold(dist_transform, 0.7 * dist_transform.max(), 255, 0)
            sure_fg = np.uint8(sure_fg)
            unknown = cv2.subtract(sure_bg, sure_fg)
            _, markers = cv2.connectedComponents(sure_fg)
            markers = markers + 1
            markers[unknown == 255] = 0
            markers = cv2.watershed(img_cv, markers)
            img_cv[markers == -1] = [0, 0, 255]
            print("Applied watershed", file=sys.stderr)

        case "grabcut":
            print("Applying GrabCut", file=sys.stderr)
            mask = np.zeros(img_cv.shape[:2], np.uint8)
            bgModel = np.zeros((1, 65), np.float64)
            fgModel = np.zeros((1, 65), np.float64)
            h, w = img_cv.shape[:2]
            rect = (w // 4, h // 4, w // 2, h // 2)
            cv2.grabCut(img_cv, mask, rect, bgModel, fgModel, 5, cv2.GC_INIT_WITH_RECT)
            mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')
            img_cv = img_cv * mask2[:, :, np.newaxis]
            print("Applied GrabCut", file=sys.stderr)

        case _:
            print(f"Unknown operation: {op_type}", file=sys.stderr)


# Convert grayscale to BGR for output
if len(img_cv.shape) == 2:
    img_cv = cv2.cvtColor(img_cv, cv2.COLOR_GRAY2BGR)

# Convert to PIL and save
img_pil = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
img_bytes = BytesIO()
if output_format.lower() == "pdf":
    img_pil.convert("RGB").save(img_bytes, format="PDF")
else:
    img_pil.save(img_bytes, format="PNG")

# Output image
sys.stdout.buffer.write(img_bytes.getvalue())
