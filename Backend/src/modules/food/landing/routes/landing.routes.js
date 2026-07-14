import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import {
    listHeroBannersController,
    uploadHeroBannersController,
    deleteHeroBannerController,
    updateHeroBannerOrderController,
    toggleHeroBannerStatusController
} from '../controllers/heroBanner.controller.js';
import {
    listUnder250BannersController,
    uploadUnder250BannersController,
    deleteUnder250BannerController,
    updateUnder250BannerOrderController,
    toggleUnder250BannerStatusController
} from '../controllers/under250Banner.controller.js';
import {
    listDiningBannersController,
    uploadDiningBannersController,
    deleteDiningBannerController,
    updateDiningBannerOrderController,
    toggleDiningBannerStatusController
} from '../controllers/diningBanner.controller.js';
import {
    getAdminLandingSettingsController,
    updateAdminLandingSettingsController
} from '../controllers/landingSettings.controller.js';
import {
    listExploreMoreController,
    createExploreMoreController,
    updateExploreMoreController,
    deleteExploreMoreController,
    toggleExploreMoreStatusController,
    updateExploreMoreOrderController
} from '../controllers/exploreIcon.controller.js';
import {
    getPublicHeroBannersController,
    getPublicUnder250BannersController,
    getPublicDiningBannersController,
    getPublicExploreIconsController,
    getPublicGourmetController,
    getPublicLandingSettingsController
} from '../controllers/publicLanding.controller.js';
import { detectZonePublicController, listZonesPublicController, listZonesNearbyPublicController } from '../controllers/zonePublic.controller.js';
import { getPublicEnvController } from '../controllers/publicEnv.controller.js';
import {
    listGourmetAdmin,
    createGourmetAdmin,
    deleteGourmetAdmin,
    updateGourmetOrderAdmin,
    toggleGourmetStatusAdmin
} from '../controllers/top10GourmetAdmin.controller.js';
import { getPublicPageController } from '../../admin/controllers/pageContent.controller.js';
import { getPublicReferralSettingsController } from '../controllers/publicReferralSettings.controller.js';
import { cacheResponse } from '../../../../middleware/cache.js';
import {
    withFoodCacheInvalidation,
    invalidateAfterLandingMutation,
    invalidateAfterLandingSettingsMutation,
} from '../../utils/foodCacheInvalidation.js';

const router = express.Router();
const invLanding = withFoodCacheInvalidation(invalidateAfterLandingMutation);
const invLandingSettings = withFoodCacheInvalidation(invalidateAfterLandingSettingsMutation);

// Public CMS pages (About + legal). No auth required.
router.get('/pages/:key', getPublicPageController);
// Public referral settings (no auth required).
router.get('/referral-settings', getPublicReferralSettingsController);

// Admin hero banner management (DEV: auth temporarily disabled for faster integration)
router.get('/hero-banners', listHeroBannersController);
router.post(
    '/hero-banners/multiple',
    upload.array('files'),
    invLanding,
    uploadHeroBannersController
);
router.delete('/hero-banners/:id', invLanding, deleteHeroBannerController);
router.patch('/hero-banners/:id/order', invLanding, updateHeroBannerOrderController);
router.patch('/hero-banners/:id/status', invLanding, toggleHeroBannerStatusController);

// Admin under 250 banners
router.get('/hero-banners/under-250', listUnder250BannersController);
router.post(
    '/hero-banners/under-250/multiple',
    upload.array('files'),
    invLanding,
    uploadUnder250BannersController
);
router.delete('/hero-banners/under-250/:id', invLanding, deleteUnder250BannerController);
router.patch('/hero-banners/under-250/:id/order', invLanding, updateUnder250BannerOrderController);
router.patch('/hero-banners/under-250/:id/status', invLanding, toggleUnder250BannerStatusController);

// Admin dining banners
router.get('/hero-banners/dining', listDiningBannersController);
router.post(
    '/hero-banners/dining/multiple',
    upload.array('files'),
    invLanding,
    uploadDiningBannersController
);
router.delete('/hero-banners/dining/:id', invLanding, deleteDiningBannerController);
router.patch('/hero-banners/dining/:id/order', invLanding, updateDiningBannerOrderController);
router.patch('/hero-banners/dining/:id/status', invLanding, toggleDiningBannerStatusController);

// Admin Explore More (icons)
router.get('/hero-banners/landing/explore-more', listExploreMoreController);
router.post(
    '/hero-banners/landing/explore-more',
    upload.single('image'),
    invLanding,
    createExploreMoreController
);
router.delete('/hero-banners/landing/explore-more/:id', invLanding, deleteExploreMoreController);
router.patch('/hero-banners/landing/explore-more/:id/status', invLanding, toggleExploreMoreStatusController);
router.patch('/hero-banners/landing/explore-more/:id/order', invLanding, updateExploreMoreOrderController);
router.patch(
    '/hero-banners/landing/explore-more/:id',
    upload.single('image'),
    invLanding,
    updateExploreMoreController
);

// Admin Gourmet (hero-banners)
router.get('/hero-banners/gourmet', listGourmetAdmin);
router.post('/hero-banners/gourmet', invLanding, createGourmetAdmin);
router.delete('/hero-banners/gourmet/:id', invLanding, deleteGourmetAdmin);
router.patch('/hero-banners/gourmet/:id/order', invLanding, updateGourmetOrderAdmin);
router.patch('/hero-banners/gourmet/:id/status', invLanding, toggleGourmetStatusAdmin);

// Public landing endpoints (Food user app)
router.get('/hero-banners/public', cacheResponse(300, 'food_landing'), getPublicHeroBannersController);
router.get('/hero-banners/under-250/public', cacheResponse(300, 'food_landing'), getPublicUnder250BannersController);
router.get('/hero-banners/dining/public', cacheResponse(300, 'food_landing'), getPublicDiningBannersController);
router.get('/explore-icons/public', cacheResponse(600, 'food_landing'), getPublicExploreIconsController);
router.get('/hero-banners/gourmet/public', cacheResponse(300, 'food_landing'), getPublicGourmetController);
router.get('/landing/settings/public', cacheResponse(600, 'food_landing'), getPublicLandingSettingsController);
router.get('/zones/detect', cacheResponse(120, 'food_zones'), detectZonePublicController);
router.get('/zones/nearby', cacheResponse(120, 'food_zones'), listZonesNearbyPublicController);
router.get('/zones/public', cacheResponse(30, 'food_zones'), listZonesPublicController);
router.get('/public/env', cacheResponse(300, 'food_env'), getPublicEnvController);
// Admin landing settings (old paths used by admin UI)
router.get('/hero-banners/landing/settings', getAdminLandingSettingsController);
router.patch('/hero-banners/landing/settings', invLandingSettings, updateAdminLandingSettingsController);

export default router;

