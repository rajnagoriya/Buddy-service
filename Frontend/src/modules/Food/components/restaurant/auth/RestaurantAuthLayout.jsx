import { useState } from "react"
import { ArrowLeft, Store, TrendingUp, Clock3, ShieldCheck } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useBusinessSettings } from "@food/hooks/useBusinessSettings"
import loginBanner1 from "@food/assets/restaurant/loginbanner1.png"

const FEATURES = [
  { icon: Clock3, text: "Manage live orders in real time" },
  { icon: TrendingUp, text: "Track earnings and payouts" },
  { icon: ShieldCheck, text: "Secure OTP partner access" },
]

const RESTAURANT_HOME_PATH = "/food/restaurant/login"

function BrandLogo({ logoUrl, companyName, size = "md", light = false }) {
  const [imgFailed, setImgFailed] = useState(false)
  const sizeClass =
    size === "lg"
      ? "h-14 w-14 sm:h-16 sm:w-16"
      : size === "sm"
        ? "h-10 w-10"
        : "h-12 w-12"

  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl}
        alt=""
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-2xl object-contain bg-white p-1 shadow-sm ring-1 ring-black/5`}
      />
    )
  }

  return (
    <div
      className={`flex ${sizeClass} items-center justify-center rounded-2xl ${
        light
          ? "bg-white/15 text-white ring-1 ring-white/25"
          : "bg-[var(--rt-primary-soft,#E8F7EC)] text-[var(--rt-primary-strong,#27A344)]"
      }`}
      aria-hidden="true"
    >
      <Store className={size === "lg" ? "h-7 w-7" : "h-5 w-5"} />
    </div>
  )
}

export default function RestaurantAuthLayout({
  title,
  subtitle,
  children,
  onBack,
  footer,
  badge = "Partner portal",
  showBack = true,
  showBadge = true,
}) {
  const navigate = useNavigate()
  const { logoUrl, companyName: settingsName } = useBusinessSettings()
  const companyName = settingsName || "Foodelo"

  // Stay inside the restaurant portal — never send partners to the consumer app home.
  const handleBack = onBack || (() => navigate(RESTAURANT_HOME_PATH))

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--rt-surface-muted,#f4f6f9)] text-[var(--rt-text,#1a1d21)]">
      {/* Desktop brand panel */}
      <aside className="relative hidden w-[46%] max-w-[580px] shrink-0 overflow-hidden bg-[var(--rt-primary,#23361A)] lg:flex lg:flex-col">
        <img
          src={loginBanner1}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--rt-primary,#23361A)]/90 via-[var(--rt-primary,#23361A)]/75 to-[var(--rt-primary,#23361A)]/55" />

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-10 text-center xl:px-14">
          <div className="flex flex-col items-center">
            <BrandLogo logoUrl={logoUrl} companyName={companyName} light size="lg" />
            <p className="mt-4 text-2xl font-bold tracking-tight text-white xl:text-3xl">
              {companyName}
            </p>
            <p className="mt-1 text-sm font-medium text-white/70">Restaurant Partner Panel</p>
          </div>

          <div className="mt-10 max-w-md">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-[2.35rem] xl:leading-[1.15]">
              Run your restaurant from one dashboard
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Orders, menu, timings, and payouts — built for partners.
            </p>
          </div>

          <ul className="mt-8 w-full max-w-sm space-y-3 text-left">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/95 backdrop-blur-md"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form column */}
      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {(showBack || (showBadge && badge)) && (
          <header className="relative z-10 flex shrink-0 items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8 lg:px-12 lg:pt-10">
            {showBack ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--rt-border,#e8edf2)] bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 sm:h-10 sm:w-10"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            ) : null}

            {showBadge && badge ? (
              <div className="hidden lg:block">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rt-muted,#6b7280)]">
                  {badge}
                </p>
              </div>
            ) : null}
          </header>
        )}

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-12">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-2 sm:py-6">
            {/* Mobile: logo-first, minimal branding — not a link to consumer home */}
            <div className="mb-3 flex flex-col items-center text-center sm:mb-6 lg:hidden">
              <BrandLogo logoUrl={logoUrl} companyName={companyName} size="sm" />
              <p className="mt-2 text-base font-bold tracking-tight text-gray-900 sm:mt-3 sm:text-lg">
                {companyName}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[var(--rt-muted,#6b7280)] sm:text-xs">
                Restaurant partner
              </p>
            </div>

            {(title || subtitle) ? (
              <div className="mb-3 text-center sm:mb-4 lg:mb-5 lg:text-left">
                {title ? (
                  <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{title}</h2>
                ) : null}
                {subtitle ? (
                  <div className={`text-sm leading-relaxed text-[var(--rt-muted,#6b7280)] ${title ? "mt-1" : ""}`}>
                    {subtitle}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="w-full rounded-[var(--rt-radius-lg,18px)] border border-[var(--rt-border,#e8edf2)] bg-white p-3.5 shadow-[var(--rt-shadow,0_8px_30px_rgba(15,23,42,0.06))] sm:p-6">
              {children}
            </div>

            {footer ? <div className="mt-3 w-full sm:mt-4 lg:mt-5">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
