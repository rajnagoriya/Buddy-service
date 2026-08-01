import { useState, useRef, useEffect } from "react";
import { Info, Phone, Upload, X, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";
import { setCachedSettings, updateFavicon, updateTitle } from "@food/utils/businessSettings";
import { validateEmail } from "@/shared/utils/emailValidation";

const PHONE_REGEX = /^\d{10}$/;
const PINCODE_REGEX = /^\d{6}$/;
const STATE_REGEX = /^[A-Za-z][A-Za-z\s.'-]{1,49}$/;
const COMPANY_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s.&'\-,]{1,49}$/;
const ADDRESS_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s.,#'\-()/&]{4,249}$/;

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "").slice(0, 10);
const normalizePincode = (value) => String(value || "").replace(/\D/g, "").slice(0, 6);
const normalizeState = (value) =>
  String(value || "")
    .replace(/[^A-Za-z\s.'-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 50);
const normalizeCompanyName = (value) =>
  String(value || "")
    .replace(/[^A-Za-z0-9\s.&'\-,]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 50);
const normalizeEmail = (value) => String(value || "").replace(/\s/g, "").slice(0, 100);
const normalizeAddress = (value) =>
  String(value || "")
    .replace(/[^A-Za-z0-9\s.,#'\-()/&]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 250);

const getCompanyNameError = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "Company name is required";
  if (trimmed.length < 2) return "Company name must be at least 2 characters";
  if (!COMPANY_NAME_REGEX.test(trimmed)) {
    return "Company name can only contain letters, numbers, spaces, and . & ' - ,";
  }
  return "";
};

const getEmailError = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "Email is required";
  return validateEmail(trimmed);
};

const getAddressError = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.length < 5) return "Address must be at least 5 characters";
  if (!ADDRESS_REGEX.test(trimmed)) {
    return "Address contains invalid characters";
  }
  return "";
};

const getPhoneError = (value) => {
  const digits = normalizePhoneDigits(value);
  if (!digits) return "Phone number is required";
  if (!PHONE_REGEX.test(digits)) return "Phone number must be exactly 10 digits";
  return "";
};

const getStateError = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.length < 2) return "State must be at least 2 characters";
  if (!STATE_REGEX.test(trimmed)) return "State must contain letters only";
  return "";
};

const getPincodeError = (value) => {
  const digits = normalizePincode(value);
  if (!digits) return "";
  if (!PINCODE_REGEX.test(digits)) return "Pincode must be exactly 6 digits";
  return "";
};

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function BusinessSetup() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phoneCountryCode: "+91",
    phoneNumber: "",
    address: "",
    state: "",
    pincode: "",
    region: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});

  // Fetch business settings on mount
  useEffect(() => {
    fetchBusinessSettings();
  }, []);

  const fetchBusinessSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBusinessSettings();
      const settings = response?.data?.data || response?.data;

      if (settings) {
        setFormData({
          companyName: normalizeCompanyName(settings.companyName || ""),
          email: normalizeEmail(settings.email || ""),
          phoneCountryCode: settings.phone?.countryCode || "+91",
          phoneNumber: normalizePhoneDigits(settings.phone?.number || ""),
          address: normalizeAddress(settings.address || ""),
          state: normalizeState(settings.state || ""),
          pincode: normalizePincode(settings.pincode || ""),
          region: settings.region || "India",
        });
        setFieldErrors({});

        // Set logo and favicon previews if they exist
        if (settings.logo?.url) {
          setLogoPreview(settings.logo.url);
        }
        if (settings.favicon?.url) {
          setFaviconPreview(settings.favicon.url);
        }
      }
    } catch (error) {
      debugError("Error fetching business settings:", error);
      toast.error(error?.response?.data?.message || "Failed to load business settings");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setFieldErrors((prev) => ({
      ...prev,
      [field]: "",
    }));
  };

  const handleFieldBlur = (field) => {
    const validators = {
      companyName: getCompanyNameError,
      email: getEmailError,
      address: getAddressError,
      phoneNumber: getPhoneError,
      state: getStateError,
      pincode: getPincodeError,
    };
    const validate = validators[field];
    if (!validate) return;

    setFieldErrors((prev) => ({
      ...prev,
      [field]: validate(formData[field]),
    }));
  };

  const inputErrorClass = (field) =>
    fieldErrors[field]
      ? "border-red-400 focus:ring-red-500 focus:border-red-500"
      : "border-slate-300 focus:ring-blue-500 focus:border-blue-500";

  const handleSave = async () => {
    try {
      const companyNameError = getCompanyNameError(formData.companyName);
      const emailError = getEmailError(formData.email);
      const addressError = getAddressError(formData.address);
      const phoneError = getPhoneError(formData.phoneNumber);
      const stateError = getStateError(formData.state);
      const pincodeError = getPincodeError(formData.pincode);

      const nextErrors = {
        companyName: companyNameError,
        email: emailError,
        address: addressError,
        phoneNumber: phoneError,
        state: stateError,
        pincode: pincodeError,
      };
      const firstError =
        companyNameError || emailError || phoneError || addressError || stateError || pincodeError;

      if (firstError) {
        setFieldErrors(nextErrors);
        toast.error(firstError);
        return;
      }

      setSaving(true);

      // Prepare form data
      const dataToSend = {
        companyName: formData.companyName.trim(),
        email: formData.email.trim(),
        phoneCountryCode: formData.phoneCountryCode,
        phoneNumber: formData.phoneNumber.trim(),
        address: formData.address.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        region: formData.region,
      };

      // Prepare files
      const files = {};
      if (logoFile) {
        files.logo = logoFile;
      }
      if (faviconFile) {
        files.favicon = faviconFile;
      }

      const response = await adminAPI.updateBusinessSettings(dataToSend, files);
      const updatedSettings = response?.data?.data || response?.data;

      if (updatedSettings) {
        // Update global cache immediately
        setCachedSettings(updatedSettings);

        // Update previews with new URLs if files were uploaded
        if (updatedSettings.logo?.url) {
          setLogoPreview(updatedSettings.logo.url);
          setLogoFile(null);
        }
        if (updatedSettings.favicon?.url) {
          setFaviconPreview(updatedSettings.favicon.url);
          setFaviconFile(null);
        }
      }

      toast.success("Business settings saved successfully");

      // Dispatch custom event to notify other components (like Sidebar)
      window.dispatchEvent(new CustomEvent('businessSettingsUpdated'));
    } catch (error) {
      debugError("Error saving business settings:", error);
      toast.error(error?.response?.data?.message || "Failed to save business settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    fetchBusinessSettings();
    setLogoFile(null);
    setFaviconFile(null);
    setFieldErrors({});
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
    if (faviconInputRef.current) {
      faviconInputRef.current.value = "";
    }
    toast.info("Form reset to saved values");
  };


  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Page header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Business setup</h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Manage your company information, general configuration and business rules.
          </p>
        </div>

        {/* Note card (top-right) */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3 max-w-md">
          <div className="mt-0.5">
            <Info className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xs lg:text-sm text-slate-700">
            <p className="font-semibold text-amber-700 mb-0.5">Note</p>
            <p>Don&apos;t forget to click the &quot;Save Information&quot; button below to save changes.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Company info */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          {/* Company information */}
          <div className="px-4 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span>Company Information</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Company name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter Your Company Name"
                  value={formData.companyName}
                  maxLength={50}
                  onChange={(e) => handleInputChange("companyName", normalizeCompanyName(e.target.value))}
                  onBlur={() => handleFieldBlur("companyName")}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 ${inputErrorClass("companyName")}`}
                />
                {fieldErrors.companyName && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.companyName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="Enter Your Email"
                  value={formData.email}
                  maxLength={100}
                  onChange={(e) => handleInputChange("email", normalizeEmail(e.target.value))}
                  onBlur={() => handleFieldBlur("email")}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 ${inputErrorClass("email")}`}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Region <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => handleInputChange("region", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="India">India</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative w-32">
                    <select
                      value={formData.phoneCountryCode}
                      onChange={(e) => handleInputChange("phoneCountryCode", e.target.value)}
                      className="w-full pl-8 pr-7 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                    >
                      <option value="+91">+91 (IN)</option>
                    </select>
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Enter 10-digit phone number"
                    value={formData.phoneNumber}
                    maxLength={10}
                    onChange={(e) => handleInputChange("phoneNumber", normalizePhoneDigits(e.target.value))}
                    onBlur={() => handleFieldBlur("phoneNumber")}
                    className={`flex-1 px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 ${inputErrorClass("phoneNumber")}`}
                  />
                </div>
                {fieldErrors.phoneNumber && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.phoneNumber}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter Your Address"
                  value={formData.address}
                  maxLength={250}
                  onChange={(e) => handleInputChange("address", normalizeAddress(e.target.value))}
                  onBlur={() => handleFieldBlur("address")}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 resize-none ${inputErrorClass("address")}`}
                />
                {fieldErrors.address && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.address}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  State
                </label>
                <input
                  type="text"
                  placeholder="Enter Your State"
                  value={formData.state}
                  maxLength={50}
                  onChange={(e) => handleInputChange("state", normalizeState(e.target.value))}
                  onBlur={() => handleFieldBlur("state")}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 ${inputErrorClass("state")}`}
                />
                {fieldErrors.state && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.state}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pincode
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter 6-digit pincode"
                  value={formData.pincode}
                  maxLength={6}
                  onChange={(e) => handleInputChange("pincode", normalizePincode(e.target.value))}
                  onBlur={() => handleFieldBlur("pincode")}
                  className={`w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 ${inputErrorClass("pincode")}`}
                />
                {fieldErrors.pincode && (
                  <p className="mt-1 text-[11px] text-red-500">{fieldErrors.pincode}</p>
                )}
              </div>
            </div>

            {/* Logo & favicon upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Logo</label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Validate file type
                    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
                    if (!allowedTypes.includes(file.type)) {
                      toast.error("Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.");
                      return;
                    }

                    // Validate file size (max 5MB)
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    if (file.size > maxSize) {
                      toast.error("File size exceeds 5MB limit.");
                      return;
                    }

                    setLogoFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setLogoPreview(reader.result);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="border border-dashed border-slate-300 rounded-lg bg-slate-50/60 h-28 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors relative overflow-hidden"
                >
                  {logoPreview ? (
                    <>
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLogoPreview(null);
                          setLogoFile(null);
                          if (logoInputRef.current) {
                            logoInputRef.current.value = "";
                          }
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">Click to upload logo</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Favicon</label>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/x-icon"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Validate file type
                    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/x-icon"];
                    if (!allowedTypes.includes(file.type)) {
                      toast.error("Invalid file type. Please upload PNG, JPG, JPEG, WEBP, or ICO.");
                      return;
                    }

                    // Validate file size (max 5MB)
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    if (file.size > maxSize) {
                      toast.error("File size exceeds 5MB limit.");
                      return;
                    }

                    setFaviconFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setFaviconPreview(reader.result);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => faviconInputRef.current?.click()}
                  className="border border-dashed border-slate-300 rounded-lg bg-slate-50/60 h-28 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors relative overflow-hidden"
                >
                  {faviconPreview ? (
                    <>
                      <img
                        src={faviconPreview}
                        alt="Favicon preview"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFaviconPreview(null);
                          setFaviconFile(null);
                          if (faviconInputRef.current) {
                            faviconInputRef.current.value = "";
                          }
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">Click to upload favicon</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Save Button Section */}
          <div className="px-4 py-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                Changes will only be applied after clicking the <span className="font-semibold">Save Information</span> button.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Information"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ initial = false }) {
  const [enabled, setEnabled] = useState(initial);

  return (
    <button
      type="button"
      onClick={() => setEnabled((prev) => !prev)}
      className={`inline-flex items-center w-10 h-5 rounded-full border transition-all ${enabled ? "bg-blue-600 border-blue-600 justify-end" : "bg-slate-200 border-slate-300 justify-start"
        }`}
    >
      <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
    </button>
  );
}


