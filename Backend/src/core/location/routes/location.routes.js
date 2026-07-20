import express from 'express';
import { reverseGeocodeController } from '../location.controller.js';

const router = express.Router();

// Shared reverse-geocode endpoint - any authenticated actor (user, restaurant,
// delivery partner). Mounted with authMiddleware only (no role restriction)
// in routes/index.js.
router.get('/reverse-geocode', reverseGeocodeController);

export default router;
