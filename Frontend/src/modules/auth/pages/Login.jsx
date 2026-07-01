import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  ArrowRight,
  Loader2,
  Utensils,
  ShoppingBag,
  Car,
  ChevronDown,
  ShieldCheck,
  Zap,
  BadgeCheck,
  User,
} from "lucide-react"
import { toast } from "sonner"
import { setAuthData } from "@food/utils/auth"
import logoImage from "@/assets/logo.png"
import { userAPI, identityAPI, persistUserIdentitySession } from "@food/api"
import heroImage from "@/assets/login_hero_3d.png" 
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"

export default function UnifiedOTPFastLogin() {
  const RESEND_COOLDOWN_SECONDS = 60
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showNameModal, setShowNameModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [isUpdatingName, setIsUpdatingName] = useState(false)
  const [tempAuth, setTempAuth] = useState(null)
  const [pendingVerify, setPendingVerify] = useState(null)
  const [deactivatedError, setDeactivatedError] = useState(false)
  const navigate = useNavigate()
  const loginLocation = useLocation()
  const submitting = useRef(false)

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15)
    return digits.length >= 8 ? digits : ""
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await identityAPI.requestOtp(phoneNumber, "USER")
      setOtp("")
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP sent successfully!")
    } catch (err) {
      const status = err?.response?.status
      let msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send OTP."
      
      if (status === 401 && /deactivat(ed|e)/i.test(String(msg))) {
        setDeactivatedError(true)
      } else {
        toast.error(msg)
      }
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleResendOTP = async () => {
    const phone = normalizedPhone()
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number")
      return
    }
    if (resendTimer > 0 || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await identityAPI.requestOtp(phoneNumber, "USER")
      setOtp("")
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP resent successfully.")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resend OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleEditNumber = () => {
    setStep(1)
    setOtp("")
    setResendTimer(0)
    setPendingVerify(null)
    setShowNameModal(false)
    setNewName("")
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    const otpDigits = String(otp).replace(/\D/g, "").slice(0, 4)
    if (otpDigits.length !== 4) {
      toast.error("Please enter the 4-digit OTP")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    let fcmToken = null
    let platform = "web"
    try {
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile"
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"]
            for (const handlerName of handlerNames) {
              try {
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" })
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim()
                  break
                }
              } catch {
                /* try next handler */
              }
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e)
      }

      const response = await identityAPI.verifyOtp(phoneNumber, "USER", otpDigits, { fcmToken, platform })
      const data = response?.data?.data || response?.data || {}
      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user || data.identity || {}

      persistUserIdentitySession({
        accessToken,
        refreshToken,
        user,
        identity: data.identity,
      })

      if (!user?.name || String(user.name).trim() === "") {
        setTempAuth({ accessToken, user, refreshToken, identity: data.identity })
        setShowNameModal(true)
      } else {
        toast.success("Welcome back!")
        navigate("/user/auth/portal", { replace: true })
      }
    } catch (err) {
      const status = err?.response?.status
      let msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Invalid OTP. Please try again."
      const nameRequired = /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(
        String(msg),
      )
      if (nameRequired) {
        setPendingVerify({
          phone: normalizedPhone() || phoneNumber,
          otp: otpDigits,
          fcmToken,
          platform,
        })
        setShowNameModal(true)
        return
      }
      if (status === 401) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          setDeactivatedError(true)
          return
        } else {
          msg = "Invalid or expired code, or account not active."
        }
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    if (!newName.trim()) {
      toast.error("Please enter your name")
      return
    }

    try {
      setIsUpdatingName(true)
      if (pendingVerify) {
        const response = await identityAPI.verifyOtp(
          pendingVerify.phone,
          "USER",
          pendingVerify.otp,
          {
            name: newName.trim(),
            fcmToken: pendingVerify.fcmToken,
            platform: pendingVerify.platform,
          },
        )
        const data = response?.data?.data || response?.data || {}
        const accessToken = data.accessToken
        const refreshToken = data.refreshToken || null
        const user = data.user || data.identity || {}

        persistUserIdentitySession({
          accessToken,
          refreshToken,
          user,
          identity: data.identity,
        })
        setPendingVerify(null)
        toast.success(`Welcome, ${newName.trim()}!`)
        setShowNameModal(false)
        navigate("/user/auth/portal", { replace: true })
        return
      }

      await userAPI.updateProfile({ name: newName.trim() })

      const updatedUser = { ...tempAuth.user, name: newName.trim() }
      persistUserIdentitySession({
        accessToken: tempAuth.accessToken,
        refreshToken: tempAuth.refreshToken,
        user: updatedUser,
        identity: tempAuth.identity,
      })

      toast.success(`Welcome, ${newName.trim()}!`)
      setShowNameModal(false)
      navigate("/user/auth/portal", { replace: true })
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to complete signup."

      if (/otp not found|otp expired|invalid or expired code/i.test(String(msg))) {
        toast.error("OTP expired. Please request a new code and try again.")
        setShowNameModal(false)
        setPendingVerify(null)
        setStep(2)
        setOtp("")
        return
      }

      toast.error(msg)
    } finally {
      setIsUpdatingName(false)
    }
  }

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const intervalId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [step, resendTimer])

  const formatResendTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen min-h-dvh bg-gray-50 flex flex-col font-[family-name:var(--font-poppins)] sm:justify-center sm:items-center sm:p-4 md:p-6">
      <div className="w-full h-full min-h-screen min-h-dvh sm:min-h-0 sm:h-auto sm:max-w-[420px] md:max-w-[440px] sm:bg-white sm:rounded-[2.5rem] sm:shadow-2xl sm:overflow-hidden sm:relative flex flex-col max-w-full">
        {/* Hero banner */}
        <div className="relative w-full overflow-hidden bg-gradient-to-br from-primary via-[#15803d] to-[#166534] pt-4 pb-28 sm:pb-32 flex-shrink-0 min-h-[300px] sm:min-h-[340px]">
          <div className="absolute top-[-30%] left-[-20%] w-[140%] h-[120%] bg-gradient-to-br from-white/25 via-white/10 to-transparent rounded-br-[50%] z-0" />

          <div className="px-5 sm:px-6 pt-4 pb-2 relative z-10 flex flex-col justify-between h-full">
            <div className="max-w-[58%] sm:max-w-[55%]">
              <div className="mb-5 sm:mb-6 flex items-center gap-2">
                <img
                  src={logoImage}
                  alt="Buddy Service"
                  className="w-9 h-9 rounded-xl object-contain bg-white shadow-md p-0.5"
                />
                <span className="font-black text-white text-base sm:text-lg tracking-tight">
                  Buddy Service
                </span>
              </div>

              <h1 className="text-[30px] sm:text-[34px] md:text-4xl font-extrabold text-white leading-[1.15] mb-2 tracking-tight">
                One App.
                <br />
                Everything
                <br />
                You Need.
              </h1>
            </div>
          </div>

          

          {/* Service pills */}
          <div className="absolute bottom-5 sm:bottom-6 left-4 right-4 sm:left-6 sm:right-6 z-10 bg-white/15 backdrop-blur-md rounded-3xl p-3 sm:p-4 flex items-center shadow-lg border border-white/20">
            <div className="flex-1 flex flex-col items-center gap-1.5 sm:gap-2">
              <div className="w-11 h-11 sm:w-[50px] sm:h-[50px] bg-white rounded-2xl flex items-center justify-center shadow-sm">
                <Utensils className="w-5 h-5 sm:w-6 sm:h-6 text-primary" strokeWidth={2} />
              </div>
              <span className="text-white text-[10px] sm:text-[11px] font-semibold">Food</span>
            </div>

            <div className="w-px h-7 sm:h-8 bg-white/20" />

            <div className="flex-1 flex flex-col items-center gap-1.5 sm:gap-2">
              <div className="w-11 h-11 sm:w-[50px] sm:h-[50px] bg-white rounded-2xl flex items-center justify-center shadow-sm">
                <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-primary" strokeWidth={2} />
              </div>
              <span className="text-white text-[10px] sm:text-[11px] font-semibold text-center leading-tight">
                Quick
                <br />
                Commerce
              </span>
            </div>

            <div className="w-px h-7 sm:h-8 bg-white/20" />

            <div className="flex-1 flex flex-col items-center gap-1.5 sm:gap-2">
              <div className="w-11 h-11 sm:w-[50px] sm:h-[50px] bg-white rounded-2xl flex items-center justify-center shadow-sm">
                <Car className="w-5 h-5 sm:w-6 sm:h-6 text-primary" strokeWidth={2} />
              </div>
              <span className="text-white text-[10px] sm:text-[11px] font-semibold">Taxi</span>
            </div>
          </div>
        </div>

        {/* Form sheet */}
        <div className="flex-1 bg-white rounded-t-[2.5rem] -mt-6 relative z-20 flex flex-col">
          <div className="p-6 sm:p-8 pb-4">
            <h2 className="text-[28px] sm:text-[32px] font-black text-foreground mb-1">Welcome!</h2>
            <p className="text-gray-500 font-medium text-sm sm:text-[15px] mb-6 sm:mb-8">
              {step === 1 ? "Login to continue" : `Enter OTP sent to +91 ${phoneNumber}`}
            </p>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form
                  key="step-1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleSendOTP}
                  className="space-y-6"
                >
                  <div>
                    <Label className="text-foreground text-[13px] font-bold mb-2 block ml-1">
                      Mobile Number
                    </Label>
                    <div className="flex items-center border border-primary/40 rounded-[14px] focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all bg-white overflow-hidden shadow-sm h-12 sm:h-14">
                      <div className="flex items-center gap-1.5 px-3 sm:px-4 h-full text-gray-800 shrink-0">
                        <span className="font-bold text-sm sm:text-[15px]">+91</span>
                        <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" strokeWidth={3} />
                      </div>
                      <div className="w-px h-6 bg-gray-200" />
                      <input
                        type="tel"
                        required
                        autoFocus
                        value={phoneNumber}
                        onChange={(e) =>
                          setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                        }
                        maxLength={10}
                        inputMode="numeric"
                        className="flex-1 min-w-0 px-3 sm:px-4 h-full outline-none text-gray-900 font-bold placeholder:text-gray-400 text-sm sm:text-[15px]"
                        placeholder="Enter mobile number"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || phoneNumber.length < 10}
                    className="w-full h-12 sm:h-14 bg-primary hover:bg-primary/90 disabled:bg-gray-200 disabled:text-gray-400 text-primary-foreground rounded-[14px] font-bold text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Get OTP</span>
                        <ArrowRight className="w-5 h-5 sm:w-[22px] sm:h-[22px] absolute right-4 sm:right-5" strokeWidth={2.5} />
                      </>
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleVerifyOTP}
                  className="space-y-6"
                >
                  <div>
                    <Label className="text-foreground text-[13px] font-bold mb-2 block ml-1">
                      Enter OTP Code
                    </Label>
                    <div className="grid grid-cols-4 gap-2 sm:gap-3">
                      {[0, 1, 2, 3].map((index) => (
                        <input
                          key={index}
                          id={`otp-${index}`}
                          type="tel"
                          inputMode="numeric"
                          required
                          autoFocus={index === 0}
                          value={otp[index] || ""}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(-1)
                            if (!val) return
                            const newOtp = otp.split("")
                            newOtp[index] = val
                            const combined = newOtp.join("").slice(0, 4)
                            setOtp(combined)
                            if (index < 3 && val) {
                              document.getElementById(`otp-${index + 1}`)?.focus()
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace") {
                              if (!otp[index] && index > 0) {
                                document.getElementById(`otp-${index - 1}`)?.focus()
                              } else {
                                const newOtp = otp.split("")
                                newOtp[index] = ""
                                setOtp(newOtp.join(""))
                              }
                            }
                          }}
                          className="w-full h-12 sm:h-14 text-center text-xl sm:text-2xl font-bold bg-white border border-primary/40 focus:ring-2 focus:ring-primary/20 focus:border-primary rounded-[14px] outline-none transition-all text-gray-900 shadow-sm"
                          placeholder="•"
                          aria-label={`OTP digit ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-[13px] font-semibold">
                      {resendTimer > 0 ? (
                        <span className="text-gray-400">
                          Resend code in{" "}
                          <span className="text-primary">{formatResendTimer(resendTimer)}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          className="text-primary hover:underline"
                        >
                          Didn&apos;t receive code? Resend
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleEditNumber}
                      className="text-[13px] text-gray-400 hover:text-primary transition-colors"
                    >
                      Edit phone number
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length < 4}
                    className="w-full h-12 sm:h-14 bg-primary hover:bg-primary/90 disabled:bg-gray-200 disabled:text-gray-400 text-primary-foreground rounded-[14px] font-bold text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Verify & Continue</span>
                        <ArrowRight
                          className="w-5 h-5 sm:w-[22px] sm:h-[22px] absolute right-4 sm:right-5"
                          strokeWidth={2.5}
                        />
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="mt-auto bg-secondary px-5 sm:px-6 py-6 sm:py-8 rounded-t-[2rem] flex flex-col items-center">
            <div className="flex justify-between w-full max-w-sm mb-5 sm:mb-6 gap-2">
              <div className="flex gap-2 items-center">
                <ShieldCheck className="w-5 h-5 sm:w-[22px] sm:h-[22px] text-primary" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-gray-600 leading-tight">
                  Secure
                  <br />
                  & Safe
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <Zap className="w-5 h-5 sm:w-[22px] sm:h-[22px] text-primary" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-gray-600 leading-tight">
                  Fast
                  <br />
                  Delivery
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <BadgeCheck className="w-5 h-5 sm:w-[22px] sm:h-[22px] text-primary" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-gray-600 leading-tight">
                  Trusted by
                  <br />
                  Millions
                </span>
              </div>
            </div>

            <p className="text-center text-[10px] text-gray-500 font-medium max-w-[280px]">
              By continuing, you agree to our{" "}
              <Link
                to="/terms"
                state={{ from: `${loginLocation.pathname}${loginLocation.search}` }}
                className="text-primary font-semibold hover:underline"
              >
                Terms & Conditions
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                state={{ from: `${loginLocation.pathname}${loginLocation.search}` }}
                className="text-primary font-semibold hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Name modal */}
      <Dialog open={showNameModal} onOpenChange={setShowNameModal}>
        <DialogContent
          className="w-[calc(100%-2rem)] sm:w-full sm:max-w-[425px] mx-auto rounded-3xl border-none p-0 overflow-hidden bg-white"
          showCloseButton={false}
        >
          <div className="bg-primary p-6 sm:p-8 text-center relative">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30"
            >
              <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </motion.div>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-white mb-2">
              Almost there!
            </DialogTitle>
            <DialogDescription className="text-white/80 text-sm sm:text-base">
              We&apos;d love to know your name to personalize your experience.
            </DialogDescription>
          </div>

          <form onSubmit={handleNameSubmit} className="p-6 sm:p-8 pt-5 sm:pt-6 space-y-6">
            <div className="space-y-4">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 ml-1">
                Full Name
              </Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter your name"
                className="pl-4 h-12 sm:h-14 bg-gray-50 border-gray-200 rounded-[14px] focus:ring-2 focus:ring-primary transition-all"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isUpdatingName}
                className="w-full h-12 sm:h-14 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground rounded-[14px] font-bold text-base sm:text-lg shadow-lg shadow-primary/25 transition-all active:scale-[0.98] flex items-center justify-center"
              >
                {isUpdatingName ? <Loader2 className="h-5 w-5 animate-spin" /> : "Complete Profile"}
              </button>
              {!pendingVerify ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowNameModal(false)
                    navigate("/user/auth/portal", { replace: true })
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
                >
                  Skip for now
                </button>
              ) : (
                <p className="text-xs text-gray-400 text-center">
                  Name is required to complete signup.
                </p>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Deactivated Account Modal */}
      <Dialog open={deactivatedError} onOpenChange={setDeactivatedError}>
        <DialogContent className="sm:max-w-[400px] w-[calc(100%-2rem)] mx-auto p-0 overflow-hidden border-0 bg-white rounded-[24px] sm:rounded-[2rem]">
          <div className="bg-red-50 p-6 flex flex-col items-center justify-center border-b border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-red-600" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 text-center m-0">
              Account Deactivated
            </DialogTitle>
          </div>
          <div className="p-6">
            <DialogDescription className="text-center text-[15px] sm:text-base text-gray-600 mb-6">
              Your account has been temporarily deactivated by the admin. You won't be able to log in at this time.
            </DialogDescription>
            <button
              type="button"
              onClick={() => setDeactivatedError(false)}
              className="w-full h-12 sm:h-14 bg-red-600 hover:bg-red-700 text-white rounded-xl sm:rounded-2xl font-bold text-[15px] sm:text-base transition-all active:scale-[0.98] shadow-sm"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
