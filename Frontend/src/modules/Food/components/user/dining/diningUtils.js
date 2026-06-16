export const shimmerClassName =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2.2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent";

export function formatDistanceKm(km) {
  if (!Number.isFinite(km) || km === Number.POSITIVE_INFINITY) return "Nearby";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
