import { Search, Mic } from "lucide-react";
import { Input } from "@food/components/ui/input";

export default function DiningMobileHeader({ heroSearch, onSearchChange, onSearchFocus, onSearchSubmit }) {
  return (
    <div className="relative overflow-hidden md:hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#2c1810] via-[#3a2418] to-[#1a2517]" />
      <div className="absolute -top-10 -right-8 h-40 w-40 rounded-full bg-amber-500/25 blur-3xl" />
      <div className="absolute top-24 -left-10 h-32 w-32 rounded-full bg-green-500/15 blur-3xl" />

      <div className="relative z-10 px-4 pb-4 pt-3">
        <div className="mb-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300/90">Dine out</p>
          <h1 className="text-2xl font-black tracking-tight text-white">Book your table</h1>
          <p className="mt-1 text-xs font-medium text-white/65">Pre-book &amp; skip the wait at top restaurants</p>
        </div>

        <div
          className="mt-4 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <Search className="h-4 w-4 shrink-0 text-amber-300" strokeWidth={2.5} />
          <Input
            value={heroSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onSearchFocus}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearchSubmit?.();
            }}
            className="h-7 flex-1 border-0 bg-transparent p-0 text-[13px] font-bold text-white placeholder:text-white/45 focus-visible:ring-0"
            placeholder="Search restaurants, cuisines..."
          />
          <div className="h-4 w-px bg-white/20" />
          <button type="button" className="rounded-full p-1.5 active:bg-white/10">
            <Mic className="h-4 w-4 text-amber-300" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
