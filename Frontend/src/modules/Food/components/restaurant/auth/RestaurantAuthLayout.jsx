import { ArrowLeft, UtensilsCrossed, TrendingUp, Clock3, ShieldCheck } from "lucide-react"
import { useCompanyName } from "@food/hooks/useCompanyName"
import loginBanner1 from "@food/assets/restaurant/loginbanner1.png"

const FEATURES = [
  { icon: Clock3, text: "Manage live orders in real time" },
  { icon: TrendingUp, text: "Track earnings and payouts with ease" },
  { icon: ShieldCheck, text: "Grow your restaurant with trusted insights" },
]

export default function RestaurantAuthLayout({
  title,
  subtitle,
  children,
  onBack,
  footer,
}) {
  const companyName = useCompanyName() || "Foodelo"

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#f7f8fa]">
      {/* Desktop / tablet-landscape brand panel */}
      <div className="relative hidden w-[44%] max-w-[560px] shrink-0 overflow-hidden bg-[var(--rt-primary,#23361A)] lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url(${loginBanner1})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--rt-primary,#23361A)]/95 via-[var(--rt-primary,#23361A)]/85 to-[var(--rt-primary-strong,#27A344)]/90" />

        <div className="relative flex flex-col gap-10 px-10 py-12 xl:px-14">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-wide text-white xl:text-2xl">
                {companyName}
              </span>
              <span className="text-xs font-medium text-white/70">Restaurant Partner Panel</span>
            </div>
          </div>

          <div className="max-w-sm">
            <h1 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
              Run your restaurant, all from one place
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Orders, menu, payouts and performance — everything a partner needs to grow, in a
              single dashboard.
            </p>
          </div>
        </div>

        <div className="relative px-10 pb-12 xl:px-14">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <ul className="space-y-4">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-white/90">
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

      {/* Form column */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex shrink-0 items-center justify-center px-6 pb-4 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10 lg:justify-start lg:px-14 lg:pt-10">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="absolute left-6 flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 sm:left-10 lg:static lg:mr-4"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}

          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-orange text-white shadow-lg">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xl font-bold tracking-wide text-primary-orange sm:text-2xl">
                {companyName}
              </span>
              <span className="text-xs font-medium text-gray-500">Restaurant Panel</span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-8 sm:px-10 lg:items-start lg:px-14">
          <div className="mb-6 w-full max-w-md text-center lg:text-left">
            <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{title}</h2>
            {subtitle ? <div className="mt-2 text-sm text-gray-500">{subtitle}</div> : null}
          </div>

          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 lg:shadow-md">
            {children}
          </div>

          {footer ? <div className="mt-6 w-full max-w-md">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}
