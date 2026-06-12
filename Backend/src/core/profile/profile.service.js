import { FoodUser } from '../users/user.model.js';
import { User as TaxiUser } from '../../modules/taxi/user/models/User.js';
import { UserWallet as TaxiWallet } from '../../modules/taxi/user/models/UserWallet.js';
import { UserSubscription as TaxiSubscription } from '../../modules/taxi/user/models/UserSubscription.js';
import { Ride as TaxiRide } from '../../modules/taxi/user/models/Ride.js';
import QCOrder from '../../modules/quickCommerce/models/order.js';
import QCWishlist from '../../modules/quickCommerce/models/wishlist.js';
import QCPreference from '../../modules/quickCommerce/modules/notifications/preference.model.js';
import { FoodReferralSettings } from '../../modules/food/admin/models/referralSettings.model.js';
import { FoodUserWallet } from '../../modules/food/user/models/userWallet.model.js';

export const getMasterProfile = async (userId) => {
    // Phase 1: Primary lookup of FoodUser (buddy_users) to retrieve phone
    const foodUser = await FoodUser.findById(userId).lean();
    if (!foodUser) {
        throw new Error('User not found');
    }

    // Phase 2: Parallel Block 1 (Retrieve TaxiUser & QC data)
    const [taxiUser, orderCount, wishlistDoc, notificationPref, referralSettings, foodWallet] = await Promise.all([
        TaxiUser.findOne({ phone: foodUser.phone }).lean(),
        QCOrder.countDocuments({ customer: userId }),
        QCWishlist.findOne({ customerId: userId }).select('products').lean(),
        QCPreference.findOne({ userId, role: 'customer' }).lean(),
        FoodReferralSettings.findOne({ isActive: true }).lean(),
        FoodUserWallet.findOne({ userId }).select('balance referralEarnings').lean()
    ]);

    const wishlistCount = wishlistDoc?.products?.length || 0;

    let taxi = null;
    let hasTaxiModule = false;
    let taxiWalletBalance = 0;
    let taxiRideCount = 0;
    let taxiRating = 4.9;

    // Phase 3: Parallel Block 2 (Taxi Metrics) - executed only if Taxi profile exists
    if (taxiUser) {
        hasTaxiModule = true;
        taxiRating = typeof taxiUser.rating === 'number' ? taxiUser.rating : 4.9;

        const possibleIds = [taxiUser._id];
        const directTaxiUser = await TaxiUser.findById(userId).select('_id').lean();
        if (directTaxiUser) {
            possibleIds.push(directTaxiUser._id);
        }
        if (userId) {
            possibleIds.push(userId);
        }

        let wallet = null;
        for (const id of possibleIds) {
            wallet = await TaxiWallet.findOne({ userId: id }).select('balance').lean();
            if (wallet && wallet.balance > 0) {
                break; // Found the wallet with the balance!
            }
        }
        
        // If no wallet with balance found, just use the first one found or null
        if (!wallet) {
            wallet = await TaxiWallet.findOne({ userId: { $in: possibleIds } }).select('balance').lean();
        }

        const [rideCount, activeSub] = await Promise.all([
            TaxiRide.countDocuments({ userId: { $in: possibleIds } }),
            TaxiSubscription.findOne({
                userId: { $in: possibleIds },
                status: 'active'
            }).lean()
        ]);

        taxiWalletBalance = wallet?.balance || 0;
        taxiRideCount = rideCount || 0;

        let taxiActiveSubscription = null;
        if (activeSub) {
            taxiActiveSubscription = {
                name: activeSub.name || 'Active Plan',
                expiresAt: activeSub.expiresAt || null
            };
        }

        taxi = {
            rideCount: Number(taxiRideCount),
            rating: Number(taxiRating),
            kycStatus: taxiUser.governmentIdProof?.imageUrl ? 'Verified' : 'Pending',
            governmentIdProof: taxiUser.governmentIdProof || null,
            activeSubscription: taxiActiveSubscription
        };
    }

    // Assemble QC info
    const qc = {
        orderCount: Number(orderCount || 0),
        wishlistCount: Number(wishlistCount || 0),
        preferences: {
            vegMode: false,
            theme: 'light',
            notificationPreferences: notificationPref ? {
                orderUpdates: notificationPref.orderUpdates,
                deliveryUpdates: notificationPref.deliveryUpdates,
                promotions: notificationPref.promotions
            } : {
                orderUpdates: true,
                deliveryUpdates: true,
                promotions: false
            }
        }
    };

    // Construct unified modules object with summary metadata
    const modules = {
        food: true,
        qc: {
            enabled: true,
            orderCount: Number(orderCount || 0),
            wishlistCount: Number(wishlistCount || 0)
        },
        taxi: hasTaxiModule ? {
            enabled: true,
            rideCount: Number(taxiRideCount),
            rating: Number(taxiRating)
        } : {
            enabled: false,
            rideCount: 0,
            rating: 0
        }
    };

    return {
        personal: {
            name: foodUser.name || '',
            phone: foodUser.phone || '',
            email: foodUser.email || '',
            profileImage: foodUser.profileImage || '',
            gender: foodUser.gender || '',
            dateOfBirth: foodUser.dateOfBirth || null,
            anniversary: foodUser.anniversary || null
        },
        addresses: foodUser.addresses || [],
        wallets: {
            food_qc_balance: Number(foodWallet?.balance || 0),
            taxi_balance: Number(taxiWalletBalance)
        },
        referrals: {
            food_code: foodUser.referralCode || '',
            food_count: Number(foodUser.referralCount || 0),
            food_reward: Number(referralSettings?.referralRewardUser || 0),
            taxi_code: taxiUser?.referralCode || '',
            taxi_count: Number(taxiUser?.referralCount || 0)
        },
        modules,
        taxi,
        qc
    };
};
