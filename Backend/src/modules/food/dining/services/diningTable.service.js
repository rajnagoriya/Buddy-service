import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { FoodDiningTable } from '../models/diningTable.model.js';
import { DINING_ACTIVE_BOOKING_STATUSES, FoodDiningBooking } from '../models/diningBooking.model.js';
import { requireEnabledDiningRestaurant } from './diningAvailability.service.js';

function mapTable(doc) {
    if (!doc) return null;
    return {
        _id: doc._id,
        id: doc._id,
        restaurantId: doc.restaurantId,
        name: doc.name,
        tableNumber: doc.tableNumber || '',
        capacity: doc.capacity,
        tableType: doc.tableType || 'standard',
        isActive: doc.isActive !== false,
        sortOrder: doc.sortOrder || 0,
        notes: doc.notes || '',
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
}

export async function listTables(restaurantId, { includeInactive = true } = {}) {
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        throw new ValidationError('Invalid restaurant id');
    }

    const filter = { restaurantId };
    if (!includeInactive) filter.isActive = true;

    const tables = await FoodDiningTable.find(filter)
        .sort({ sortOrder: 1, capacity: 1, createdAt: 1 })
        .lean();

    return { tables: tables.map(mapTable) };
}

export async function createTable(restaurantId, dto) {
    await requireEnabledDiningRestaurant(restaurantId);

    const created = await FoodDiningTable.create({
        restaurantId,
        name: dto.name,
        tableNumber: dto.tableNumber || '',
        capacity: dto.capacity,
        tableType: dto.tableType || 'standard',
        isActive: dto.isActive !== false,
        sortOrder: dto.sortOrder || 0,
        notes: dto.notes || ''
    });

    return mapTable(created.toObject());
}

export async function updateTable(restaurantId, tableId, dto) {
    if (!mongoose.Types.ObjectId.isValid(tableId)) {
        throw new ValidationError('Invalid table id');
    }

    const table = await FoodDiningTable.findOne({ _id: tableId, restaurantId });
    if (!table) throw new NotFoundError('Table not found');

    if (dto.name !== undefined) table.name = dto.name;
    if (dto.tableNumber !== undefined) table.tableNumber = dto.tableNumber;
    if (dto.capacity !== undefined) table.capacity = dto.capacity;
    if (dto.tableType !== undefined) table.tableType = dto.tableType;
    if (dto.isActive !== undefined) table.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) table.sortOrder = dto.sortOrder;
    if (dto.notes !== undefined) table.notes = dto.notes;

    await table.save();
    return mapTable(table.toObject());
}

export async function deleteTable(restaurantId, tableId) {
    if (!mongoose.Types.ObjectId.isValid(tableId)) {
        throw new ValidationError('Invalid table id');
    }

    const activeBooking = await FoodDiningBooking.findOne({
        restaurantId,
        tableId,
        status: { $in: DINING_ACTIVE_BOOKING_STATUSES }
    })
        .select('_id bookingId')
        .lean();

    if (activeBooking) {
        throw new ValidationError(
            `Cannot delete table with active booking ${activeBooking.bookingId}`
        );
    }

    const deleted = await FoodDiningTable.findOneAndDelete({ _id: tableId, restaurantId }).lean();
    if (!deleted) throw new NotFoundError('Table not found');
    return { id: tableId };
}
