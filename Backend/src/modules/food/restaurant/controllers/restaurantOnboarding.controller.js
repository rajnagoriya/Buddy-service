import { sendResponse } from "../../../../utils/response.js";
import {
  getOnboardingProgress,
  saveOnboardingStep,
  submitOnboarding,
} from "../services/restaurantOnboarding.service.js";

export const getOnboardingProgressController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const onboarding = await getOnboardingProgress(restaurantId);
    return sendResponse(res, 200, "Onboarding progress fetched", { onboarding });
  } catch (error) {
    next(error);
  }
};

export const saveOnboardingStepController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const stepNumber = Number(req.params.step);
    const onboarding = await saveOnboardingStep(
      restaurantId,
      stepNumber,
      req.body || {},
      req.files,
    );
    return sendResponse(res, 200, "Onboarding step saved", { onboarding });
  } catch (error) {
    next(error);
  }
};

export const submitOnboardingController = async (req, res, next) => {
  try {
    const restaurantId = req.user?.userId;
    const onboarding = await submitOnboarding(
      restaurantId,
      req.body || {},
      req.files,
    );
    return sendResponse(res, 200, "Onboarding submitted for review", {
      onboarding,
    });
  } catch (error) {
    next(error);
  }
};
