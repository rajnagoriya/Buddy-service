import { Check } from "lucide-react"
import { ONBOARDING_STEPS } from "./onboardingSteps"

export default function OnboardingProgress({
  currentStep,
  completedSteps = new Set(),
  onStepSelect,
  variant = "horizontal",
  compact = false,
  onDark = false,
}) {
  const isVertical = variant === "vertical"

  return (
    <nav
      aria-label="Onboarding progress"
      className={
        isVertical
          ? "flex h-full flex-col gap-2"
          : "flex items-start gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:items-center sm:gap-2 sm:px-6 sm:py-3"
      }
    >
      {ONBOARDING_STEPS.map((item, index) => {
        const stepNumber = item.id
        const isComplete = completedSteps.has(stepNumber)
        const isCurrent = currentStep === stepNumber
        const isClickable =
          typeof onStepSelect === "function" && (isComplete || stepNumber <= currentStep)

        const circleClass = onDark
          ? isCurrent
            ? "border-white bg-white text-primary-orange"
            : isComplete
              ? "border-white/80 bg-white/20 text-white"
              : "border-white/30 bg-transparent text-white/50"
          : isCurrent
            ? "border-primary-orange bg-primary-orange text-white"
            : isComplete
              ? "border-primary-orange bg-primary-orange/10 text-primary-orange"
              : "border-gray-200 bg-white text-gray-400"

        const titleClass = onDark
          ? isCurrent
            ? "text-white"
            : isComplete
              ? "text-white/90"
              : "text-white/50"
          : isCurrent
            ? "text-gray-900"
            : isComplete
              ? "text-primary-orange"
              : "text-gray-500"

        const subtitleClass = onDark ? "text-white/60" : "text-gray-400"

        const content = isVertical ? (
          <>
            <div
              className={`flex shrink-0 items-center justify-center rounded-full border-2 font-bold transition-colors ${
                compact ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs"
              } ${circleClass}`}
            >
              {isComplete && !isCurrent ? (
                <Check className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.5} />
              ) : (
                stepNumber
              )}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className={`truncate text-xs font-semibold ${titleClass}`}>{item.title}</p>
              <p className={`truncate text-[10px] ${subtitleClass}`}>{item.subtitle}</p>
            </div>
          </>
        ) : (
          <>
            <div
              className={`flex shrink-0 items-center justify-center rounded-full border-2 font-bold transition-colors h-7 w-7 text-[10px] sm:h-8 sm:w-8 sm:text-xs ${circleClass}`}
            >
              {isComplete && !isCurrent ? (
                <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.5} />
              ) : (
                stepNumber
              )}
            </div>
            <div className="min-w-0 flex-1 text-left sm:text-center">
              <p className={`text-[10px] font-semibold leading-tight sm:text-[11px] ${titleClass}`}>
                Step {stepNumber}
              </p>
              <p className={`mt-0.5 truncate text-[9px] leading-tight sm:text-[11px] ${titleClass}`}>
                {item.title}
              </p>
            </div>
            {index < ONBOARDING_STEPS.length - 1 && (
              <div
                className={`mx-0.5 mt-4 hidden h-px w-6 shrink-0 sm:block sm:w-10 ${
                  completedSteps.has(stepNumber) ? "bg-primary-orange/40" : "bg-gray-200"
                }`}
              />
            )}
          </>
        )

        if (isVertical) {
          return (
            <button
              key={stepNumber}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepSelect(stepNumber)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2.5 text-left transition-colors ${
                isCurrent ? "bg-white/15" : isComplete ? "hover:bg-white/10" : ""
              } ${isClickable ? "cursor-pointer" : "cursor-default opacity-70"}`}
            >
              {content}
            </button>
          )
        }

        return (
          <button
            key={stepNumber}
            type="button"
            disabled={!isClickable}
            onClick={() => isClickable && onStepSelect(stepNumber)}
            className={`flex min-w-[5.25rem] shrink-0 items-start gap-1.5 rounded-xl px-1.5 py-1 text-left transition-colors sm:min-w-0 sm:flex-1 sm:items-center sm:justify-center sm:gap-2 sm:px-2 sm:py-1.5 sm:text-center ${
              isCurrent ? "bg-primary-orange/10 ring-1 ring-primary-orange/20" : ""
            } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
          >
            {content}
          </button>
        )
      })}
    </nav>
  )
}
