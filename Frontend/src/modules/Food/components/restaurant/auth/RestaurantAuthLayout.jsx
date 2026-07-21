import { ArrowLeft, Store, TrendingUp, Clock3, ShieldCheck } from "lucide-react"
import { useBusinessSettings } from "@food/hooks/useBusinessSettings"
import loginBanner1 from "@food/assets/restaurant/loginbanner1.png"
import loginBanner2 from "@food/assets/restaurant/loginbanner2.png"

const FEATURES = [
  { icon: Clock3, text: "Manage live orders in real time" },
  { icon: TrendingUp, text: "Track earnings and payouts" },
  { icon: ShieldCheck, text: "Secure OTP partner access" },
]

function BrandLogo({ logoUrl, companyName, size = "md", light = false }) {
  const sizeClass =
    size === "lg"
      ? "h-14 w-14 sm:h-16 sm:w-16"
      : size === "sm"
        ? "h-10 w-10"
        : "h-12 w-12"

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={companyName || "Logo"}
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
}) {
  const { logoUrl, companyName: settingsName } = useBusinessSettings()
  const companyName = settingsName || "Foodelo"

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--rt-surface-muted,#f4f6f9)] text-[var(--rt-text,#1a1d21)]">
      {/* Desktop brand panel */}
      <aside className="relative hidden w-[46%] max-w-[580px] shrink-0 overflow-hidden bg-[var(--rt-primary,#23361A)] lg:flex lg:flex-col">
        <img
          src={loginBanner1}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--rt-primary,#23361A)] via-[var(--rt-primary,#23361A)]/80 to-[var(--rt-primary,#23361A)]/45" />

        {/* Secondary food image accent */}
        <div className="absolute bottom-28 right-6 z-[1] hidden w-36 overflow-hidden rounded-2xl border border-white/20 shadow-xl xl:block">
          <img src={loginBanner2} alt="" className="h-28 w-full object-cover" />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between px-10 py-12 xl:px-14">
          <div className="flex items-center gap-3">
            <BrandLogo logoUrl={logoUrl} companyName={companyName} light size="md" />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold tracking-tight text-white xl:text-2xl">
                {companyName}
              </p>
              <p className="text-xs font-medium text-white/70">Restaurant Partner Panel</p>
            </div>
          </div>

          <div>
            <div className="max-w-md">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-[2.35rem] xl:leading-[1.15]">
                Run your restaurant from one dashboard
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                Orders, menu, timings, and payouts — built for partners.
              </p>
            </div>

            <div className="mt-8 rounded-[var(--rt-radius-lg,18px)] border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              <ul className="space-y-3">
                {FEATURES.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-white/95">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                      <Icon className="h-4 w-4" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </aside>

      {/* Form column */}
      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-10 flex shrink-0 items-center gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-12 lg:pt-10">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--rt-border,#e8edf2)] bg-white text-gray-600 shadow-sm transition hover:bg-gray-50"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-0 lg:hidden" aria-hidden />
          )}

          {/* Desktop badge only — keep mobile header empty so logo can lead */}
          <div className="hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rt-muted,#6b7280)]">
              {badge}
            </p>
          </div>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-12">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-3 sm:py-6">
            {/* Mobile: logo-first, minimal branding */}
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <BrandLogo logoUrl={logoUrl} companyName={companyName} size="lg" />
              <p className="mt-3 text-lg font-bold tracking-tight text-gray-900">
                {companyName}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[var(--rt-muted,#6b7280)]">
                Restaurant partner
              </p>
            </div>

            <div className="mb-4 text-center lg:mb-5 lg:text-left">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
              {subtitle ? (
                <div className="mt-1.5 text-sm leading-relaxed text-[var(--rt-muted,#6b7280)]">
                  {subtitle}
                </div>
              ) : null}
            </div>

            <div className="w-full rounded-[var(--rt-radius-lg,18px)] border border-[var(--rt-border,#e8edf2)] bg-white p-5 shadow-[var(--rt-shadow,0_8px_30px_rgba(15,23,42,0.06))] sm:p-6">
              {children}
            </div>

            {footer ? <div className="mt-4 w-full lg:mt-5">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
