import { useRef, useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import { Loader2, Phone } from "lucide-react"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import RestaurantAuthLayout from "@food/components/restaurant/auth/RestaurantAuthLayout"

const DEFAULT_COUNTRY_CODE = "+91"

export default function RestaurantLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const phoneInputRef = useRef(null)
  const [phone, setPhone] = useState(() => sessionStorage.getItem("restaurantLoginPhone") || "")
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    if (location.state?.banned) {
      toast.error(
        location.state?.message ||
          "Your restaurant account has been banned. Please contact support.",
      )
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.pathname, location.state, navigate])

  const validatePhone = (num) => {
    const digits = num.replace(/\D/g, "")
    if (digits.length !== 10) return false
    return ["6", "7", "8", "9"].includes(digits[0])
  }

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault()
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)

    const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim()

    try {
      await restaurantAPI.sendOTP(fullPhone, "login")
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))
      sessionStorage.setItem("restaurantLoginPhone", phone)
      toast.success("Verification code sent!")
      navigate("/food/restaurant/otp", { state: { from: location.state?.from } })
    } catch (apiErr) {
      const msg = apiErr?.response?.data?.message || apiErr?.message || "Failed to send OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  return (
    <RestaurantAuthLayout
      title="Partner login"
      subtitle="Enter your registered mobile number"
      footer={
        <p className="text-center text-xs leading-relaxed text-[var(--rt-muted,#6b7280)]">
          By continuing, you agree to our{" "}
          <Link
            to="/food/restaurant/terms"
            className="font-semibold text-[var(--rt-primary-strong,#27A344)] hover:underline"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            to="/food/restaurant/privacy"
            className="font-semibold text-[var(--rt-primary-strong,#27A344)] hover:underline"
          >
            Privacy Policy
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSendOTP} className="w-full space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="restaurant-login-phone"
            className="text-sm font-semibold text-gray-800"
          >
            Mobile number
          </Label>
          <div className="flex gap-2.5">
            <div className="flex h-12 w-[4.25rem] shrink-0 items-center justify-center rounded-xl border border-[var(--rt-border,#e8edf2)] bg-[var(--rt-surface-muted,#f4f6f9)] text-sm font-semibold text-gray-700">
              +91
            </div>
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400">
                <Phone className="h-4 w-4" />
              </span>
              <Input
                id="restaurant-login-phone"
                ref={phoneInputRef}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                autoFocus
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                placeholder="10-digit number"
                className="h-12 rounded-xl border border-[var(--rt-border,#e8edf2)] bg-white pl-10 text-[15px] shadow-none placeholder:text-gray-400 focus-visible:border-[var(--rt-primary-strong,#27A344)] focus-visible:ring-2 focus-visible:ring-[var(--rt-primary-soft,#E8F7EC)]"
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading || phone.length < 10}
          className="rt-btn-primary h-12 w-full text-[15px] shadow-md hover:brightness-105 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending OTP...
            </>
          ) : (
            "Send OTP"
          )}
        </Button>
      </form>

      <div className="mt-5 border-t border-[var(--rt-border,#e8edf2)] pt-4 text-center text-sm">
        <span className="text-gray-600">New partner? </span>
        <button
          type="button"
          onClick={() => navigate("/food/restaurant/signup")}
          className="font-semibold text-[var(--rt-primary-strong,#27A344)] hover:underline"
        >
          Register restaurant
        </button>
      </div>
    </RestaurantAuthLayout>
  )
}
