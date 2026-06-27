import { buildPaginationMeta } from '../../../../utils/helpers.js';

const PLACEHOLDER_CITIES = new Set([
    'current location',
    'unknown city',
    'select location',
]);

export const HOME_LIST_DEFAULT_LIMIT = 12;
export const HOME_LIST_MAX_LIMIT = 15;

export const normalizeRestaurantListCity = (city) => {
    const trimmed = String(city || '').trim();
    if (!trimmed) return null;
    if (PLACEHOLDER_CITIES.has(trimmed.toLowerCase())) return null;
    return trimmed.slice(0, 80);
};

export const escapeRegex = (value) =>
    String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive exact city match on flat or nested location.city. */
export const buildRestaurantCityFilter = (city) => {
    const normalized = normalizeRestaurantListCity(city);
    if (!normalized) return null;
    const rx = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
    return { $or: [{ city: rx }, { 'location.city': rx }] };
};

export const isHomeRestaurantListScope = (query = {}) =>
    String(query.scope || '').trim().toLowerCase() === 'home';

export const formatRestaurantListResponse = (restaurants, paginationInput) => {
    const pagination = buildPaginationMeta(paginationInput);
    return {
        data: restaurants,
        restaurants,
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNextPage: pagination.hasNextPage,
        hasPreviousPage: pagination.hasPreviousPage,
        pagination,
    };
};

export const emptyRestaurantListResponse = (page = 1, limit = HOME_LIST_DEFAULT_LIMIT) =>
    formatRestaurantListResponse([], { page, limit, total: 0 });
