import { LogOut, Sparkles, X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import OnboardingProgress from "./OnboardingProgress"
import { ONBOARDING_STEPS } from "./onboardingSteps"

export default function OnboardingShell({
  step,
  completedSteps,
  loading,
  saving,
  isEditing,
  isLoggingOut,
  keyboardInset,
  error,
  onLogout,
  onBack,
  onContinue,
  onClose,
  onEdit,
  onStepSelect,
  continueDisabled = false,
  children,
  footerExtra,
}) {
  const currentMeta = ONBOARDING_STEPS.find((s) => s.id === step)
  const continueLabel =
    step === 3 ? (saving ? "Submitting..." : "Submit") : saving ? "Saving..." : "Continue"

  return (
    <div className="h-dvh overflow-hidden bg-[#f7f8fa] lg:grid lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
      <aside className="relative hidden h-dvh shrink-0 flex-col overflow-hidden bg-gradient-to-br from-primary-orange via-[#22c55e] to-[#86efac] px-6 py-8 text-white lg:flex">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-black/10 blur-3xl" />

        <div className="relative z-10 shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">Partner onboarding</p>
          <p className="mt-2 text-xl font-bold">{currentMeta?.title}</p>
          <p className="mt-1 text-xs text-white/70">
            Step {step} of {ONBOARDING_STEPS.length}
          </p>
        </div>

        <div className="relative z-10 mt-8 min-h-0 flex-1 overflow-hidden">
          <OnboardingProgress
            variant="vertical"
            compact
            onDark
            currentStep={step}
            completedSteps={completedSteps}
            onStepSelect={onStepSelect}
          />
        </div>
      </aside>

      <div className="flex h-dvh min-h-0 flex-col">
        <header className="z-30 shrink-0 border-b border-gray-100 bg-white pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
                aria-label="Close onboarding"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="min-w-0 lg:hidden">
                <p className="truncate text-sm font-bold text-gray-900">{currentMeta?.title}</p>
                <p className="text-[11px] text-gray-400">
                  Step {step} of 3 · {currentMeta?.subtitle}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!loading && !isEditing && (
                <Button
                  type="button"
                  onClick={onEdit}
                  variant="outline"
                  size="sm"
                  className="hidden h-9 gap-1.5 rounded-xl border-primary-orange/20 bg-primary-orange/10 text-xs text-primary-orange hover:bg-primary-orange/15 sm:inline-flex"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              <Button
                type="button"
                onClick={onLogout}
                disabled={isLoggingOut}
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="border-t border-gray-100 lg:hidden">
            <OnboardingProgress
              currentStep={step}
              completedSteps={completedSteps}
              onStepSelect={onStepSelect}
            />
          </div>
        </header>

        <main
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6"
          style={{ paddingBottom: keyboardInset ? `${keyboardInset + 12}px` : undefined }}
          onFocusCapture={(e) => {
            const target = e.target
            if (!(target instanceof HTMLElement)) return
            if (!target.matches("input, textarea, select")) return
            window.setTimeout(() => {
              target.scrollIntoView({ behavior: "smooth", block: "center" })
            }, 250)
          }}
        >
          <div className="mx-auto w-full max-w-xl">
            {loading ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-primary-orange border-t-transparent" />
                <p className="text-sm text-gray-500">Loading...</p>
              </div>
            ) : (
              <div className={!isEditing ? "pointer-events-none select-none opacity-95" : ""}>{children}</div>
            )}
          </div>
        </main>

        {error ? (
          <div className="shrink-0 px-4 pb-1 text-center text-xs text-red-600 sm:px-6">{error}</div>
        ) : null}

        <footer
          className={`z-30 shrink-0 border-t border-gray-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 ${
            keyboardInset ? "hidden" : ""
          }`}
        >
          <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={step === 1 || saving}
              onClick={onBack}
              className="h-10 rounded-xl px-3 text-sm text-gray-600"
            >
              Back
            </Button>
            <div className="flex items-center gap-2">
              {footerExtra}
              <Button
                type="button"
                onClick={onContinue}
                disabled={saving || loading || continueDisabled || (step === 3 && !isEditing)}
                className="h-10 min-w-28 rounded-xl bg-primary-orange px-5 text-sm font-semibold text-white hover:bg-primary-orange/90 disabled:opacity-50"
              >
                {continueLabel}
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
