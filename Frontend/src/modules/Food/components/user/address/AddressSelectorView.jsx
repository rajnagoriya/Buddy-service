import { useMemo } from "react";
import {
  ChevronLeft,
  Plus,
  MapPin,
  Navigation,
  Search,
  Home,
  Briefcase,
  Building2,
  Loader2,
} from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import {
  QUICK_SLOTS,
  buildQuickSlotMap,
  formatAddressLine,
  getAddressId,
  getAddressIcon,
} from "./addressUtils";

const SLOT_ICONS = { home: Home, work: Briefcase, other: Building2 };

export default function AddressSelectorView({
  onBack,
  searchQuery = "",
  onSearchChange,
  locationPreview = "",
  geoLoading = false,
  onUseCurrentLocation,
  addresses = [],
  defaultAddressId = null,
  onSelectAddress,
  onAddNew,
  onQuickSlotClick,
}) {
  const quickSlots = useMemo(() => buildQuickSlotMap(addresses), [addresses]);

  const filteredAddresses = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return addresses;
    return addresses.filter((addr) => {
      const text = `${addr.label || ""} ${formatAddressLine(addr)}`.toLowerCase();
      return text.includes(q);
    });
  }, [addresses, searchQuery]);

  return (
    <AnimatedPage className="flex min-h-dvh flex-col bg-[#f6f7f4] dark:bg-[#0a0a0a] pt-[env(safe-area-inset-top)] [-webkit-tap-highlight-color:transparent]">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-[#eef0eb] bg-white px-4 py-3 dark:border-[#262626] dark:bg-[#141414]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition active:scale-95 dark:bg-[#262626] dark:text-white"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight text-[#141f12] dark:text-white">
            Delivery location
          </h1>
          <p className="text-xs font-medium text-gray-500">
            Choose where your food should arrive
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {/* Search */}
        <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm dark:border-[#333] dark:bg-[#1a1a1a]">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search saved addresses..."
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-semibold text-gray-900 outline-none placeholder:font-medium placeholder:text-gray-400 dark:text-white"
          />
        </div>

        {/* GPS card */}
        <button
          type="button"
          onClick={onUseCurrentLocation}
          disabled={geoLoading}
          className="mx-4 mt-4 w-[calc(100%-2rem)] rounded-2xl border-[1.5px] border-green-600/25 bg-gradient-to-br from-emerald-50 via-green-50/80 to-white p-4 text-left shadow-[0_8px_24px_rgba(22,163,74,0.12)] transition active:scale-[0.98] disabled:opacity-70 dark:from-green-950/30 dark:via-[#141414] dark:to-[#141414] dark:border-green-600/35"
        >
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-600 text-white">
              <span className="absolute -inset-1 animate-ping rounded-2xl border-2 border-green-500/40 opacity-75" />
              {geoLoading ? (
                <Loader2 className="relative h-5 w-5 animate-spin" />
              ) : (
                <Navigation className="relative h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold text-green-700 dark:text-green-400">
                Use current location
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-gray-600 dark:text-gray-400">
                {locationPreview || "Enable GPS for accurate delivery"}
              </p>
            </div>
          </div>
        </button>

        {/* Quick slots: Home / Work / Other */}
        <section className="mt-5 px-4">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
            Quick delivery tags
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {QUICK_SLOTS.map((slot) => {
              const saved = quickSlots[slot.key];
              const SlotIcon = SLOT_ICONS[slot.key] || MapPin;
              const isSelected = saved && getAddressId(saved) === defaultAddressId;

              return (
                <button
                  key={slot.key}
                  type="button"
                  onClick={() => onQuickSlotClick?.(slot.key, saved)}
                  className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] px-1 py-3 transition active:scale-95 ${
                    saved
                      ? isSelected
                        ? "border-green-600 bg-green-50 shadow-[0_0_0_2px_rgba(22,163,74,0.25)] dark:bg-green-950/30"
                        : "border-green-600/35 bg-green-50/80 dark:bg-green-950/20"
                      : "border-dashed border-gray-300 bg-white dark:border-[#404040] dark:bg-[#1a1a1a]"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      saved ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 dark:bg-[#262626]"
                    }`}
                  >
                    {saved ? <SlotIcon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                    {slot.label}
                  </span>
                  <span className="line-clamp-2 px-1 text-center text-[9px] font-semibold leading-tight text-gray-400">
                    {saved ? formatAddressLine(saved) : slot.emptyHint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Saved list */}
        <section className="mt-6 px-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-400">
              Saved addresses
            </p>
            <span className="text-xs font-bold text-gray-500">{filteredAddresses.length}</span>
          </div>

          {filteredAddresses.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-10 text-center dark:border-[#333] dark:bg-[#1a1a1a]">
              <MapPin className="mx-auto mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                {searchQuery ? "No matching addresses" : "No saved addresses yet"}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Add home or work for faster checkout
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredAddresses.map((addr, idx) => {
                const id = getAddressId(addr);
                const isActive = id && id === defaultAddressId;
                const Icon = getAddressIcon(addr);

                return (
                  <button
                    key={id || idx}
                    type="button"
                    onClick={() => onSelectAddress(addr)}
                    className={`flex w-full items-start gap-3.5 rounded-2xl border-[1.5px] p-4 text-left transition active:scale-[0.99] ${
                      isActive
                        ? "border-green-600 bg-green-50 shadow-[0_4px_16px_rgba(22,163,74,0.12)] dark:bg-green-950/20"
                        : "border-[#eef0eb] bg-white dark:border-[#333] dark:bg-[#1a1a1a]"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isActive ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-[#262626]"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold capitalize text-gray-900 dark:text-white">
                        {addr.label || "Address"}
                        {addr.isDefault ? (
                          <span className="ml-2 rounded-md bg-green-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Default
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-gray-500 dark:text-gray-400">
                        {formatAddressLine(addr)}
                      </p>
                    </div>
                    <div
                      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isActive ? "border-green-600 bg-green-600" : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={onAddNew}
          className="mx-4 mt-5 flex min-h-12 w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-green-600 bg-green-600/5 text-sm font-extrabold text-green-700 transition active:scale-[0.98] dark:text-green-400"
        >
          <Plus className="h-4 w-4" />
          Add new address on map
        </button>

        <p className="mx-6 mt-4 text-center text-[11px] font-semibold leading-relaxed text-gray-400">
          Your location helps us show restaurants that deliver to you. Works inside the Buddy app.
        </p>
      </div>
    </AnimatedPage>
  );
}
