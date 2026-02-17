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
    "https://w1h-smart-converter.firebaseapp.com"
  ],
  credentials: true
}));
app.use(express.json());

/* PUBLIC ROUTES (no auth required) */
app.use("/api/webhook", webhookRoutes);

/* STATIC FILES - Public pages (login, signup) */
app.use(express.static(path.join(__dirname, "../public")));

/* PROTECTED API ROUTES (auth required) */
app.use("/api/upload", authenticateUser, uploadRoutes);
app.use("/api/analyze", authenticateUser, analyzeRoutes);
app.use("/api/subscription", authenticateUser, subscriptionRoutes);


/* ROOT - Serves dashboard (will check auth on client side) */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

export default app;

