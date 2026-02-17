import express from "express";
import multer from "multer";
import path from "path";

const router = express.Router();

const upload = multer({
  dest: "uploads/"
});

router.post("/", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    // IMPORTANT: send filePath back
    return res.json({
      filePath: req.file.path
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Audio upload failed" });
  }
});

export default router;
