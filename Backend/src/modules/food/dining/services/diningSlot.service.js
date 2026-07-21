import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { FoodDiningTimeSlot } from '../models/diningTimeSlot.model.js';
import {
    normalizeTimeSlotLabel,
    parseTimeToMinutes,
    requireEnabledDiningRestaurant
} from './diningAvailability.service.js';

function mapSlot(doc) {
    if (!doc) return null;
    return {
        _id: doc._id,
        id: doc._id,
        restaurantId: doc.restaurantId,
        timeLabel: doc.timeLabel,
        startMinutes: doc.startMinutes,
        durationMinutes: doc.durationMinutes,
        mealPeriod: doc.mealPeriod || 'all',
        isActive: doc.isActive !== false,
        daysOfWeek: Array.isArray(doc.daysOfWeek) ? doc.daysOfWeek : [],
        maxCovers: doc.maxCovers ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
}

function resolveStartMinutes(dto) {
    if (dto.startMinutes !== undefined && dto.startMinutes !== null) {
        return Number(dto.startMinutes);
    }
    const parsed = parseTimeToMinutes(dto.timeLabel);
    if (parsed === null) {
        throw new ValidationError('Unable to parse timeLabel; provide startMinutes');
    }
    return parsed;
}

export async function listSlots(restaurantId, { includeInactive = true } = {}) {
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        throw new ValidationError('Invalid restaurant id');
    }

    const filter = { restaurantId };
    if (!includeInactive) filter.isActive = true;

    const slots = await FoodDiningTimeSlot.find(filter).sort({ startMinutes: 1 }).lean();
    return { slots: slots.map(mapSlot) };
}

export async function createSlot(restaurantId, dto) {
    await requireEnabledDiningRestaurant(restaurantId);

    const timeLabel = normalizeTimeSlotLabel(dto.timeLabel);
    const startMinutes = resolveStartMinutes({ ...dto, timeLabel });

    const created = await FoodDiningTimeSlot.create({
        restaurantId,
        timeLabel,
        startMinutes,
        durationMinutes: dto.durationMinutes || 60,
        mealPeriod: dto.mealPeriod || 'all',
        isActive: dto.isActive !== false,
        daysOfWeek: Array.isArray(dto.daysOfWeek) ? dto.daysOfWeek : [],
        maxCovers: dto.maxCovers ?? null
    });

    return mapSlot(created.toObject());
}

export async function updateSlot(restaurantId, slotId, dto) {
    if (!mongoose.Types.ObjectId.isValid(slotId)) {
        throw new ValidationError('Invalid slot id');
    }

    const slot = await FoodDiningTimeSlot.findOne({ _id: slotId, restaurantId });
    if (!slot) throw new NotFoundError('Time slot not found');

    if (dto.timeLabel !== undefined) {
        slot.timeLabel = normalizeTimeSlotLabel(dto.timeLabel);
        if (dto.startMinutes === undefined) {
            const parsed = parseTimeToMinutes(slot.timeLabel);
            if (parsed !== null) slot.startMinutes = parsed;
        }
    }
    if (dto.startMinutes !== undefined) slot.startMinutes = dto.startMinutes;
    if (dto.durationMinutes !== undefined) slot.durationMinutes = dto.durationMinutes;
    if (dto.mealPeriod !== undefined) slot.mealPeriod = dto.mealPeriod;
    if (dto.isActive !== undefined) slot.isActive = dto.isActive;
    if (dto.daysOfWeek !== undefined) slot.daysOfWeek = dto.daysOfWeek;
    if (dto.maxCovers !== undefined) slot.maxCovers = dto.maxCovers;

    await slot.save();
    return mapSlot(slot.toObject());
}

export async function deleteSlot(restaurantId, slotId) {
    if (!mongoose.Types.ObjectId.isValid(slotId)) {
        throw new ValidationError('Invalid slot id');
    }

    const deleted = await FoodDiningTimeSlot.findOneAndDelete({
        _id: slotId,
        restaurantId
    }).lean();

    if (!deleted) throw new NotFoundError('Time slot not found');
    return { id: slotId };
}
