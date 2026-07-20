import express from 'express';
import {
    createSlotController,
    createTableController,
    deleteSlotController,
    deleteTableController,
    getReservationSettingsController,
    getRestaurantBookingStatsController,
    listRestaurantBookingsController,
    listSlotsController,
    listTablesController,
    searchRestaurantBookingController,
    updateReservationSettingsController,
    updateRestaurantBookingStatusController,
    updateSlotController,
    updateTableController
} from '../controllers/diningRestaurant.controller.js';

const router = express.Router();

router.get('/bookings', listRestaurantBookingsController);
router.get('/bookings/stats', getRestaurantBookingStatsController);
router.get('/bookings/search', searchRestaurantBookingController);
router.patch('/bookings/:bookingId/status', updateRestaurantBookingStatusController);

router.get('/tables', listTablesController);
router.post('/tables', createTableController);
router.patch('/tables/:tableId', updateTableController);
router.delete('/tables/:tableId', deleteTableController);

router.get('/slots', listSlotsController);
router.post('/slots', createSlotController);
router.patch('/slots/:slotId', updateSlotController);
router.delete('/slots/:slotId', deleteSlotController);

router.get('/reservation-settings', getReservationSettingsController);
router.patch('/reservation-settings', updateReservationSettingsController);

export default router;
