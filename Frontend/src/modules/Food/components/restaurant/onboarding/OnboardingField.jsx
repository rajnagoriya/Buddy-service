import { cn } from "@food/utils/utils"

export const onboardingInputClass =
  "h-10 sm:h-11 rounded-xl border-2 border-gray-200 bg-white px-3 sm:px-3.5 text-sm text-gray-900 shadow-none transition-[border-color,box-shadow] placeholder:text-gray-400 focus-visible:border-primary-orange focus-visible:ring-2 focus-visible:ring-primary-orange/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60"

export const onboardingSelectClass =
  "h-10 sm:h-11 w-full rounded-xl border-2 border-gray-200 bg-white px-3 sm:px-3.5 text-sm text-gray-900 transition-[border-color,box-shadow] focus:border-primary-orange focus:outline-none focus:ring-2 focus:ring-primary-orange/20 disabled:cursor-not-allowed disabled:opacity-60"

export default function OnboardingField({ label, required, hint, children, className }) {
  return (
    <div className={cn("space-y-1 sm:space-y-1.5", className)}>
      {label ? (
        <label className="block text-xs sm:text-[13px] font-semibold tracking-tight text-gray-900">
          {label}
          {required ? <span className="ml-0.5 text-primary-orange">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint ? <p className="text-[10px] sm:text-[11px] leading-snug text-gray-400">{hint}</p> : null}
    </div>
  )
}

export function OnboardingSection({ title, children, className }) {
  return (
    <div className={cn("space-y-2.5 sm:space-y-4", className)}>
      {title ? (
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-400">
          {title}
        </p>
      ) : null}
      <div className="space-y-2.5 sm:space-y-4">{children}</div>
    </div>
  )
}
