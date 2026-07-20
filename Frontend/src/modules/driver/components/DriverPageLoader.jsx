import { Loader2 } from "lucide-react";

export default function DriverPageLoader({ label = "Loading…" }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#0c1410] text-white">
      <Loader2 className="w-7 h-7 animate-spin text-[#88c170]" aria-hidden="true" />
      <p className="text-sm text-white/50 font-medium">{label}</p>
    </div>
  );
}
