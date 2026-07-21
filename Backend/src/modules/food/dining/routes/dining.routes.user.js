import express from 'express';
import {
    cancelMyBookingController,
    createBookingController,
    createReviewController,
    getAvailableSlotsController,
    getAvailableTablesController,
    getBookableDatesController,
    getMyBookingController,
    listMyBookingsController
} from '../controllers/diningUser.controller.js';

const router = express.Router();

router.get('/restaurants/:restaurantId/dates', getBookableDatesController);
router.get('/restaurants/:restaurantId/slots', getAvailableSlotsController);
router.get('/restaurants/:restaurantId/tables', getAvailableTablesController);

router.post('/bookings', createBookingController);
router.get('/bookings', listMyBookingsController);
router.get('/bookings/:bookingId', getMyBookingController);
router.patch('/bookings/:bookingId/cancel', cancelMyBookingController);
router.post('/bookings/:bookingId/reviews', createReviewController);
router.post('/reviews', createReviewController);

export default router;
