import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, Loader2, Utensils, ShoppingBag, Car, ChevronDown, ShieldCheck, Zap, BadgeCheck, User } from "lucide-react"
import { toast } from "sonner"
import { authAPI, userAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import logoImage from "@/assets/logo.png"
import heroImage from "@/assets/login_hero_3d.png" 
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
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
  const navigate = useNavigate()
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
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP sent successfully!")
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send OTP."
      toast.error(msg)
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
      await authAPI.sendOTP(phoneNumber, "login", null)
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
            platform = "mobile";
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"];
            for (const handlerName of handlerNames) {
              try {
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" });
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim();
                  break;
                }
              } catch (e) { }
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e);
      }

      const response = await authAPI.verifyOTP(phoneNumber, otpDigits, "login", null, null, "user", null, null, fcmToken, platform)
      const data = response?.data?.data || response?.data || {}
      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      setAuthData("user", accessToken, user, refreshToken)
      
      if (!user.name || user.name.trim() === "") {
        setTempAuth({ accessToken, user, refreshToken })
        setShowNameModal(true)
      } else {
        toast.success("Welcome back!")
        navigate("/user/auth/portal", { replace: true })
      }
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP. Please try again."
      const nameRequired = /name\s+is\s+required.*first[- ]?time|first[- ]?time.*name\s+is\s+required|first[- ]?time\s*sign\s*up/i.test(String(msg))
      if (nameRequired) {
        setPendingVerify({ phone: phoneNumber, otp: otpDigits, fcmToken, platform })
        setShowNameModal(true)
        return
      }
      if (status === 401) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
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
        const response = await authAPI.verifyOTP(
          pendingVerify.phone,
          pendingVerify.otp,
          "login",
          newName.trim(),
          null,
          "user",
          null,
          null,
          pendingVerify.fcmToken,
          pendingVerify.platform,
        )
        const data = response?.data?.data || response?.data || {}
        const accessToken = data.accessToken
        const refreshToken = data.refreshToken || null
        const user = data.user

        setAuthData("user", accessToken, user, refreshToken)
        setPendingVerify(null)
        toast.success(`Welcome, ${newName.trim()}!`)
        setShowNameModal(false)
        navigate("/user/auth/portal", { replace: true })
        return
      }

      await userAPI.updateProfile({ name: newName.trim() })

      const updatedUser = { ...tempAuth.user, name: newName.trim() }
      setAuthData("user", tempAuth.accessToken, updatedUser, tempAuth.refreshToken)

      toast.success(`Welcome, ${newName.trim()}!`)
      setShowNameModal(false)
      navigate("/user/auth/portal", { replace: true })
    } catch (err) {
      toast.error("Failed to update name. You can skip this for now or try again.")
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
    <div className="min-h-screen bg-gray-50 flex flex-col font-['Poppins'] sm:justify-center sm:items-center">
      
      <div className="sm:w-[420px] sm:bg-white sm:rounded-[2.5rem] sm:shadow-2xl sm:overflow-hidden sm:relative flex flex-col h-full w-full max-w-full">
        
        {/* Top Banner Section */}
        <div className="relative w-full overflow-hidden bg-[#78B45A] pt-4 pb-[3.5rem] flex-shrink-0">
          
          {/* Abstract wavy background layer (Light top area) */}
          <div className="absolute top-[-30%] left-[-20%] w-[140%] h-[120%] bg-gradient-to-br from-[#F5F9F3] via-[#E7F3E2] to-[#CCE3C4] rounded-br-[50%] z-0"></div>

          <div className="px-6 pt-4 pb-2 relative z-10 flex flex-col justify-between h-full">
            
            <div>
              {/* Logo */}
              <div className="mb-6 flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#00923F] flex items-center justify-center shadow-md">
                   {/* Fallback to image if B logo isn't perfect, but we mimic the green B icon */}
                   <span className="text-white font-black text-xl leading-none">B</span>
                </div>
                <span className="font-black text-[#13491E] text-lg tracking-tight">Buddy Service</span>
              </div>

              <h1 className="text-[34px] md:text-4xl font-extrabold text-[#113B17] leading-[1.15] mb-2 tracking-tight">
                One App.<br />Everything<br />You Need.
              </h1>
              <div className="h-1 w-14 bg-[#4C883A] my-4 rounded-full"></div>
              <p className="text-[#647C5E] font-medium text-[15px] leading-snug mb-20 max-w-[200px]">
                Food, Quick Commerce<br />and Taxi – all in one app.
              </p>
            </div>
            
          </div>
          
          {/* Right side illustration */}
          <div className="absolute top-8 -right-[30%] w-[90%] max-w-[340px] z-[5] sm:-right-8">
            <img src={heroImage} alt="Services Illustration" className="w-full h-full object-contain drop-shadow-2xl scale-[1.1] origin-top-right" />
          </div>

          {/* Glassmorphism Icon Container */}
          <div className="absolute bottom-6 left-6 right-6 z-10 bg-[#5A8C41]/30 backdrop-blur-md rounded-[24px] p-4 flex items-center shadow-lg border border-white/10">
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-[50px] h-[50px] bg-white rounded-[16px] flex items-center justify-center shadow-sm">
                <Utensils className="w-6 h-6 text-[#113B17]" strokeWidth={2} />
              </div>
              <span className="text-white text-[11px] font-semibold">Food</span>
            </div>
            
            <div className="w-px h-8 bg-white/20"></div>
            
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-[50px] h-[50px] bg-white rounded-[16px] flex items-center justify-center shadow-sm">
                <ShoppingBag className="w-6 h-6 text-[#113B17]" strokeWidth={2} />
              </div>
              <span className="text-white text-[11px] font-semibold text-center leading-tight">Quick<br/>Commerce</span>
            </div>
            
            <div className="w-px h-8 bg-white/20"></div>
            
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-[50px] h-[50px] bg-white rounded-[16px] flex items-center justify-center shadow-sm">
                <Car className="w-6 h-6 text-[#113B17]" strokeWidth={2} />
              </div>
              <span className="text-white text-[11px] font-semibold">Taxi</span>
            </div>
          </div>
        </div>

        {/* Bottom Sheet Form & Footer */}
        <div className="flex-1 bg-white rounded-t-[2.5rem] mt-[-1.5rem] relative z-20 flex flex-col">
          <div className="p-8 pb-4">
            <h2 className="text-[32px] font-black text-[#13491E] mb-1">Welcome!</h2>
            <p className="text-gray-500 font-medium text-[15px] mb-8">Login to continue</p>
            
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
                    <Label className="text-[#354839] text-[13px] font-bold mb-2 block ml-1">Mobile Number</Label>
                    <div className="flex items-center border border-[#4C883A] rounded-[14px] focus-within:ring-2 focus-within:ring-[#4C883A]/20 transition-all bg-white overflow-hidden shadow-sm h-14">
                      <div className="flex items-center gap-1.5 px-4 h-full text-gray-800">
                        <span className="font-bold text-[15px]">+91</span>
                        <ChevronDown className="w-4 h-4 text-gray-400" strokeWidth={3} />
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <input
                        type="tel"
                        required
                        autoFocus
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        className="flex-1 px-4 h-full outline-none text-gray-900 font-bold placeholder:text-gray-400 text-[15px]"
                        placeholder="Enter mobile number"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || phoneNumber.length < 10}
                    className="w-full h-14 bg-[#569143] hover:bg-[#467A34] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-[14px] font-bold text-[16px] shadow-lg shadow-[#569143]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden mt-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Get OTP</span>
                        <ArrowRight className="w-[22px] h-[22px] absolute right-5" strokeWidth={2.5} />
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
                    <Label className="text-[#354839] text-[13px] font-bold mb-2 block ml-1">Enter OTP Code</Label>
                    <div className="flex justify-between gap-3">
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
                            const val = e.target.value.replace(/\D/g, "").slice(-1);
                            if (!val) return;
                            const newOtp = otp.split("");
                            newOtp[index] = val;
                            const combined = newOtp.join("").slice(0, 4);
                            setOtp(combined);
                            if (index < 3 && val) {
                              document.getElementById(`otp-${index + 1}`)?.focus();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace") {
                              if (!otp[index] && index > 0) {
                                document.getElementById(`otp-${index - 1}`)?.focus();
                              } else {
                                const newOtp = otp.split("");
                                newOtp[index] = "";
                                setOtp(newOtp.join(""));
                              }
                            }
                          }}
                          className="w-full h-14 text-center text-2xl font-bold bg-white border border-[#4C883A] focus:ring-2 focus:ring-[#4C883A]/20 rounded-[14px] outline-none transition-all text-gray-900 shadow-sm"
                          placeholder="•"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-3 mt-4">
                    <div className="flex items-center gap-2 text-[13px] font-semibold">
                      {resendTimer > 0 ? (
                        <span className="text-gray-400">Resend code in <span className="text-[#4C883A]">{formatResendTimer(resendTimer)}</span></span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          className="text-[#4C883A] hover:underline"
                        >
                          Didn't receive code? Resend
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleEditNumber}
                      className="text-[13px] text-gray-400 hover:text-[#4C883A] transition-colors"
                    >
                      Edit phone number
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length < 4}
                    className="w-full h-14 bg-[#569143] hover:bg-[#467A34] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-[14px] font-bold text-[16px] shadow-lg shadow-[#569143]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        <span>Verify & Continue</span>
                        <ArrowRight className="w-[22px] h-[22px] absolute right-5" strokeWidth={2.5} />
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Section */}
          <div className="mt-auto bg-[#F6F8F5] px-6 py-8 rounded-t-[2rem] flex flex-col items-center">
            <div className="flex justify-between w-full max-w-sm mb-6">
              <div className="flex gap-2 items-center">
                <ShieldCheck className="w-[22px] h-[22px] text-[#2E7D32]" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-gray-600 leading-tight">Secure<br/>& Safe</span>
              </div>
              <div className="flex gap-2 items-center">
                <Zap className="w-[22px] h-[22px] text-[#2E7D32]" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-gray-600 leading-tight">Fast<br/>Delivery</span>
              </div>
              <div className="flex gap-2 items-center">
                <BadgeCheck className="w-[22px] h-[22px] text-[#2E7D32]" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-gray-600 leading-tight">Trusted by<br/>Millions</span>
              </div>
            </div>
            
            <p className="text-center text-[10px] text-gray-500 font-medium max-w-[280px]">
              By continuing, you agree to our <Link to="/terms" className="text-[#2E7D32] font-semibold hover:underline">Terms & Conditions</Link> and <Link to="/privacy" className="text-[#2E7D32] font-semibold hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>

      </div>

      {/* Name Collection Modal */}
      <Dialog open={showNameModal} onOpenChange={setShowNameModal}>
        <DialogContent
          className="sm:max-w-[425px] rounded-3xl border-none p-0 overflow-hidden bg-white"
          showCloseButton={false}
        >
          <div className="bg-[#4C883A] p-8 text-center relative">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30"
            >
              <User className="w-10 h-10 text-white" />
            </motion.div>
            <DialogTitle className="text-2xl font-bold text-white mb-2">Almost there!</DialogTitle>
            <DialogDescription className="text-white/80">
              We'd love to know your name to personalize your experience.
            </DialogDescription>
          </div>
          
          <form onSubmit={handleNameSubmit} className="p-8 pt-6 space-y-6">
            <div className="space-y-4">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 ml-1">
                Full Name
              </Label>
              <div className="relative group">
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter your name"
                  className="pl-4 h-14 bg-gray-50 border-gray-200 rounded-[14px] focus:ring-2 focus:ring-[#4C883A] transition-all group-hover:border-[#4C883A]/30"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                type="submit" 
                disabled={isUpdatingName}
                className="w-full h-14 bg-[#569143] hover:bg-[#467A34] text-white rounded-[14px] font-bold text-lg shadow-lg shadow-[#569143]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isUpdatingName ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Complete Profile"
                )}
              </Button>
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
                <p className="text-xs text-gray-400 text-center">Name is required to complete signup.</p>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
