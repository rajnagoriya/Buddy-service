import { getMasterProfile } from './profile.service.js';

export const getMasterProfileController = async (req, res) => {
    const userId = req.user.id || req.user.userId;
    const profile = await getMasterProfile(userId);
    return res.status(200).json({
        success: true,
        message: "Master profile fetched successfully",
        data: profile
    });
};
