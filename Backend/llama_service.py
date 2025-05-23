# llama_service.py
import sys
import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3.2"

def query_llama(prompt: str, history: str) -> str:
    payload = {
        "model": MODEL_NAME,
        "prompt": f"""You are an image editor assistant.
Given a user instruction, generate a compact JSON object with the list of operations and any necessary parameters.
Only return JSON. No explanations.

The JSON format must be:
{{"operations": [{{"type": "blur", "intensity": "high"}}, {{"type": "grayscale"}}]}}

Examples:

User: "Apply high blur and grayscale"
Output: {{"operations": [{{"type": "blur", "intensity": "high"}}, {{"type": "grayscale"}}]}}

User: "Flip the image horizontally"
Output: {{"operations": [{{"type": "flip", "direction": "horizontal"}}]}}

User: "Flip vertically and apply pencil sketch"
Output: {{"operations": [{{"type": "flip", "direction": "vertical"}}, {{"type": "pencil_sketch"}}]}}

User: "Extract boundary from the image"
Output: {{"operations": [{{"type": "boundary_extraction"}}]}}

User: "Draw bounding box and then flip it horizontally"
Output: {{"operations": [{{"type": "boundary_extraction"}}, {{"type": "flip", "direction": "horizontal"}}]}}

Clarifications:
- Use type: "boundary_extraction" if the user says 'extract the boundary', 'draw boundary', or 'show bounding box'.
- For "flip", always specify the "direction" as either "horizontal" or "vertical".
- "flip" and "boundary_extraction" are different operations.
- "blur", "background_blur", "background_removal", "pencil_sketch", "color_pencil_sketch", and "cartoon" are all distinct types.
- "negative", "invert", "inversion", and "color_invert" are all the same operation — use type: "negative".


Already applied operations:
{history}

Now, user prompt:
'{prompt}'

Output:
""",
        "stream": False
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        raw_response = response.json().get("response", "")
        start_idx = raw_response.find('{')
        end_idx = raw_response.rfind('}') + 1
        json_response = raw_response[start_idx:end_idx]
        return json_response

    except Exception as e:
        print("Error querying LLaMA:", e)
        return json.dumps({"operations": [{"type": "none"}]})

if __name__ == "__main__":
    prompt = sys.argv[1]
    history = sys.argv[2] if len(sys.argv) > 2 else "{}"
    output = query_llama(prompt, history)
    print(output)
# llama_service.py
import sys
import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3.2"

def query_llama(prompt: str, history: str) -> str:
    payload = {
        "model": MODEL_NAME,
        "prompt": f"""You are an image editor assistant.
Given a user instruction, generate a compact JSON object with the list of operations and any necessary parameters.
Only return JSON. No explanations.

The JSON format must be:
{{"operations": [{{"type": "blur", "intensity": "high"}}, {{"type": "grayscale"}}]}}

Examples:

User: "Apply high blur and grayscale"
Output: {{"operations": [{{"type": "blur", "intensity": "high"}}, {{"type": "grayscale"}}]}}

User: "Flip the image horizontally"
Output: {{"operations": [{{"type": "flip", "direction": "horizontal"}}]}}

User: "Flip vertically and apply pencil sketch"
Output: {{"operations": [{{"type": "flip", "direction": "vertical"}}, {{"type": "pencil_sketch"}}]}}

User: "Extract boundary from the image"
Output: {{"operations": [{{"type": "boundary_extraction"}}]}}

User: "Draw bounding box and then flip it horizontally"
Output: {{"operations": [{{"type": "boundary_extraction"}}, {{"type": "flip", "direction": "horizontal"}}]}}

Clarifications:
- Use type: "boundary_extraction" if the user says 'extract the boundary', 'draw boundary', or 'show bounding box'.
- For "flip", always specify the "direction" as either "horizontal" or "vertical".
- "flip" and "boundary_extraction" are different operations.
- "blur", "background_blur", "background_removal", "pencil_sketch", "color_pencil_sketch", and "cartoon" are all distinct types.
- "negative", "invert", "inversion", and "color_invert" are all the same operation — use type: "negative".


Already applied operations:
{history}

Now, user prompt:
'{prompt}'

Output:
""",
        "stream": False
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        raw_response = response.json().get("response", "")
        start_idx = raw_response.find('{')
        end_idx = raw_response.rfind('}') + 1
        json_response = raw_response[start_idx:end_idx]
        return json_response

    except Exception as e:
        print("Error querying LLaMA:", e)
        return json.dumps({"operations": [{"type": "none"}]})

if __name__ == "__main__":
    prompt = sys.argv[1]
    history = sys.argv[2] if len(sys.argv) > 2 else "{}"
    output = query_llama(prompt, history)
    print(output)
