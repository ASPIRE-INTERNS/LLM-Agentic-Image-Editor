const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
const port = 3000;

app.use(cors());
const upload = multer({ dest: "uploads/" });

app.post("/edit-image", upload.single("image"), (req, res) => {
  const imagePath = req.file.path;
  const prompt = req.body.prompt;
  const format = req.body.format || "png";

  const py = spawn("python", ["process_image.py", imagePath, prompt, format]);

  let data = [];
  py.stdout.on("data", chunk => data.push(chunk));

  py.stderr.on("data", err => console.error("Python :", err.toString()));

  py.on("close", code => {
    const result = Buffer.concat(data);
    const filename = format === "pdf" ? "edited_image.pdf" : "edited_image.png";
    const mimeType = format === "pdf" ? "application/pdf" : "image/png";

    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Type", mimeType);
    res.send(result);

    fs.unlink(imagePath, () => {}); 
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});



