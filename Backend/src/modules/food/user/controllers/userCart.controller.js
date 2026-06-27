import { sendResponse } from '../../../../utils/response.js';
import {
  getUserCart,
  syncUserCart,
  validateCartRestaurants,
} from '../services/userCart.service.js';
import {
  validateSyncCartDto,
  validateRestaurantAvailabilityDto,
} from '../validators/userCart.validator.js';

export const getUserCartController = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const result = await getUserCart(userId);
    return sendResponse(res, 200, 'Cart retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

export const syncUserCartController = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const dto = validateSyncCartDto(req.body);
    const result = await syncUserCart(userId, dto);
    return sendResponse(res, 200, 'Cart saved successfully', result);
  } catch (err) {
    next(err);
  }
};

export const validateCartRestaurantsController = async (req, res, next) => {
  try {
    const dto = validateRestaurantAvailabilityDto(req.body);
    const result = await validateCartRestaurants(dto);
    return sendResponse(res, 200, 'Restaurant availability validated', result);
  } catch (err) {
    next(err);
  }
};
