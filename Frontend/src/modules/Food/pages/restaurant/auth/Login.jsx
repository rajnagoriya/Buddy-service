import { useRef, useState } from "react"
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
      title="Partner Login"
      subtitle="Enter your registered mobile number to continue"
      footer={
        <p className="text-center text-xs text-gray-500">
          By continuing, you agree to our{" "}
          <Link to="/food/restaurant/terms" className="font-medium text-primary-orange hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/food/restaurant/privacy" className="font-medium text-primary-orange hover:underline">
            Privacy Policy
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSendOTP} className="w-full space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="restaurant-login-phone" className="text-sm font-medium text-gray-700">
            Phone number
          </Label>
          <div className="flex gap-2">
            <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">
              +91
            </div>
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
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
                className="h-11 rounded-xl border-2 border-gray-200 pl-9 shadow-none transition-colors placeholder:text-gray-400 focus-visible:border-primary-orange focus-visible:ring-2 focus-visible:ring-primary-orange/20"
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading || phone.length < 10}
          className="h-11 w-full rounded-xl bg-primary-orange text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-orange/90 disabled:opacity-50"
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

      <div className="mt-6 text-center text-sm">
        <span className="text-gray-600">New partner? </span>
        <button
          type="button"
          onClick={() => navigate("/food/restaurant/signup")}
          className="font-medium text-primary-orange hover:underline"
        >
          Register restaurant
        </button>
      </div>
    </RestaurantAuthLayout>
  )
}
