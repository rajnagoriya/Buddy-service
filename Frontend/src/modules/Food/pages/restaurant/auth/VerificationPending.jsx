import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AlertCircle, Clock3, ShieldCheck } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { restaurantAPI } from "@food/api"
import {
  clearRestaurantPendingPhone,
  getModuleToken,
  getRestaurantPendingPhone,
} from "@food/utils/auth"
import { resolveRestaurantOnboardingStatus } from "@food/utils/onboardingUtils"
import RestaurantAuthLayout from "@food/components/restaurant/auth/RestaurantAuthLayout"

export default function VerificationPending() {
  const navigate = useNavigate()
  const location = useLocation()
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [onboardingStatus, setOnboardingStatus] = useState(
    () => location.state?.isRejected ? "REJECTED" : "SUBMITTED",
  )
  const [isRejected, setIsRejected] = useState(() => Boolean(location.state?.isRejected))
  const [rejectionReason, setRejectionReason] = useState(
    () => location.state?.rejectionReason || "",
  )
  const [resumeStep, setResumeStep] = useState(
    () => Number(location.state?.rejectionStep) || 1,
  )

  const pendingPhone = useMemo(() => {
    return location.state?.phone || getRestaurantPendingPhone() || ""
  }, [location.state?.phone])

  useEffect(() => {
    let cancelled = false

    const checkApprovalStatus = async () => {
      const token = getModuleToken("restaurant")
      if (!token) {
        if (!cancelled) setCheckingStatus(false)
        return
      }

      try {
        const response = await restaurantAPI.getOnboardingProgress()
        const onboarding =
          response?.data?.data?.onboarding || response?.data?.onboarding

        if (cancelled) return

        const status = resolveRestaurantOnboardingStatus(onboarding)
        setOnboardingStatus(status)

        if (status === "APPROVED") {
          clearRestaurantPendingPhone()
          navigate("/food/restaurant", { replace: true })
          return
        }

        if (status === "REJECTED") {
          setIsRejected(true)
          setRejectionReason(
            onboarding?.adminRemarks ||
              location.state?.rejectionReason ||
              "Please review your documents and update your registration.",
          )
          setResumeStep(
            Number(onboarding?.rejectionStep || onboarding?.currentStep) || 1,
          )
          return
        }

        if (status === "IN_PROGRESS" || status === "NOT_STARTED") {
          if (location.state?.fromRejection) return
          navigate(
            `/food/restaurant/onboarding?step=${onboarding?.currentStep || 1}`,
            { replace: true, state: { fromRejection: true } },
          )
        }
      } catch (_) {
        try {
          const response = await restaurantAPI.getCurrentRestaurant()
          const restaurant =
            response?.data?.data?.restaurant ||
            response?.data?.restaurant

          if (cancelled) return

          if (String(restaurant?.status || "").toLowerCase() === "approved") {
            clearRestaurantPendingPhone()
            navigate("/food/restaurant", { replace: true })
          }
        } catch {
          // Keep the current screen if status check fails.
        }
      } finally {
        if (!cancelled) setCheckingStatus(false)
      }
    }

    checkApprovalStatus()

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkApprovalStatus()
      }
    }

    window.addEventListener("focus", handleVisibilityOrFocus)
    document.addEventListener("visibilitychange", handleVisibilityOrFocus)

    return () => {
      cancelled = true
      window.removeEventListener("focus", handleVisibilityOrFocus)
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus)
    }
  }, [navigate, location.state?.fromRejection, location.state?.rejectionReason])

  const handleRefillOnboarding = () => {
    const step = Math.min(3, Math.max(1, resumeStep || 1))
    navigate(`/food/restaurant/onboarding?step=${step}`, {
      replace: true,
      state: { fromRejection: true, isRejected: true, rejectionReason },
    })
  }

  return (
    <RestaurantAuthLayout
      title={isRejected ? "Registration Rejected" : "Verification Pending"}
      subtitle={
        isRejected
          ? "Your restaurant registration was rejected by our team. Please review the reason below and refill your onboarding details."
          : "Your restaurant profile has been submitted successfully. Our team is reviewing your documents and information."
      }
    >
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="flex justify-center">
          {isRejected ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 shadow-sm">
              <AlertCircle className="h-8 w-8" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 shadow-sm">
              <Clock3 className="h-8 w-8 animate-pulse" />
            </div>
          )}
        </div>

        <div className="w-full space-y-4">
          {!isRejected ? (
            <div className="text-center">
              <p className="text-sm font-semibold text-amber-600">
                Status:{" "}
                {onboardingStatus === "UNDER_REVIEW" ? "Under Review" : "Pending Review"}
              </p>
              {checkingStatus ? (
                <p className="mt-1 text-xs text-gray-400">Checking approval status...</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm font-bold text-red-700">You are rejected</p>
              <p className="mt-1 text-xs text-red-600">
                Update your details and submit again for review.
              </p>
            </div>
          )}

          {isRejected ? (
            <div className="rounded-xl border border-red-100 bg-red-50/80 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                Rejection reason
              </p>
              <p className="text-sm font-medium leading-relaxed text-red-900">
                {rejectionReason ||
                  "No specific reason was provided. Please verify all documents and details."}
              </p>
            </div>
          ) : null}

          {!isRejected ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">What&apos;s next?</p>
                  <p className="mt-1">
                    Please wait until verification is completed. We&apos;ll notify you once
                    approved.
                  </p>
                  {pendingPhone ? (
                    <p className="mt-2 text-xs font-medium text-gray-400">
                      ID: <span className="text-gray-600">{pendingPhone}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3 pt-2">
            {isRejected ? (
              <Button
                className="h-11 w-full rounded-xl bg-primary-orange text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-orange/90"
                onClick={handleRefillOnboarding}
              >
                Refill onboarding (Step {Math.min(3, Math.max(1, resumeStep || 1))})
              </Button>
            ) : (
              <Button
                className="h-11 w-full rounded-xl bg-primary-orange text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-orange/90"
                onClick={() => {
                  clearRestaurantPendingPhone()
                  navigate("/food/restaurant/login", { replace: true })
                }}
              >
                Back to Login
              </Button>
            )}

            {isRejected ? (
              <button
                type="button"
                className="w-full text-center text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
                onClick={() => {
                  clearRestaurantPendingPhone()
                  navigate("/food/restaurant/login", { replace: true })
                }}
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </RestaurantAuthLayout>
  )
}
