import { sendResponse } from '../../../../utils/response.js';
import * as tableService from '../services/diningTable.service.js';
import * as slotService from '../services/diningSlot.service.js';
import * as bookingService from '../services/diningBooking.service.js';
import {
    validateCreateSlotDto,
    validateCreateTableDto,
    validateDiningReservationSettingsDto,
    validateUpdateBookingStatusDto,
    validateUpdateSlotDto,
    validateUpdateTableDto
} from '../validators/diningBooking.validator.js';

export async function listRestaurantBookingsController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const data = await bookingService.listRestaurantBookings(restaurantId, req.query || {});
        return sendResponse(res, 200, 'Reservations fetched successfully', data.bookings);
    } catch (err) {
        next(err);
    }
}

export async function getRestaurantBookingStatsController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const stats = await bookingService.getRestaurantBookingStats(restaurantId);
        return sendResponse(res, 200, 'Reservation stats fetched', stats);
    } catch (err) {
        next(err);
    }
}

export async function searchRestaurantBookingController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const code = req.query?.code || req.params?.code;
        const booking = await bookingService.searchRestaurantBooking(restaurantId, code);
        return sendResponse(res, 200, 'Booking found', booking);
    } catch (err) {
        next(err);
    }
}

export async function updateRestaurantBookingStatusController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        let body = { ...(req.body || {}) };
        if (!body.status && req.body?.newStatus) body.status = req.body.newStatus;
        // Frontend may send status as second arg style via path/query
        if (!body.status && req.query?.status) body.status = req.query.status;

        // Map decline to rejected for pending bookings
        if (String(body.status).toLowerCase() === 'cancelled') {
            body = { ...body, status: 'cancelled' };
        }

        const dto = validateUpdateBookingStatusDto(body);
        const booking = await bookingService.updateRestaurantBookingStatus(
            restaurantId,
            req.params.bookingId,
            dto,
            restaurantId
        );
        return sendResponse(res, 200, 'Reservation status updated', booking);
    } catch (err) {
        next(err);
    }
}

export async function listTablesController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const data = await tableService.listTables(restaurantId, {
            includeInactive: req.query?.includeInactive !== 'false'
        });
        return sendResponse(res, 200, 'Tables fetched successfully', data.tables);
    } catch (err) {
        next(err);
    }
}

export async function createTableController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const dto = validateCreateTableDto(req.body || {});
        const table = await tableService.createTable(restaurantId, dto);
        return sendResponse(res, 201, 'Table created successfully', table);
    } catch (err) {
        next(err);
    }
}

export async function updateTableController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const dto = validateUpdateTableDto(req.body || {});
        const table = await tableService.updateTable(restaurantId, req.params.tableId, dto);
        return sendResponse(res, 200, 'Table updated successfully', table);
    } catch (err) {
        next(err);
    }
}

export async function deleteTableController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const result = await tableService.deleteTable(restaurantId, req.params.tableId);
        return sendResponse(res, 200, 'Table deleted successfully', result);
    } catch (err) {
        next(err);
    }
}

export async function listSlotsController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const data = await slotService.listSlots(restaurantId, {
            includeInactive: req.query?.includeInactive !== 'false'
        });
        return sendResponse(res, 200, 'Time slots fetched successfully', data.slots);
    } catch (err) {
        next(err);
    }
}

export async function createSlotController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const dto = validateCreateSlotDto(req.body || {});
        const slot = await slotService.createSlot(restaurantId, dto);
        return sendResponse(res, 201, 'Time slot created successfully', slot);
    } catch (err) {
        next(err);
    }
}

export async function updateSlotController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const dto = validateUpdateSlotDto(req.body || {});
        const slot = await slotService.updateSlot(restaurantId, req.params.slotId, dto);
        return sendResponse(res, 200, 'Time slot updated successfully', slot);
    } catch (err) {
        next(err);
    }
}

export async function deleteSlotController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const result = await slotService.deleteSlot(restaurantId, req.params.slotId);
        return sendResponse(res, 200, 'Time slot deleted successfully', result);
    } catch (err) {
        next(err);
    }
}

export async function getReservationSettingsController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const settings = await bookingService.getReservationSettings(restaurantId);
        return sendResponse(res, 200, 'Reservation settings fetched', settings);
    } catch (err) {
        next(err);
    }
}

export async function updateReservationSettingsController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const dto = validateDiningReservationSettingsDto(req.body || {});
        const settings = await bookingService.updateReservationSettings(restaurantId, dto);
        return sendResponse(res, 200, 'Reservation settings updated', settings);
    } catch (err) {
        next(err);
    }
}
