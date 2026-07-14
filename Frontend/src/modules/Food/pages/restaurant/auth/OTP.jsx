import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Loader2, RefreshCw, Timer } from "lucide-react"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"
import { Button } from "@food/components/ui/button"
import {
  setAuthData as setRestaurantAuthData,
  setRestaurantPendingPhone,
} from "@food/utils/auth"
import { checkOnboardingStatus, isRestaurantOnboardingComplete } from "@food/utils/onboardingUtils"
import RestaurantAuthLayout from "@food/components/restaurant/auth/RestaurantAuthLayout"

export default function RestaurantOTP() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnPath = location.state?.from
  const [otp, setOtp] = useState(["", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [contactInfo, setContactInfo] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(null)
  const inputRefs = useRef([])
  const hasSubmittedRef = useRef(false)

  useEffect(() => {
    const stored = sessionStorage.getItem("restaurantAuthData")
    if (stored) {
      const data = JSON.parse(stored)
      setAuthData(data)

      if (data.method === "email" && data.email) {
        setContactInfo(data.email)
      } else if (data.phone) {
        const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
        if (phoneMatch) {
          const formattedPhone = `${phoneMatch[1]} ${phoneMatch[2].replace(/\D/g, "")}`
          setContactInfo(formattedPhone)
        } else {
          setContactInfo(data.phone || "")
        }
      }
    } else {
      navigate("/food/restaurant/login")
      return
    }

    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [navigate])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const applyOtpDigits = (rawValue, startIndex = 0) => {
    const digits = String(rawValue || "")
      .replace(/\D/g, "")
      .slice(0, 4 - startIndex)
    if (!digits.length) return

    setOtp((prev) => {
      const newOtp = [...prev]
      for (let i = 0; i < digits.length && startIndex + i < 4; i += 1) {
        newOtp[startIndex + i] = digits[i]
      }

      window.setTimeout(() => {
        const nextEmpty = newOtp.findIndex((digit) => !digit)
        const focusIndex = nextEmpty === -1 ? 3 : nextEmpty
        inputRefs.current[focusIndex]?.focus()

        if (newOtp.every((digit) => digit !== "") && !hasSubmittedRef.current) {
          hasSubmittedRef.current = true
          handleVerify(newOtp.join(""))
        }
      }, 0)

      return newOtp
    })
  }

  const handleChange = (index, value) => {
    const digits = value.replace(/\D/g, "")

    if (digits.length > 1) {
      const previousDigit = otp[index]
      // Some mobile keyboards don't honor maxLength=1 and append the new
      // keystroke to the existing value instead of replacing it. In that
      // case the extra characters aren't a paste/autofill of the full code -
      // they're "old digit + newly typed digit(s)", so we keep only what
      // was typed after the existing value instead of treating index as a
      // paste start (which would keep the stale old digit).
      if (previousDigit && digits.startsWith(previousDigit)) {
        const typed = digits.slice(previousDigit.length)
        const newDigit = typed.slice(-1)
        if (!newDigit) return
        const newOtp = [...otp]
        newOtp[index] = newDigit
        setOtp(newOtp)
        if (index < otp.length - 1) {
          inputRefs.current[index + 1]?.focus()
        }
        if (newOtp.every((digit) => digit !== "") && !hasSubmittedRef.current) {
          hasSubmittedRef.current = true
          handleVerify(newOtp.join(""))
        }
        return
      }

      applyOtpDigits(digits, index)
      return
    }

    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value && index < otp.length - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newOtp.every((digit) => digit !== "")) {
      if (!hasSubmittedRef.current) {
        hasSubmittedRef.current = true
        handleVerify(newOtp.join(""))
      }
    }
  }

  const handlePaste = (e, index = 0) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text")
    applyOtpDigits(pasted, index)
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
  }

  const handleVerify = async (otpValue = null) => {
    const code = otpValue || otp.join("")

    if (code.length !== 4) {
      toast.error("Please enter the complete 4-digit code")
      hasSubmittedRef.current = false
      return
    }

    setIsLoading(true)

    try {
      if (!authData) throw new Error("Session expired. Please login again.")

      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null
      const purpose = authData.isSignUp ? "register" : "login"

      const response = await restaurantAPI.verifyOTP(phone, code, purpose, null, email)
      const data = response?.data?.data || response?.data

      if (data?.pendingApproval && !data?.accessToken) {
        const pendingPhone = data.phone || phone
        setRestaurantPendingPhone(pendingPhone)
        sessionStorage.removeItem("restaurantAuthData")
        navigate("/food/restaurant/pending-verification", {
          replace: true,
          state: {
            phone: pendingPhone,
            isRejected: Boolean(data.isRejected),
            rejectionReason: data.rejectionReason || "",
            rejectionStep: data.rejectionStep || 1,
          },
        })
        return
      }

      const accessToken = data?.accessToken || data?.token
      const restaurant = data?.user ?? data?.restaurant

      if (accessToken && restaurant) {
        setRestaurantAuthData("restaurant", accessToken, restaurant, data?.refreshToken)
        window.dispatchEvent(new Event("restaurantAuthChanged"))
        sessionStorage.removeItem("restaurantAuthData")
        toast.success("Verification successful!")

        setTimeout(async () => {
          if (data?.isRejected || data?.pendingApproval && data?.isRejected) {
            const rejectionStep = data?.rejectionStep || 1
            navigate("/food/restaurant/pending-verification", {
              replace: true,
              state: {
                isRejected: true,
                rejectionReason: data?.rejectionReason || "",
                rejectionStep,
                phone: data?.phone || phone,
              },
            })
            return
          }

          const onboardingStatus = String(data?.onboardingStatus || "").toUpperCase()
          if (
            onboardingStatus === "IN_PROGRESS" ||
            onboardingStatus === "NOT_STARTED" ||
            data?.isNewOnboarding ||
            authData?.isSignUp
          ) {
            const step = data?.currentStep || (await checkOnboardingStatus()) || 1
            navigate(`/food/restaurant/onboarding?step=${step}`, { replace: true })
            return
          }

          const onboardingComplete = isRestaurantOnboardingComplete(restaurant)
          if (!onboardingComplete) {
            const incompleteStep = await checkOnboardingStatus()
            if (incompleteStep) {
              navigate(`/food/restaurant/onboarding?step=${incompleteStep}`, { replace: true })
              return
            }
          }
          navigate(returnPath || "/food/restaurant", { replace: true })
        }, 800)
      }
    } catch (err) {
      const message = err?.response?.data?.message || "Invalid OTP. Please try again."

      if (/banned/i.test(message)) {
        sessionStorage.removeItem("restaurantAuthData")
        navigate("/food/restaurant/login", {
          replace: true,
          state: { banned: true, message },
        })
        return
      }

      if (/pending approval/i.test(message)) {
        const pendingPhone = authData?.phone || authData?.email || contactInfo
        setRestaurantPendingPhone(pendingPhone)
        navigate("/food/restaurant/pending-verification", {
          replace: true,
          state: { phone: pendingPhone || "" },
        })
        return
      }

      toast.error(message)
      setOtp(["", "", "", ""])
      hasSubmittedRef.current = false
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    setIsLoading(true)
    try {
      const purpose = authData.isSignUp ? "register" : "login"
      await restaurantAPI.sendOTP(authData.phone, purpose, authData.email)
      toast.success("New code sent!")
      setResendTimer(60)
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resend code")
    } finally {
      setIsLoading(false)
    }
  }

  const isOtpComplete = otp.every((digit) => digit !== "")

  if (!authData) return null

  return (
    <RestaurantAuthLayout
      title="Verify OTP"
      subtitle={
        <>
          Enter the 4-digit code sent to{" "}
          <span className="font-semibold text-primary-orange">{contactInfo}</span>
        </>
      }
      onBack={() => navigate("/food/restaurant/login")}
    >
      <div className="mx-auto grid max-w-[15rem] grid-cols-4 gap-2 sm:max-w-[17rem] sm:gap-3">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="tel"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(e, index)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex(null)}
            aria-label={`OTP digit ${index + 1}`}
            className={`h-11 w-11 rounded-xl border-2 bg-gray-50 text-center text-lg font-bold text-gray-900 outline-none transition-all sm:h-12 sm:w-12 sm:text-xl ${
              focusedIndex === index
                ? "border-primary-orange bg-white ring-2 ring-primary-orange/20"
                : "border-gray-200 hover:border-gray-300"
            }`}
          />
        ))}
      </div>

      <Button
        type="button"
        onClick={() => handleVerify()}
        disabled={isLoading || !isOtpComplete}
        className="mt-6 h-11 w-full rounded-xl bg-primary-orange text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-orange/90 disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Continue"}
      </Button>

      <div className="mt-5 text-center">
        {resendTimer > 0 ? (
          <p className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Timer className="h-4 w-4 text-primary-orange" />
            Resend code in <span className="font-semibold text-primary-orange">{resendTimer}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isLoading}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-orange hover:underline"
          >
            <RefreshCw className="h-4 w-4" />
            Resend OTP
          </button>
        )}
      </div>
    </RestaurantAuthLayout>
  )
}
