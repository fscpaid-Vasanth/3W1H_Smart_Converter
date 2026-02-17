import express from 'express';
import { exportUserData } from '../controllers/user.controller.js';

const router = express.Router();

// GET /api/user/export-data
router.get('/export-data', exportUserData);

export default router;
