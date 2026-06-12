import { ApiError } from '../../../../utils/ApiError.js';
import { FoodDeliveryPartner } from '../models/deliveryPartner.model.js';
import { Driver } from '../../../taxi/driver/models/Driver.js';
import { hashPassword } from '../../../taxi/driver/services/authService.js';
import { signAccessToken } from '../../../taxi/services/tokenService.js';
import { VEHICLE_TYPES } from '../../../taxi/constants/index.js';

const normalizeVehicleType = (value = '') => {
    const vehicleText = String(value || '').trim().toLowerCase();

    if (vehicleText.includes('bike') || vehicleText.includes('scooter')) return 'bike';
    if (vehicleText.includes('auto') || vehicleText.includes('rickshaw')) return 'auto';
    if (VEHICLE_TYPES.includes(vehicleText)) return vehicleText;
    return 'bike';
};

export const createDeliveryTaxiProfile = async (userId) => {
    const deliveryPartner = await FoodDeliveryPartner.findById(userId);

    if (!deliveryPartner) {
        throw new ApiError(404, 'Delivery partner not found');
    }

    console.log("DELIVERY_PARTNER", deliveryPartner?._id);
    console.log("PHONE", deliveryPartner?.phone);

    const existingDriver = await Driver.findOne({
        deliveryPartnerId: deliveryPartner._id,
    });

    if (existingDriver) {
        const token = signAccessToken({ sub: String(existingDriver._id), role: 'driver' });
        console.log("TOKEN_CREATED", !!token);
        return {
            token,
            driver: existingDriver,
            created: false,
        };
    }

    const vehicleType = normalizeVehicleType(deliveryPartner.vehicleType);
    const isApproved = deliveryPartner.status === 'approved';

    console.log("CREATING_DRIVER");
    const driver = await Driver.create({
        name: deliveryPartner.name,
        phone: deliveryPartner.phone,
        email: deliveryPartner.email || '',
        password: await hashPassword(String(deliveryPartner.phone || '')),
        vehicleType,
        vehicleNumber: deliveryPartner.vehicleNumber || '',
        vehicleModel: deliveryPartner.vehicleName || '',
        profile_picture: deliveryPartner.profilePhoto || '',
        profileImage: deliveryPartner.profilePhoto || '',
        city: deliveryPartner.city || '',
        deliveryPartnerId: deliveryPartner._id,
        approve: isApproved,
        status: isApproved ? 'approved' : 'pending',
        registerFor: 'taxi',
        location: deliveryPartner.location || { type: 'Point', coordinates: [0, 0] },
    });

    console.log("DRIVER_CREATED", driver._id);
    const token = signAccessToken({ sub: String(driver._id), role: 'driver' });
    console.log("TOKEN_CREATED", !!token);

    return {
        token,
        driver,
        created: true,
    };
};
