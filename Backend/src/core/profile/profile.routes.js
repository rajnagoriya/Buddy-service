import express from 'express';
import { getMasterProfileController } from './profile.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = express.Router();

router.get('/master', asyncHandler(getMasterProfileController));

export default router;
