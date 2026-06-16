import OptimizedImage from "@food/components/OptimizedImage";
import { motion } from "framer-motion";
import { shimmerClassName } from "./diningUtils";

export default function DiningHeroBanner({
  banners = [],
  loading = false,
  currentIndex = 0,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onDotClick,
}) {
  return (
    <div className="px-4 -mt-3 md:mt-0 md:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative h-[168px] overflow-hidden rounded-2xl shadow-[0_12px_32px_rgba(44,24,16,0.18)] sm:h-[200px] md:h-[240px] md:rounded-3xl lg:h-[280px]"
      >
        {banners.length > 0 ? (
          <div
            className="relative h-full w-full"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="flex h-full w-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {banners.map((banner, index) => (
                <div key={banner.id} className="relative h-full w-full shrink-0">
                  <OptimizedImage
                    src={banner.imageUrl}
                    alt={banner.tagline || `Dining offer ${index + 1}`}
                    className="h-full w-full"
                    objectFit="cover"
                    priority={index === 0}
                    sizes="100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                    {banner.promoCode && (
                      <span className="inline-block rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#2c1810]">
                        {banner.promoCode}
                      </span>
                    )}
                    {banner.tagline && (
                      <h2 className="mt-2 text-lg font-black leading-tight text-white sm:text-xl">
                        {banner.tagline}
                      </h2>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {banners.length > 1 && (
              <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-2.5 py-1 backdrop-blur-sm">
                {banners.map((banner, index) => (
                  <button
                    key={`${banner.id}-dot`}
                    type="button"
                    aria-label={`Banner ${index + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDotClick?.(index);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      currentIndex === index ? "w-5 bg-amber-400" : "w-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className={`relative h-full w-full bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 dark:from-amber-950/40 dark:via-[#1a1a1a] dark:to-amber-950/20 ${shimmerClassName}`}
          >
            <div className="absolute inset-0 flex flex-col justify-end p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
                Dining
              </p>
              <h2 className="mt-1 text-xl font-black text-[#2c1810] dark:text-white sm:text-2xl">
                {loading ? "Finding tables near you..." : "Book tables at top spots"}
              </h2>
              <p className="mt-1 text-xs font-medium text-amber-900/70 dark:text-amber-200/60">
                Exclusive pre-book offers on partner restaurants
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
