import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Bookmark, Clock, MapPin, Star } from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Badge } from "@food/components/ui/badge";
import OptimizedImage from "@food/components/OptimizedImage";
import { formatDistanceKm, shimmerClassName } from "./diningUtils";

export default function DiningRestaurantCard({
  restaurant,
  index = 0,
  favorite = false,
  onToggleFavorite,
  variant = "mobile",
}) {
  const restaurantSlug = restaurant.slug || encodeURIComponent(restaurant.name);
  const diningDetailPath = `/food/user/dining/${restaurant.diningType}/${restaurantSlug}`;
  const distanceLabel = restaurant.distance || formatDistanceKm(restaurant.distanceValue);
  const rating = Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "NEW";

  if (variant === "desktop") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.06 }}
        className="h-full"
      >
        <Link to={diningDetailPath} state={{ restaurant }} className="group block h-full">
          <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-[#1a1a1a]">
            <div className="relative h-52 w-full shrink-0 overflow-hidden sm:h-60">
              {restaurant.image ? (
                <OptimizedImage
                  src={restaurant.image}
                  alt={restaurant.name}
                  className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                  objectFit="cover"
                  priority={index < 3}
                />
              ) : (
                <div className={`h-full w-full bg-gradient-to-br from-amber-100 to-orange-100 ${shimmerClassName}`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute top-3 left-3 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                {restaurant.offer || "Pre-book table"}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 h-9 w-9 rounded-xl bg-white/90 backdrop-blur-sm"
                onClick={onToggleFavorite}
              >
                <Bookmark className={`h-4 w-4 ${favorite ? "fill-gray-900 text-gray-900" : "text-gray-500"}`} />
              </Button>
              <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-white">
                <Star className="h-3 w-3 fill-white" />
                <span className="text-sm font-bold">{rating}</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="line-clamp-1 text-lg font-extrabold text-gray-900 dark:text-white">{restaurant.name}</h3>
              <p className="mt-0.5 line-clamp-1 text-xs font-medium text-gray-500">{restaurant.cuisine}</p>
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
                <Clock className="h-3.5 w-3.5" />
                {restaurant.deliveryTime}
                <span>·</span>
                <MapPin className="h-3.5 w-3.5" />
                {distanceLabel}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className={restaurant.isEnabled ? "border-green-200 bg-green-50 text-green-700" : ""}>
                  {restaurant.isEnabled ? "Booking ON" : "Booking OFF"}
                </Badge>
              </div>
            </div>
          </article>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={diningDetailPath} state={{ restaurant }} className="group block">
        <article className="flex gap-3 overflow-hidden rounded-2xl border border-gray-100 bg-white p-2.5 shadow-sm transition active:scale-[0.99] dark:border-gray-800 dark:bg-[#1a1a1a] md:hidden">
          <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl">
            {restaurant.image ? (
              <OptimizedImage src={restaurant.image} alt={restaurant.name} className="h-full w-full" objectFit="cover" />
            ) : (
              <div className={`h-full w-full bg-gradient-to-br from-amber-100 to-orange-100 ${shimmerClassName}`} />
            )}
            <div className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-md bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              <Star className="h-2.5 w-2.5 fill-white" />
              {rating}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-1 text-sm font-extrabold text-gray-900 dark:text-white">{restaurant.name}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 rounded-lg"
                  onClick={onToggleFavorite}
                >
                  <Bookmark className={`h-4 w-4 ${favorite ? "fill-amber-700 text-amber-700" : "text-gray-400"}`} />
                </Button>
              </div>
              <p className="line-clamp-1 text-[11px] font-medium text-gray-500">{restaurant.cuisine}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-gray-500">
              <span className="inline-flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {restaurant.deliveryTime}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {distanceLabel}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                {restaurant.isEnabled ? "Book table" : "View menu"}
              </span>
              {restaurant.featuredPrice > 0 && (
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">
                  from ₹{restaurant.featuredPrice}
                </span>
              )}
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

export function DiningRestaurantSkeleton({ index }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-2.5 md:block md:p-0 dark:border-gray-800 dark:bg-[#1a1a1a]">
      <div className={`h-[88px] w-[88px] shrink-0 rounded-xl bg-gray-100 md:h-52 md:w-full ${shimmerClassName}`} />
      <div className="flex-1 space-y-2 py-1 md:p-4">
        <div className="h-4 w-3/4 rounded-full bg-gray-100 dark:bg-gray-800" />
        <div className="h-3 w-1/2 rounded-full bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}
