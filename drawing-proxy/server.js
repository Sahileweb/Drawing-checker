// server.js
// Minimal proxy so drawing.html (running on its own, e.g. via Live Server)
// can call the Gemini API without exposing the API key in client-side JS.


require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(express.json({ limit: "25mb" }));

app.use(cors({
  origin: [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://drawing-checker.vercel.app"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

const API_KEY = process.env.GEMINI_API_KEY.split(",");

if (!API_KEY) {
  console.error("ERROR: GEMINI_API_KEY environment variable is not set.");
  console.error("Get a key at https://aistudio.google.com/apikey, then run:");
  console.error("  GEMINI_API_KEY=your-key-here node server.js");
  process.exit(1);
}

// Model to use — gemini-2.5-flash is being retired Oct 2026, so default to
// the current flash model. Override with GEMINI_MODEL env var if needed.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Body expected from drawing.html:
// { systemPrompt: string, imageBase64: string, mimeType: string, userText: string }
app.post("/api/analyze", async (req, res) => {
  try {
    const { systemPrompt, imageBase64, mimeType, userText } = req.body;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const geminiBody = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } },
          { text: userText || "Review this drawing sheet. Return JSON only." }
        ]
      }],
      generationConfig: {
        // Ask Gemini to return raw JSON directly — saves us stripping
        // markdown fences on the client.
        response_mime_type: "application/json"
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify(geminiBody)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy request failed", detail: String(err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT} (model: ${MODEL})`);
});