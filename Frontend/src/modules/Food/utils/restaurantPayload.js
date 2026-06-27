export const extractRestaurantPayload = (response) =>
  response?.data?.data?.restaurant ||
  response?.data?.restaurant ||
  response?.data?.data?.user ||
  response?.data?.user ||
  response?.data?.data ||
  null

export const extractOnboardingPayload = (response) =>
  response?.data?.data?.onboarding || response?.data?.onboarding || null
