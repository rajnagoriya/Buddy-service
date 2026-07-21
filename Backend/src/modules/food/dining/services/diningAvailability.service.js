import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { FoodDiningRestaurant } from '../models/diningRestaurant.model.js';
import { FoodDiningTable } from '../models/diningTable.model.js';
import { FoodDiningTimeSlot } from '../models/diningTimeSlot.model.js';
import {
    DINING_ACTIVE_BOOKING_STATUSES,
    FoodDiningBooking
} from '../models/diningBooking.model.js';
import { getOutletTimingsForRestaurant } from '../../restaurant/services/outletTimings.service.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function toDateKey(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return value.trim();
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function parseTimeToMinutes(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    const raw = String(value).trim();
    if (!raw) return null;

    const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
        return Number(hhmm[1]) * 60 + Number(hhmm[2]);
    }

    const meridiem = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!meridiem) return null;

    let hour = Number(meridiem[1]);
    const minute = Number(meridiem[2] || 0);
    const period = meridiem[3].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
}

export function formatMinutesToLabel(totalMinutes) {
    const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const hours24 = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    let hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;
    return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function normalizeTimeSlotLabel(value) {
    const minutes = parseTimeToMinutes(value);
    if (minutes === null) return String(value || '').trim();
    return formatMinutesToLabel(minutes);
}

export async function getDiningSettingsDoc(restaurantId) {
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        throw new ValidationError('Invalid restaurant id');
    }

    const doc = await FoodDiningRestaurant.findOne({ restaurantId }).lean();
    if (!doc || doc.isEnabled !== true) {
        throw new ValidationError('Dining is not enabled for this restaurant');
    }
    return doc;
}

export function getDefaultDiningSettings(doc = {}) {
    return {
        isEnabled: Boolean(doc?.isEnabled),
        maxGuests: Math.max(1, Number(doc?.maxGuests) || 6),
        slotIntervalMinutes: Math.max(15, Number(doc?.slotIntervalMinutes) || 30),
        advanceBookingDays: Math.max(1, Number(doc?.advanceBookingDays) || 7),
        cancellationCutoffMinutes: Math.max(0, Number(doc?.cancellationCutoffMinutes) || 60),
        autoConfirm: doc?.autoConfirm === true,
        workingDays: Array.isArray(doc?.workingDays) ? doc.workingDays : [],
        holidays: Array.isArray(doc?.holidays) ? doc.holidays : [],
        closedDates: Array.isArray(doc?.closedDates) ? doc.closedDates : [],
        openingTime: String(doc?.openingTime || '').trim(),
        closingTime: String(doc?.closingTime || '').trim(),
        policyText: String(doc?.policyText || '').trim()
    };
}

function isClosedDate(settings, dateKey) {
    const closed = new Set([
        ...(settings.holidays || []),
        ...(settings.closedDates || [])
    ].map((d) => toDateKey(d)));
    return closed.has(dateKey);
}

function assertWithinAdvanceWindow(settings, dateKey) {
    const today = toDateKey(new Date());
    if (dateKey < today) {
        throw new ValidationError('Cannot book a past date');
    }

    const max = new Date();
    max.setHours(0, 0, 0, 0);
    max.setDate(max.getDate() + settings.advanceBookingDays);
    const maxKey = toDateKey(max);
    if (dateKey > maxKey) {
        throw new ValidationError(
            `Bookings are only allowed up to ${settings.advanceBookingDays} days in advance`
        );
    }
}

async function getDayTiming(restaurantId, dateKey, settings) {
    const date = new Date(`${dateKey}T12:00:00`);
    const dayName = DAY_NAMES[date.getDay()];

    if (Array.isArray(settings.workingDays) && settings.workingDays.length > 0) {
        const allowed = settings.workingDays.map((d) => String(d).toLowerCase());
        if (!allowed.includes(dayName.toLowerCase())) {
            return { dayName, isOpen: false, openingTime: null, closingTime: null };
        }
    }

    if (settings.openingTime && settings.closingTime) {
        return {
            dayName,
            isOpen: true,
            openingTime: settings.openingTime,
            closingTime: settings.closingTime
        };
    }

    const { outletTimings } = await getOutletTimingsForRestaurant(restaurantId);
    const timing = outletTimings?.[dayName] || null;
    if (!timing || timing.isOpen === false) {
        return { dayName, isOpen: false, openingTime: null, closingTime: null };
    }

    return {
        dayName,
        isOpen: true,
        openingTime: timing.openingTime || '12:00',
        closingTime: timing.closingTime || '23:00'
    };
}

function generateSlotsFromTiming(timing, intervalMinutes) {
    if (!timing?.isOpen) return [];
    let opening = parseTimeToMinutes(timing.openingTime);
    let closing = parseTimeToMinutes(timing.closingTime);
    if (opening === null || closing === null) return [];
    if (closing <= opening) closing += 24 * 60;

    const slots = [];
    for (let cursor = opening; cursor < closing; cursor += intervalMinutes) {
        slots.push({
            timeSlot: formatMinutesToLabel(cursor),
            startMinutes: cursor % (24 * 60),
            source: 'generated'
        });
    }
    return slots;
}

async function listConfiguredSlots(restaurantId, dayName) {
    const slots = await FoodDiningTimeSlot.find({
        restaurantId,
        isActive: true
    })
        .sort({ startMinutes: 1 })
        .lean();

    return slots
        .filter((slot) => {
            const days = Array.isArray(slot.daysOfWeek) ? slot.daysOfWeek : [];
            if (days.length === 0) return true;
            return days.some((d) => String(d).toLowerCase() === String(dayName).toLowerCase());
        })
        .map((slot) => ({
            _id: slot._id,
            timeSlot: normalizeTimeSlotLabel(slot.timeLabel),
            startMinutes: slot.startMinutes,
            maxCovers: slot.maxCovers,
            source: 'configured'
        }));
}

export async function listCandidateSlots(restaurantId, dateKey, settings) {
    assertWithinAdvanceWindow(settings, dateKey);

    if (isClosedDate(settings, dateKey)) {
        return { dayName: null, isOpen: false, slots: [], reason: 'closed_date' };
    }

    const dayTiming = await getDayTiming(restaurantId, dateKey, settings);
    if (!dayTiming.isOpen) {
        return { dayName: dayTiming.dayName, isOpen: false, slots: [], reason: 'closed_day' };
    }

    const configured = await listConfiguredSlots(restaurantId, dayTiming.dayName);
    const slots =
        configured.length > 0
            ? configured
            : generateSlotsFromTiming(dayTiming, settings.slotIntervalMinutes);

    return {
        dayName: dayTiming.dayName,
        isOpen: true,
        slots,
        reason: null
    };
}

export async function getActiveBookingsForDate(restaurantId, dateKey) {
    return FoodDiningBooking.find({
        restaurantId,
        date: dateKey,
        status: { $in: DINING_ACTIVE_BOOKING_STATUSES }
    })
        .select('tableId timeSlot guests status')
        .lean();
}

function slotHasCapacity(slot, bookings, tables, guests) {
    const slotLabel = normalizeTimeSlotLabel(slot.timeSlot);
    const slotBookings = bookings.filter(
        (b) => normalizeTimeSlotLabel(b.timeSlot) === slotLabel
    );

    if (slot.maxCovers != null) {
        const used = slotBookings.reduce((sum, b) => sum + Number(b.guests || 0), 0);
        if (used + guests > Number(slot.maxCovers)) return false;
    }

    if (!tables.length) {
        return true;
    }

    const bookedTableIds = new Set(
        slotBookings
            .map((b) => (b.tableId ? String(b.tableId) : null))
            .filter(Boolean)
    );

    const available = tables.filter((table) => {
        if (Number(table.capacity) < guests) return false;
        return !bookedTableIds.has(String(table._id));
    });

    return available.length > 0;
}

export async function getAvailableSlots(restaurantId, { date, guests = 2 } = {}) {
    const settingsDoc = await getDiningSettingsDoc(restaurantId);
    const settings = getDefaultDiningSettings(settingsDoc);
    const dateKey = toDateKey(date);
    if (!dateKey) throw new ValidationError('Invalid date');

    if (guests > settings.maxGuests) {
        throw new ValidationError(`Maximum ${settings.maxGuests} guests allowed`);
    }

    const { dayName, isOpen, slots, reason } = await listCandidateSlots(
        restaurantId,
        dateKey,
        settings
    );

    if (!isOpen) {
        return {
            date: dateKey,
            dayName,
            isOpen: false,
            reason,
            slots: [],
            settings: {
                maxGuests: settings.maxGuests,
                advanceBookingDays: settings.advanceBookingDays,
                slotIntervalMinutes: settings.slotIntervalMinutes
            }
        };
    }

    const [tables, bookings] = await Promise.all([
        FoodDiningTable.find({ restaurantId, isActive: true }).sort({ capacity: 1, sortOrder: 1 }).lean(),
        getActiveBookingsForDate(restaurantId, dateKey)
    ]);

    const availableSlots = slots
        .filter((slot) => slotHasCapacity(slot, bookings, tables, guests))
        .filter((slot) => {
            const todayKey = toDateKey(new Date());
            if (dateKey !== todayKey) return true;
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            return Number(slot.startMinutes) > currentMinutes + 15;
        })
        .map((slot) => ({
            timeSlot: slot.timeSlot,
            startMinutes: slot.startMinutes,
            source: slot.source,
            slotId: slot._id || null
        }));

    return {
        date: dateKey,
        dayName,
        isOpen: true,
        reason: null,
        slots: availableSlots,
        settings: {
            maxGuests: settings.maxGuests,
            advanceBookingDays: settings.advanceBookingDays,
            slotIntervalMinutes: settings.slotIntervalMinutes
        }
    };
}

export async function getAvailableTables(restaurantId, { date, timeSlot, guests = 2 } = {}) {
    const settingsDoc = await getDiningSettingsDoc(restaurantId);
    const settings = getDefaultDiningSettings(settingsDoc);
    const dateKey = toDateKey(date);
    const slotLabel = normalizeTimeSlotLabel(timeSlot);

    if (!dateKey) throw new ValidationError('Invalid date');
    if (!slotLabel) throw new ValidationError('timeSlot is required');
    if (guests > settings.maxGuests) {
        throw new ValidationError(`Maximum ${settings.maxGuests} guests allowed`);
    }

    const availability = await getAvailableSlots(restaurantId, { date: dateKey, guests });
    const slotExists = availability.slots.some(
        (s) => normalizeTimeSlotLabel(s.timeSlot) === slotLabel
    );
    if (!slotExists) {
        throw new ValidationError('Selected time slot is not available');
    }

    const [tables, bookings] = await Promise.all([
        FoodDiningTable.find({ restaurantId, isActive: true }).sort({ capacity: 1, sortOrder: 1 }).lean(),
        getActiveBookingsForDate(restaurantId, dateKey)
    ]);

    const bookedTableIds = new Set(
        bookings
            .filter((b) => normalizeTimeSlotLabel(b.timeSlot) === slotLabel)
            .map((b) => (b.tableId ? String(b.tableId) : null))
            .filter(Boolean)
    );

    const availableTables = tables
        .filter((table) => Number(table.capacity) >= guests)
        .filter((table) => !bookedTableIds.has(String(table._id)))
        .map((table) => ({
            _id: table._id,
            id: table._id,
            name: table.name,
            tableNumber: table.tableNumber,
            capacity: table.capacity,
            tableType: table.tableType,
            notes: table.notes || ''
        }));

    return {
        date: dateKey,
        timeSlot: slotLabel,
        guests,
        tables: availableTables,
        autoAssignSupported: true
    };
}

export async function pickBestTable(restaurantId, { date, timeSlot, guests, preferredTableId = null }) {
    const { tables } = await getAvailableTables(restaurantId, { date, timeSlot, guests });

    if (preferredTableId) {
        const preferred = tables.find((t) => String(t._id) === String(preferredTableId));
        if (!preferred) {
            throw new ValidationError('Selected table is not available for this slot');
        }
        return preferred;
    }

    if (!tables.length) {
        const anyTables = await FoodDiningTable.countDocuments({
            restaurantId,
            isActive: true
        });
        if (anyTables > 0) {
            throw new ValidationError('No tables available for the selected slot and guest count');
        }
        return null;
    }

    return tables[0];
}

export async function assertSlotBookable(restaurantId, { date, timeSlot, guests }) {
    const availability = await getAvailableSlots(restaurantId, { date, guests });
    if (!availability.isOpen) {
        throw new ValidationError('Restaurant is closed on the selected date');
    }

    const slotLabel = normalizeTimeSlotLabel(timeSlot);
    const found = availability.slots.find(
        (s) => normalizeTimeSlotLabel(s.timeSlot) === slotLabel
    );
    if (!found) {
        throw new ValidationError('Selected time slot is not available');
    }
    return { settings: availability.settings, slot: found, dateKey: availability.date };
}

export async function getBookableDates(restaurantId, { guests = 2 } = {}) {
    const settingsDoc = await getDiningSettingsDoc(restaurantId);
    const settings = getDefaultDiningSettings(settingsDoc);
    const dates = [];

    for (let i = 0; i <= settings.advanceBookingDays; i += 1) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + i);
        const dateKey = toDateKey(d);
        try {
            const availability = await getAvailableSlots(restaurantId, {
                date: dateKey,
                guests
            });
            dates.push({
                date: dateKey,
                isOpen: availability.isOpen,
                hasSlots: availability.slots.length > 0,
                slotCount: availability.slots.length
            });
        } catch {
            dates.push({ date: dateKey, isOpen: false, hasSlots: false, slotCount: 0 });
        }
    }

    return { dates, settings: getDefaultDiningSettings(settingsDoc) };
}

export async function requireEnabledDiningRestaurant(restaurantId) {
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        throw new ValidationError('Invalid restaurant id');
    }
    const doc = await FoodDiningRestaurant.findOne({ restaurantId, isEnabled: true }).lean();
    if (!doc) {
        throw new NotFoundError('Dining restaurant not found or dining is disabled');
    }
    return doc;
}
