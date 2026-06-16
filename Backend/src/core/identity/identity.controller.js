import { sendResponse } from '../../utils/response.js';
import { validateUnifiedOtpRequestDto } from '../../dtos/auth/unifiedOtpRequest.dto.js';
import { validateUnifiedOtpVerifyDto } from '../../dtos/auth/unifiedOtpVerify.dto.js';
import { requestOtpUnified, verifyOtpUnified } from './identity.service.js';

export const requestOtpUnifiedController = async (req, res, next) => {
  try {
    const payload = validateUnifiedOtpRequestDto(req.body);
    const result = await requestOtpUnified(payload);
    return sendResponse(res, 200, 'OTP sent successfully', result);
  } catch (error) {
    next(error);
  }
};

export const verifyOtpUnifiedController = async (req, res, next) => {
  try {
    const payload = validateUnifiedOtpVerifyDto(req.body);
    const result = await verifyOtpUnified(payload);
    return sendResponse(res, 200, 'Login successful', result);
  } catch (error) {
    next(error);
  }
};
