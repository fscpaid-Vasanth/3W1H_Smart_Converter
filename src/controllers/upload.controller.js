export const uploadAudio = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded" });
  }

  res.json({
    message: "Audio uploaded successfully",
    fileName: req.file.filename,
    filePath: req.file.path
  });
};
