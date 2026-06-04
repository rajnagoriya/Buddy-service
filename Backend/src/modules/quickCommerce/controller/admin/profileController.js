import Admin from "../../models/admin.js";
import { FoodAdmin } from "../../../../core/admin/admin.model.js";
import handleResponse from "../../utils/helper.js";

export const getAdminProfile = async (req, res) => {
  try {
    console.log('[ProfileService] Fetching admin profile for ID:', req.user?.id);
    const uid = req.user?.id || req.user?.userId;
    if (!uid) {
      console.error('[ProfileService] Missing ID in req.user');
      return handleResponse(res, 400, "Missing user ID in session");
    }

    // Try QC admin collection first
    let admin = await Admin.findById(uid);

    // Fall back to Food admin collection (single-login support)
    if (!admin) {
      const foodAdmin = await FoodAdmin.findById(uid).select("-password").lean();
      if (foodAdmin) {
        console.log('[ProfileService] Admin found in food_admins for:', foodAdmin.email);
        return handleResponse(
          res,
          200,
          "Admin profile fetched successfully",
          {
            _id: foodAdmin._id,
            name: foodAdmin.name || "",
            email: foodAdmin.email || "",
            phone: foodAdmin.phone || "",
            role: "admin",
            profileImage: foodAdmin.profileImage || "",
            isVerified: true,
            createdAt: foodAdmin.createdAt,
            updatedAt: foodAdmin.updatedAt,
          },
        );
      }
      console.warn('[ProfileService] Admin document not found in any collection for ID:', uid);
      return handleResponse(res, 404, "Admin not found");
    }

    console.log('[ProfileService] Successfully fetched profile for:', admin.email);
    return handleResponse(
      res,
      200,
      "Admin profile fetched successfully",
      admin,
    );
  } catch (error) {
    console.error('[ProfileService] FATAL ERROR:', error);
    return handleResponse(res, 500, error.message);
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    const { name, email, phone, profileImage } = req.body;
    const uid = req.user?.id || req.user?.userId;

    let admin = await Admin.findById(uid);
    if (!admin) {
      // Fall back to Food admin
      const foodAdmin = await FoodAdmin.findById(uid);
      if (!foodAdmin) {
        return handleResponse(res, 404, "Admin not found");
      }
      if (name) foodAdmin.name = name;
      if (email) foodAdmin.email = email;
      if (phone !== undefined) foodAdmin.phone = phone;
      if (profileImage !== undefined) foodAdmin.profileImage = profileImage;
      await foodAdmin.save();
      const updated = foodAdmin.toObject();
      delete updated.password;
      return handleResponse(res, 200, "Admin profile updated successfully", {
        _id: updated._id,
        name: updated.name || "",
        email: updated.email || "",
        phone: updated.phone || "",
        role: "admin",
        profileImage: updated.profileImage || "",
        isVerified: true,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }

    if (name) admin.name = name;
    if (email) admin.email = email;
    if (phone !== undefined) admin.phone = phone;
    if (profileImage !== undefined) admin.profileImage = profileImage;

    const updatedAdmin = await admin.save();
    return handleResponse(res, 200, "Admin profile updated successfully", updatedAdmin);
  } catch (error) {
    if (error.code === 11000) {
      return handleResponse(res, 400, "Email already in use");
    }
    return handleResponse(res, 500, error.message);
  }
};

export const updateAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const uid = req.user?.id || req.user?.userId;

    let admin = await Admin.findById(uid).select("+password");
    if (!admin) {
      // Fall back to Food admin
      admin = await FoodAdmin.findById(uid);
      if (!admin) {
        return handleResponse(res, 404, "Admin not found");
      }
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return handleResponse(res, 401, "Invalid current password");
    }

    admin.password = newPassword;
    await admin.save();

    return handleResponse(res, 200, "Password updated successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
