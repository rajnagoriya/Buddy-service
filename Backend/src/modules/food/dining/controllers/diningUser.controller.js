import { sendResponse } from '../../../../utils/response.js';
import * as availabilityService from '../services/diningAvailability.service.js';
import * as bookingService from '../services/diningBooking.service.js';
import {
    validateAvailabilityQuery,
    validateCancelBookingDto,
    validateCreateBookingDto,
    validateCreateReviewDto
} from '../validators/diningBooking.validator.js';

export async function getAvailableSlotsController(req, res, next) {
    try {
        const restaurantId = req.params.restaurantId;
        const query = validateAvailabilityQuery(req.query || {});
        const data = await availabilityService.getAvailableSlots(restaurantId, query);
        return sendResponse(res, 200, 'Available slots fetched', data);
    } catch (err) {
        next(err);
    }
}

export async function getAvailableTablesController(req, res, next) {
    try {
        const restaurantId = req.params.restaurantId;
        const query = validateAvailabilityQuery(req.query || {});
        if (!query.timeSlot) {
            return res.status(422).json({ success: false, message: 'timeSlot is required' });
        }
        const data = await availabilityService.getAvailableTables(restaurantId, query);
        return sendResponse(res, 200, 'Available tables fetched', data);
    } catch (err) {
        next(err);
    }
}

export async function getBookableDatesController(req, res, next) {
    try {
        const restaurantId = req.params.restaurantId;
        const guests = Math.max(1, parseInt(req.query?.guests, 10) || 2);
        const data = await availabilityService.getBookableDates(restaurantId, { guests });
        return sendResponse(res, 200, 'Bookable dates fetched', data);
    } catch (err) {
        next(err);
    }
}

export async function createBookingController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const dto = validateCreateBookingDto(req.body || {});
        const booking = await bookingService.createBooking(userId, dto);
        return sendResponse(res, 201, 'Booking created successfully', booking);
    } catch (err) {
        next(err);
    }
}

export async function listMyBookingsController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const data = await bookingService.listUserBookings(userId, req.query || {});
        return sendResponse(res, 200, 'Bookings fetched successfully', data.bookings);
    } catch (err) {
        next(err);
    }
}

export async function getMyBookingController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const booking = await bookingService.getUserBookingById(userId, req.params.bookingId);
        return sendResponse(res, 200, 'Booking fetched successfully', booking);
    } catch (err) {
        next(err);
    }
}

export async function cancelMyBookingController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const dto = validateCancelBookingDto(req.body || {});
        const booking = await bookingService.cancelUserBooking(userId, req.params.bookingId, dto);
        return sendResponse(res, 200, 'Booking cancelled successfully', booking);
    } catch (err) {
        next(err);
    }
}

export async function createReviewController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const dto = validateCreateReviewDto(req.body || {});
        const booking = await bookingService.createReview(userId, dto);
        return sendResponse(res, 201, 'Review submitted successfully', booking);
    } catch (err) {
        next(err);
    }
}
