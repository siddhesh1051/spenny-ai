// server/share-handler.js
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

const app = express();

// Configure CORS to allow your frontend domain
app.use(
  cors({
    origin: ["http://localhost:3000", "https://spennyai.vercel.app"],
    credentials: true,
  })
);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Your frontend URL - UPDATE THIS!
const FRONTEND_URL = "https://spennyai.vercel.app";

// Handle share target POST requests
app.post("/share-target", upload.array("files"), (req, res) => {
  console.log("Share target request received");
  console.log("Files:", req.files?.length || 0);
  console.log("Body:", req.body);

  try {
    if (!req.files || req.files.length === 0) {
      return res.redirect(`${FRONTEND_URL}/?error=no-file`);
    }

    const file = req.files[0];
    console.log("Processing file:", file.originalname, file.mimetype);

    // Convert file to base64 for transmission
    const base64Data = file.buffer.toString("base64");

    // Create a data URL that can be processed by the frontend
    const dataUrl = `data:${file.mimetype};base64,${base64Data}`;

    // Store temporarily and redirect with a reference
    const shareId = Date.now().toString();

    // In-memory store (use Redis in production)
    global.sharedFiles = global.sharedFiles || {};
    global.sharedFiles[shareId] = {
      dataUrl: dataUrl,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      title: req.body.title || "",
      text: req.body.text || "",
      timestamp: Date.now(),
    };

    // Clean up old files (older than 5 minutes)
    Object.keys(global.sharedFiles).forEach((id) => {
      if (Date.now() - global.sharedFiles[id].timestamp > 5 * 60 * 1000) {
        delete global.sharedFiles[id];
      }
    });

    // Redirect to the frontend with share ID
    console.log(`Redirecting to: ${FRONTEND_URL}/?shareId=${shareId}`);
    res.redirect(`${FRONTEND_URL}/?shareId=${shareId}`);
  } catch (error) {
    console.error("Error processing share:", error);
    res.redirect(`${FRONTEND_URL}/?error=share-failed`);
  }
});

// API endpoint to get shared file (CORS enabled)
app.get("/api/shared-file/:shareId", (req, res) => {
  const { shareId } = req.params;

  console.log(`Getting shared file: ${shareId}`);

  if (!global.sharedFiles || !global.sharedFiles[shareId]) {
    console.log("File not found for shareId:", shareId);
    return res.status(404).json({ error: "File not found" });
  }

  const fileData = global.sharedFiles[shareId];

  // Return the file data
  res.json({
    success: true,
    file: {
      dataUrl: fileData.dataUrl,
      name: fileData.originalName,
      type: fileData.mimeType,
      size: fileData.size,
      title: fileData.title,
      text: fileData.text,
    },
  });

  // Clean up after sending
  delete global.sharedFiles[shareId];
  console.log("File sent and cleaned up");
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    frontendUrl: FRONTEND_URL,
    sharedFilesCount: Object.keys(global.sharedFiles || {}).length,
  });
});

// Root endpoint for testing
app.get("/", (req, res) => {
  res.json({
    message: "Spenny AI Share Target Server",
    endpoints: {
      shareTarget: "/share-target (POST)",
      getSharedFile: "/api/shared-file/:shareId (GET)",
      health: "/health (GET)",
    },
    frontendUrl: FRONTEND_URL,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Share handler server running on port ${PORT}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
});

module.exports = app;
