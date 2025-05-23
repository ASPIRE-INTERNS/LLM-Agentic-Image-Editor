const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// POST /generate-operations: receives prompt, returns JSON operations
app.post("/generate-operations", (req, res) => {
  const prompt = req.body.prompt;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const python = spawn("python", ["llama_service.py", prompt]);

  let output = "";

  python.stdout.on("data", (data) => {
    output += data.toString();
  });

  python.stderr.on("data", (data) => {
    console.error("❌ Python error:", data.toString());
  });

  python.on("close", (code) => {
    console.log("🔧 Raw output from Python:");
    console.log(output); // <-- Log raw output before parsing

    try {
      const parsed = JSON.parse(output);
      console.log("✅ Parsed JSON:", JSON.stringify(parsed, null, 2)); // Pretty print
      res.json(parsed);
    } catch (err) {
      console.error("❌ Failed to parse JSON from llama_service.py:", err);
      res.status(500).json({ error: "Invalid JSON from Python script" });
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
