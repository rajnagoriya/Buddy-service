import mongoose from 'mongoose';
import { Admin } from '../admin/models/Admin.js';
import { Owner } from '../admin/models/Owner.js';
import { ServiceStore } from '../admin/models/ServiceStore.js';
import { ServiceCenterStaff } from '../admin/models/ServiceCenterStaff.js';
import { ApiError } from '../../../utils/ApiError.js';
import { Driver } from '../driver/models/Driver.js';
import { BusDriver } from '../driver/models/BusDriver.js';
import { PoolingVehicle } from '../admin/models/PoolingVehicle.js';
import { User } from '../user/models/User.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { FoodUser } from '../../../core/users/user.model.js';
import { FoodAdmin } from '../../../core/admin/admin.model.js';
import { FoodDeliveryPartner } from '../../food/delivery/models/deliveryPartner.model.js';
import {
  normalizeAdminPermissions,
  normalizeAdminType,
} from '../admin/services/adminAccessService.js';

const roleModelMap = {
  admin: Admin,
  'super-admin': Admin,
  driver: Driver,
  pooling_driver: PoolingVehicle,
  bus_driver: BusDriver,
  owner: Owner,
  service_center: ServiceStore,
  service_center_staff: ServiceCenterStaff,
  user: User,
  delivery_partner: FoodDeliveryPartner,
};

const normalizeRole = (role = '') => {
  const value = String(role || '').toLowerCase();
  if (value === 'super-admin') {
    return 'admin';
  }
  return value;
};

const attachResolvedAuth = (req, payload) => {
  req.auth = {
    sub: payload.sub || payload.userId || payload.id,
    role: normalizeRole(payload.role),
    originalRole: payload.role,
  };
};

export const authenticate = (allowedRoles = [], options = {}) => async (req, _res, next) => {
  try {
    const allowPending = options?.allowPending === true;
    const authorization = req.headers.authorization || '';
    const [, token] = authorization.split(' ');

    if (!token) {
      throw new ApiError(401, 'Authorization token is required');
    }

    let payload = verifyAccessToken(token);

    let normalizedRole = normalizeRole(payload.role);

    // Bridge: Support DELIVERY_PARTNER with linked Taxi Driver profile
    if (normalizedRole === 'delivery_partner') {
      const userId = payload.sub || payload.userId || payload.id;
      const deliveryPartner = await FoodDeliveryPartner.findById(userId);
      if (deliveryPartner) {
        const linkedDriver = await Driver.findOne({ phone: deliveryPartner.phone });
        if (linkedDriver) {
          payload = {
            ...payload,
            role: 'driver',
            sub: String(linkedDriver._id),
          };
          normalizedRole = 'driver';
        }
      }
    }

    const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

    if (normalizedAllowedRoles.length > 0 && !normalizedAllowedRoles.includes(normalizedRole)) {
      throw new ApiError(403, 'Insufficient permissions for this resource');
    }

    const Model = roleModelMap[payload.role] || roleModelMap[normalizedRole];

    if (!Model) {
      throw new ApiError(401, 'Unsupported auth role');
    }

    const userId = payload.sub || payload.userId || payload.id;
    let entity = await Model.findById(userId);

    if (!entity && normalizedRole === 'admin') {
      try {
        entity = await FoodAdmin.findById(userId);
      } catch (err) {
        // Fallback failed
      }
    }

    if (!entity && normalizedRole === 'user') {
      try {
        entity = await FoodUser.findById(userId);
      } catch (err) {
        // Fallback failed
      }
    }

    if (!entity) {
      throw new ApiError(401, 'Authenticated account no longer exists');
    }

    if (
      normalizedRole === 'user' &&
      (entity.deletedAt || entity.isActive === false || entity.active === false)
    ) {
      throw new ApiError(401, 'User account is not active');
    }

    if (
      normalizedRole === 'driver' &&
      !allowPending &&
      (entity.approve === false || String(entity.status || '').toLowerCase() === 'pending')
    ) {
      throw new ApiError(403, 'Driver account is pending approval');
    }

    if (
      normalizedRole === 'owner' &&
      !allowPending &&
      (entity.active === false ||
        entity.approve === false ||
        String(entity.status || '').toLowerCase() === 'pending')
    ) {
      throw new ApiError(403, 'Owner account is pending approval');
    }

    if (
      normalizedRole === 'bus_driver' &&
      !allowPending &&
      (entity.active === false ||
        entity.approve === false ||
        ['pending', 'blocked'].includes(String(entity.status || '').toLowerCase()))
    ) {
      throw new ApiError(403, 'Bus driver account is pending approval');
    }

    if (
      normalizedRole === 'pooling_driver' &&
      !allowPending &&
      (entity.approve === false || String(entity.status || '').toLowerCase() === 'pending')
    ) {
      throw new ApiError(403, 'Pooling driver account is pending approval');
    }

    if (
      normalizedRole === 'pooling_driver' &&
      (entity.poolingEnabled === false ||
        ['inactive', 'maintenance'].includes(String(entity.status || '').toLowerCase()))
    ) {
      throw new ApiError(403, 'Pooling driver account is inactive');
    }

    if (
      normalizedRole === 'service_center' &&
      !allowPending &&
      (entity.active === false ||
        entity.approve === false ||
        String(entity.status || '').toLowerCase() === 'inactive')
    ) {
      throw new ApiError(403, 'Service center account is inactive');
    }

    if (
      normalizedRole === 'service_center_staff' &&
      !allowPending &&
      (entity.active === false ||
        entity.approve === false ||
        String(entity.status || '').toLowerCase() === 'inactive')
    ) {
      throw new ApiError(403, 'Service center staff account is inactive');
    }

    attachResolvedAuth(req, payload);
    req.auth.entity = entity;

    if (normalizedRole === 'admin') {
      const isFoodAdmin = !entity.hasOwnProperty('admin_type') && entity.hasOwnProperty('isActive');
      const fallbackPermissions = (entity.role === 'ADMIN' || entity.role === 'superadmin' || entity.role === 'super-admin') ? ['*'] : [];
      
      req.auth.admin = {
        id: String(entity._id),
        email: entity.email || '',
        name: entity.name || '',
        role: entity.role || '',
        admin_type: normalizeAdminType(entity.admin_type || entity.role),
        permissions: normalizeAdminPermissions(entity.permissions || fallbackPermissions),
        service_location_ids: Array.isArray(entity.service_location_ids)
          ? entity.service_location_ids.map((item) => String(item))
          : [],
        zone_ids: Array.isArray(entity.zone_ids)
          ? entity.zone_ids.map((item) => String(item))
          : [],
        active: entity.active !== false && entity.isActive !== false,
        status: entity.status || (entity.isActive === false ? 'inactive' : 'active'),
      };

      if (req.auth.admin.active === false || String(req.auth.admin.status).toLowerCase() === 'inactive') {
        throw new ApiError(403, 'Admin account is inactive');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
