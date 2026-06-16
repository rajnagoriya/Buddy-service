import { ChevronLeft, MapPin, Navigation, Search } from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Input } from "@food/components/ui/input";
import { Label } from "@food/components/ui/label";
import AnimatedPage from "@food/components/user/AnimatedPage";

const LABEL_OPTIONS = ["Home", "Work", "Other"];

export default function AddressFormView({
  onCancel,
  formBodyRef,
  scrollTop = 0,
  onFormScroll,
  keyboardInset,
  baseMapHeight,
  mapContainerRef,
  mapLoading,
  addressAutocompleteValue,
  onAutocompleteChange,
  isKeywordSearching,
  keywordSuggestions = [],
  onPickSuggestion,
  onUseCurrentLocation,
  currentAddress,
  addressFormData,
  onFormChange,
  onLabelChange,
  manualFieldRefs,
  scrollFieldIntoView,
  loadingAddress,
  onSubmit,
  clamp,
}) {
  const mapHeight = baseMapHeight;

  return (
    <AnimatedPage className="fixed inset-0 z-50 flex h-dvh min-h-dvh flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] dark:bg-[#0a0a0a]">
      <header className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 dark:bg-[#1a1a1a]">
        <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-full">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-lg font-extrabold text-gray-900 dark:text-white">Pin delivery spot</h1>
          <p className="text-xs font-medium text-gray-500">Move map &amp; confirm address details</p>
        </div>
      </header>

      <div
        ref={formBodyRef}
        onScroll={(e) => onFormScroll?.(e.currentTarget.scrollTop)}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: `${96 + keyboardInset}px` }}
      >
        {/* Map */}
        <div
          className="relative z-0 shrink-0"
          style={{
            height: `${mapHeight}px`,
            transform: `translateY(${scrollTop * 0.4}px)`,
            opacity: clamp(1 - scrollTop / 500, 0.4, 1),
          }}
        >
          <div className="absolute top-4 right-4 left-4 z-20">
            <div className="relative shadow-2xl">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <Input
                value={addressAutocompleteValue}
                onChange={(e) => onAutocompleteChange(e.target.value)}
                placeholder="Search area, street, landmark..."
                className="h-12 rounded-xl border-none bg-white/95 pl-10 shadow-lg backdrop-blur-md focus-visible:ring-2 focus-visible:ring-green-600 dark:bg-[#1a1a1a]/95"
              />
              {isKeywordSearching && (
                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                </div>
              )}

              {keywordSuggestions.length > 0 && (
                <div className="absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#1a1a1a]">
                  <p className="bg-gray-50 px-4 py-2 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:bg-gray-800/50">
                    Suggestions
                  </p>
                  {keywordSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onPickSuggestion(s)}
                      className="flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors last:border-none hover:bg-green-600/5 dark:border-gray-800 dark:hover:bg-green-600/10"
                    >
                      <MapPin className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{s.display}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {s.address?.city || s.address?.state}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div ref={mapContainerRef} className="h-full w-full bg-gray-100 dark:bg-gray-800" />

          {/* Map pin */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative mb-8 flex flex-col items-center">
              <div className="mb-[-6px] flex h-10 w-10 animate-bounce items-center justify-center rounded-full bg-green-100 p-2 shadow-sm dark:bg-green-900/30">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-green-600">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                </div>
              </div>
              <div className="h-6 w-1.5 rounded-b-full border-x border-white bg-green-600 shadow-xl shadow-green-900/40" />
              <div className="absolute bottom-[-4px] h-1.5 w-3 scale-x-150 rounded-full bg-black/20 blur-[1px]" />
            </div>
          </div>

          {mapLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-green-600" />
            </div>
          )}

          <div className="absolute right-4 bottom-10 z-10">
            <Button
              type="button"
              onClick={onUseCurrentLocation}
              className="h-12 rounded-full border border-gray-200 bg-white px-6 text-black shadow-xl hover:bg-gray-100"
            >
              <Navigation className="mr-2 h-4 w-4 text-green-600" />
              My location
            </Button>
          </div>
        </div>

        {/* Form sheet */}
        <div className="relative z-10 -mt-8 space-y-6 rounded-t-[32px] bg-white p-4 shadow-[0_-12px_24px_-10px_rgba(0,0,0,0.1)] dark:bg-[#0a0a0a]">
          <div className="flex gap-3 rounded-xl border border-green-600/10 bg-green-600/5 p-4 dark:border-green-600/20 dark:bg-green-600/10">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div className="min-w-0">
              <p className="mb-1 text-xs font-bold text-green-600 uppercase dark:text-green-400/80">
                Pinned location
              </p>
              <p className="line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
                {currentAddress || "Drag map or search to set location"}
              </p>
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-sm font-bold">Street / area / landmark</Label>
            <Input
              placeholder="Building, street, area"
              value={addressFormData.street}
              onChange={(e) => onFormChange("street", e.target.value)}
              onFocus={() => scrollFieldIntoView("street")}
              ref={(el) => {
                manualFieldRefs.current.street = el;
              }}
              className="mb-4 h-12 rounded-xl bg-gray-50 dark:bg-gray-800/50"
              required
            />

            <Label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
              Flat / floor / house no.
            </Label>
            <Input
              placeholder="e.g. Flat 402, 4th Floor"
              value={addressFormData.additionalDetails}
              onChange={(e) => onFormChange("additionalDetails", e.target.value)}
              onFocus={() => scrollFieldIntoView("additionalDetails")}
              ref={(el) => {
                manualFieldRefs.current.additionalDetails = el;
              }}
              className="h-12 rounded-xl border-gray-200 dark:border-gray-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1 block text-xs">City</Label>
              <Input
                value={addressFormData.city}
                onChange={(e) => onFormChange("city", e.target.value)}
                onFocus={() => scrollFieldIntoView("city")}
                ref={(el) => {
                  manualFieldRefs.current.city = el;
                }}
                className="h-12 rounded-xl"
                required
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">State</Label>
              <Input
                value={addressFormData.state}
                onChange={(e) => onFormChange("state", e.target.value)}
                onFocus={() => scrollFieldIntoView("state")}
                ref={(el) => {
                  manualFieldRefs.current.state = el;
                }}
                className="h-12 rounded-xl"
                required
              />
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs">Pincode</Label>
            <Input
              placeholder="Pincode"
              value={addressFormData.zipCode || ""}
              onChange={(e) => onFormChange("zipCode", e.target.value)}
              onFocus={() => scrollFieldIntoView("zipCode")}
              ref={(el) => {
                manualFieldRefs.current.zipCode = el;
              }}
              className="h-12 rounded-xl"
            />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-bold">Save as</Label>
            <div className="flex gap-2">
              {LABEL_OPTIONS.map((l) => (
                <Button
                  key={l}
                  type="button"
                  variant={addressFormData.label === l ? "default" : "outline"}
                  onClick={() => onLabelChange(l)}
                  className={`flex-1 ${addressFormData.label === l ? "bg-green-600 text-white hover:bg-green-700" : ""}`}
                >
                  {l}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="fixed right-0 left-0 border-t border-gray-100 bg-white p-4 transition-[bottom] duration-150 dark:border-gray-800 dark:bg-[#1a1a1a]"
        style={{ bottom: `${keyboardInset}px`, paddingBottom: `calc(1rem + env(safe-area-inset-bottom))` }}
      >
        <Button
          type="button"
          className="h-12 w-full rounded-2xl bg-green-600 text-base font-extrabold text-white hover:bg-green-700"
          onClick={onSubmit}
          disabled={loadingAddress}
        >
          {loadingAddress ? "Saving..." : "Save & deliver here"}
        </Button>
      </div>
    </AnimatedPage>
  );
}
