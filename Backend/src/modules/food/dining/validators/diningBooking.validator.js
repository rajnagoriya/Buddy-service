import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';
import { DINING_BOOKING_STATUSES } from '../models/diningBooking.model.js';

function parseOrThrow(schema, body) {
    const result = schema.safeParse(body);
    if (!result.success) {
        const first = result.error.issues?.[0];
        const path = first?.path?.length ? first.path.join('.') : '';
        const msg = path
            ? `${path}: ${first?.message || 'Validation failed'}`
            : first?.message || 'Validation failed';
        throw new ValidationError(msg);
    }
    return result.data;
}

const objectIdString = z.string().min(1, 'Id is required');

const dateString = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

export function validateCreateBookingDto(body) {
    return parseOrThrow(
        z.object({
            restaurantId: objectIdString,
            date: dateString,
            timeSlot: z.string().trim().min(1, 'timeSlot is required'),
            guests: z.coerce.number().int().min(1).max(50),
            tableId: z.string().trim().optional().nullable(),
            specialRequest: z.string().trim().max(1000).optional().default(''),
            guestInfo: z
                .object({
                    name: z.string().trim().max(120).optional(),
                    phone: z.string().trim().max(20).optional(),
                    email: z
                        .string()
                        .trim()
                        .optional()
                        .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
                            message: 'Invalid email'
                        })
                })
                .optional()
        }),
        body
    );
}

export function validateCancelBookingDto(body = {}) {
    return parseOrThrow(
        z.object({
            reason: z.string().trim().max(500).optional().default('')
        }),
        body || {}
    );
}

export function validateUpdateBookingStatusDto(body) {
    return parseOrThrow(
        z.object({
            status: z.enum(DINING_BOOKING_STATUSES),
            reason: z.string().trim().max(500).optional().default(''),
            note: z.string().trim().max(500).optional().default('')
        }),
        body
    );
}

export function validateCreateReviewDto(body) {
    return parseOrThrow(
        z.object({
            bookingId: objectIdString,
            rating: z.coerce.number().int().min(1).max(5),
            comment: z.string().trim().max(2000).optional().default('')
        }),
        body
    );
}

export function validateCreateTableDto(body) {
    return parseOrThrow(
        z.object({
            name: z.string().trim().min(1, 'name is required').max(80),
            tableNumber: z.string().trim().max(40).optional().default(''),
            capacity: z.coerce.number().int().min(1).max(50),
            tableType: z
                .enum(['standard', 'vip', 'outdoor', 'booth', 'bar', 'private', 'other'])
                .optional()
                .default('standard'),
            isActive: z.boolean().optional().default(true),
            sortOrder: z.coerce.number().int().optional().default(0),
            notes: z.string().trim().max(500).optional().default('')
        }),
        body
    );
}

export function validateUpdateTableDto(body) {
    return parseOrThrow(
        z
            .object({
                name: z.string().trim().min(1).max(80).optional(),
                tableNumber: z.string().trim().max(40).optional(),
                capacity: z.coerce.number().int().min(1).max(50).optional(),
                tableType: z
                    .enum(['standard', 'vip', 'outdoor', 'booth', 'bar', 'private', 'other'])
                    .optional(),
                isActive: z.boolean().optional(),
                sortOrder: z.coerce.number().int().optional(),
                notes: z.string().trim().max(500).optional()
            })
            .refine((data) => Object.keys(data).length > 0, {
                message: 'At least one field is required'
            }),
        body
    );
}

export function validateCreateSlotDto(body) {
    return parseOrThrow(
        z.object({
            timeLabel: z.string().trim().min(1, 'timeLabel is required').max(40),
            startMinutes: z.coerce.number().int().min(0).max(24 * 60 - 1).optional(),
            durationMinutes: z.coerce.number().int().min(15).max(480).optional().default(60),
            mealPeriod: z.enum(['breakfast', 'lunch', 'dinner', 'all']).optional().default('all'),
            isActive: z.boolean().optional().default(true),
            daysOfWeek: z.array(z.string().trim()).optional().default([]),
            maxCovers: z.coerce.number().int().min(1).optional().nullable()
        }),
        body
    );
}

export function validateUpdateSlotDto(body) {
    return parseOrThrow(
        z
            .object({
                timeLabel: z.string().trim().min(1).max(40).optional(),
                startMinutes: z.coerce.number().int().min(0).max(24 * 60 - 1).optional(),
                durationMinutes: z.coerce.number().int().min(15).max(480).optional(),
                mealPeriod: z.enum(['breakfast', 'lunch', 'dinner', 'all']).optional(),
                isActive: z.boolean().optional(),
                daysOfWeek: z.array(z.string().trim()).optional(),
                maxCovers: z.coerce.number().int().min(1).optional().nullable()
            })
            .refine((data) => Object.keys(data).length > 0, {
                message: 'At least one field is required'
            }),
        body
    );
}

export function validateDiningReservationSettingsDto(body) {
    return parseOrThrow(
        z
            .object({
                slotIntervalMinutes: z.coerce.number().int().min(15).max(180).optional(),
                advanceBookingDays: z.coerce.number().int().min(1).max(90).optional(),
                cancellationCutoffMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
                autoConfirm: z.boolean().optional(),
                workingDays: z.array(z.string().trim()).optional(),
                holidays: z.array(dateString).optional(),
                closedDates: z.array(dateString).optional(),
                openingTime: z.string().trim().max(10).optional(),
                closingTime: z.string().trim().max(10).optional(),
                policyText: z.string().trim().max(5000).optional(),
                maxGuests: z.coerce.number().int().min(1).max(50).optional()
            })
            .refine((data) => Object.keys(data).length > 0, {
                message: 'At least one field is required'
            }),
        body
    );
}

export function validateAvailabilityQuery(query) {
    return parseOrThrow(
        z.object({
            date: dateString,
            guests: z.coerce.number().int().min(1).max(50).optional().default(2),
            timeSlot: z.string().trim().optional()
        }),
        query
    );
}
