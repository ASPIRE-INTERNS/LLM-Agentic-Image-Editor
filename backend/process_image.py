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

# Extract first JSON object using regex
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

    # Normalize synonyms
    synonyms = {
        "boundingbox": "boundary_extraction",
        "bounding_box": "boundary_extraction",
        "extractboundary": "boundary_extraction"
    }
    op_type = synonyms.get(op_type, op_type)

    if not op_type:
        continue

    print(f"Applying operation: {op_type}", file=sys.stderr)

    if op_type == "brightness":
        beta = get_adjustment(op, 60)
        img_cv = cv2.convertScaleAbs(img_cv, alpha=1, beta=beta)
        print(f"Applied brightness (beta: {beta})", file=sys.stderr)

    elif op_type == "contrast":
        beta = get_adjustment(op, 40)
        img_cv = cv2.convertScaleAbs(img_cv, alpha=1.3, beta=beta)
        print(f"Applied contrast (beta: {beta})", file=sys.stderr)

    elif op_type == "blur":
        k = get_adjustment(op, 15)
        k = abs(k)
        k = k if k % 2 == 1 else k + 1
        img_cv = cv2.GaussianBlur(img_cv, (k, k), 0)
        print(f"Applied blur (kernel size: {k})", file=sys.stderr)

    elif op_type == "sharpen":
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
        img_cv = cv2.filter2D(img_cv, -1, kernel)
        print("Applied sharpening", file=sys.stderr)

    elif op_type == "canny":
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY) if len(img_cv.shape) == 3 else img_cv
        img_cv = cv2.Canny(gray, 100, 200)
        print("Applied Canny edge detection", file=sys.stderr)
        
   elif op_type in ["negative", "inversion"]:
        img_cv = cv2.bitwise_not(img_cv)
        print("Applied negative", file=sys.stderr)


    elif op_type == "grayscale":
        img_cv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        print("Applied grayscale", file=sys.stderr)

    elif op_type == "flip":
        direction = op.get("direction", "horizontal")
        flip_code = 1 if direction == "horizontal" else 0
        img_cv = cv2.flip(img_cv, flip_code)
        print(f"Applied flip ({direction})", file=sys.stderr)
        
    elif op_type == "pencil_sketch":
        print("Applying sharp pencil sketch effect", file=sys.stderr)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        inverted_gray = 255 - gray
        blurred = cv2.GaussianBlur(inverted_gray, (21, 21), sigmaX=0, sigmaY=0)
        sketch = cv2.divide(gray, 255 - blurred, scale=256)
        edges = cv2.Canny(gray, 50, 150)
        img_cv = cv2.addWeighted(sketch, 0.8, edges, 0.2, 0)
        print("Applied sharp pencil sketch", file=sys.stderr)
        
    elif op_type == "colour_pencil_sketch":
        print("Applying color pencil sketch effect", file=sys.stderr)

        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)                # Convert to grayscale
        inverted = 255 - gray                                          # Invert the grayscale image
        blurred = cv2.GaussianBlur(inverted, (21, 21), sigmaX=0)       # Apply Gaussian blur to the inverted image
        blend = cv2.divide(gray, 255 - blurred, scale=256)             # Dodge blend: brightens highlights to simulate pencil texture
        blend_colored = cv2.cvtColor(blend, cv2.COLOR_GRAY2BGR)        # Convert sketch back to 3 channels for color blending
        kernel = np.array([[0, -1, 0],                                 # Define sharpening kernel
                       [-1, 5, -1],
                       [0, -1, 0]])
        sharpened = cv2.filter2D(img_cv, -1, kernel)                   # Apply the sharpening filter to the original image
        img_cv = cv2.addWeighted(sharpened, 0.5, blend_colored, 0.5, 0) # Blend sharpened image with the pencil sketch (50-50 mix)
        print("Applied color pencil sketch", file=sys.stderr)


    elif op_type == "cartoon":
        print("Applying cartoon effect", file=sys.stderr)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)                          # Grayscale
        gray = cv2.medianBlur(gray, 5)                                           # Reduce noise
        edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                  cv2.THRESH_BINARY, 9, 9)                       # Edge mask
        color = cv2.bilateralFilter(img_cv, 9, 250, 250)                         # Smooth color areas
        img_cv = cv2.bitwise_and(color, color, mask=edges)                       # Combine with edges
        print("Applied cartoon effect", file=sys.stderr)



    elif op_type == "watershed":
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

    elif op_type == "grabcut":
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

        

    elif op_type == "boundary_extraction":
        print("Applying boundary extraction", file=sys.stderr)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        kernel = np.ones((5, 5), np.uint8)
        eroded = cv2.erode(gray, kernel, iterations=1)
        boundary = cv2.subtract(gray, eroded)
        img_cv = cv2.cvtColor(boundary, cv2.COLOR_GRAY2BGR)
        print("Applied boundary extraction", file=sys.stderr)

    elif op_type == "background_blur":
        print("Applying background blur", file=sys.stderr)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
        blurred = cv2.GaussianBlur(img_cv, (21, 21), 0)
        mask_3ch = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
        foreground = cv2.bitwise_and(img_cv, mask_3ch)
        background = cv2.bitwise_and(blurred, cv2.bitwise_not(mask_3ch))
        img_cv = cv2.add(foreground, background)
        print("Applied background blur", file=sys.stderr)

    elif op_type == "background_removal":
        print("Applying background removal", file=sys.stderr)
        mask = np.zeros(img_cv.shape[:2], np.uint8)
        bgModel = np.zeros((1, 65), np.float64)
        fgModel = np.zeros((1, 65), np.float64)
        h, w = img_cv.shape[:2]
        rect = (w // 10, h // 10, 8 * w // 10, 8 * h // 10)
        cv2.grabCut(img_cv, mask, rect, bgModel, fgModel, 5, cv2.GC_INIT_WITH_RECT)
        mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')
        img_cv = img_cv * mask2[:, :, np.newaxis]
        print("Applied background removal", file=sys.stderr)

    else:
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
