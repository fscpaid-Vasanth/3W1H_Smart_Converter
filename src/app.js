import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import webhookRoutes from "./routes/webhook.routes.js";

import uploadRoutes from "./routes/upload.routes.js";
import analyzeRoutes from "./routes/analyze.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";

import { authenticateUser } from "./middleware/auth.middleware.js";

const app = express();

/* FIX FOR __dirname */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* MIDDLEWARE */
app.use(cors({
  origin: [
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "https://threew1h-smart-converter.web.app",
    "https://w1h-smart-converter.firebaseapp.com",
    "https://threew1h-smart-converter.onrender.com"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.includes("/api/webhook/razorpay")) {
      req.rawBody = buf;
    }
  }
}));

/* PUBLIC ROUTES (no auth required) */
app.use("/api/webhook", webhookRoutes);

/* STATIC FILES with browser caching */
app.use(express.static(path.join(__dirname, "../public"), {
  maxAge: '1d',           // Default: cache 1 day for CSS/JS
  etag: true,             // Enable ETag for cache validation
  lastModified: true,     // Enable Last-Modified header
  setHeaders: (res, filePath) => {
    // Images & fonts: cache 7 days
    if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
    }
    // HTML & Config: always revalidate (so updates are instant)
    else if (/\.(html|config\.js)$/i.test(filePath) || filePath.endsWith('config.js')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
    // CSS/JS: cache 1 day
    else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
}));

/* PROTECTED API ROUTES (auth required) */
app.use("/api/upload", authenticateUser, uploadRoutes);
app.use("/api/analyze", authenticateUser, analyzeRoutes);
app.use("/api/subscription", authenticateUser, subscriptionRoutes);


/* DASHBOARD */
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});

/* ROOT - Serves landing page */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

export default app;

