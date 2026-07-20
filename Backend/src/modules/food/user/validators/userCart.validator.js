import { ValidationError } from '../../../../core/auth/errors.js';

export const deriveCartType = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const restaurantIds = new Set(
    items.map((item) => String(item.restaurantId || '').trim()).filter(Boolean),
  );
  const lineItemIds = new Set(
    items.map((item) => String(item.lineItemId || item.itemId || '').trim()).filter(Boolean),
  );

  return {
    restaurantScope: restaurantIds.size > 1 ? 'multi_restaurant' : 'single_restaurant',
    itemScope: lineItemIds.size > 1 ? 'multi_item' : 'single_item',
  };
};

const normalizeCartItem = (item, index) => {
  if (!item || typeof item !== 'object') {
    throw new ValidationError(`Cart item at index ${index} is invalid`);
  }

  const restaurantId = String(
    item.restaurantId || item.restaurant_id || item.restaurant?._id || '',
  ).trim();
  if (!restaurantId) {
    throw new ValidationError(`Cart item at index ${index} is missing restaurantId`);
  }

  const quantity = Number(item.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new ValidationError(`Cart item at index ${index} has invalid quantity`);
  }

  const price = Number(item.price);
  const variantPrice = Number(item.variantPrice ?? item.price ?? 0);

  return {
    lineItemId: String(item.lineItemId || item.id || item.cartLineId || `line-${index}`).trim(),
    itemId: String(item.itemId || item.productId || item.id || `item-${index}`).trim(),
    productId: String(item.productId || item.itemId || item.id || `item-${index}`).trim(),
    variantId: String(item.variantId || item.variant?._id || item.variant?.id || '').trim(),
    variantName: String(item.variantName || item.variant?.name || '').trim(),
    variantPrice: Number.isFinite(variantPrice) ? variantPrice : 0,
    name: String(item.name || item.product?.name || 'Item').trim(),
    price: Number.isFinite(price) ? price : 0,
    quantity: Math.floor(quantity),
    imageUrl: String(item.imageUrl || item.image || item.product?.imageUrl || '').trim(),
    description: String(item.description || '').trim(),
    restaurant: String(
      item.restaurant || item.restaurant?.name || item.restaurantName || '',
    ).trim(),
    restaurantId,
    latitude: Number.isFinite(Number(item.latitude)) ? Number(item.latitude) : undefined,
    longitude: Number.isFinite(Number(item.longitude)) ? Number(item.longitude) : undefined,
    isVeg: item.isVeg === true || item.foodType === 'Veg',
    foodType: item.foodType ? String(item.foodType) : undefined,
    preparationTime: Number.isFinite(Number(item.preparationTime))
      ? Number(item.preparationTime)
      : undefined,
    specialInstructions: String(item.specialInstructions || item.instructions || '').trim(),
  };
};

const normalizeRestaurantMeta = (entry, index) => {
  if (!entry || typeof entry !== 'object') {
    throw new ValidationError(`Restaurant meta at index ${index} is invalid`);
  }
  const restaurantId = String(entry.restaurantId || '').trim();
  if (!restaurantId) {
    throw new ValidationError(`Restaurant meta at index ${index} is missing restaurantId`);
  }
  const lastKnownStatus = entry.lastKnownStatus === 'closed' ? 'closed' : 'open';
  const lastValidatedAt = entry.lastValidatedAt ? new Date(entry.lastValidatedAt) : null;
  return {
    restaurantId,
    lastKnownStatus,
    lastValidatedAt: lastValidatedAt && !Number.isNaN(lastValidatedAt.getTime())
      ? lastValidatedAt
      : null,
  };
};

export const validateSyncCartDto = (body = {}) => {
  const items = Array.isArray(body.items) ? body.items.map(normalizeCartItem) : [];
  const restaurantMeta = Array.isArray(body.restaurantMeta)
    ? body.restaurantMeta.map(normalizeRestaurantMeta)
    : [];
  const cartType = deriveCartType(items);
  return { items, restaurantMeta, cartType };
};

export const validateRestaurantAvailabilityDto = (body = {}) => {
  const restaurants = Array.isArray(body.restaurants) ? body.restaurants : [];
  if (restaurants.length === 0) {
    throw new ValidationError('At least one restaurant is required for validation');
  }

  const normalized = restaurants.map((entry, index) => {
    const restaurantId = String(entry?.restaurantId || '').trim();
    if (!restaurantId) {
      throw new ValidationError(`Restaurant at index ${index} is missing restaurantId`);
    }
    return {
      restaurantId,
      lastKnownStatus: entry.lastKnownStatus === 'closed' ? 'closed' : 'open',
      lastValidatedAt: entry.lastValidatedAt ? new Date(entry.lastValidatedAt) : null,
    };
  });

  return {
    restaurants: normalized,
    force: body.force === true,
  };
};
