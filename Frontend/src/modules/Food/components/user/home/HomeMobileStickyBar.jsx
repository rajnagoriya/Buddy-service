import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Mic, SlidersHorizontal, MapPin } from "lucide-react";
import { Switch } from "@food/components/ui/switch";
import OptimizedImage from "@food/components/OptimizedImage";
import { useRef } from "react";

export default function HomeMobileStickyBar({
  visible,
  showCategories,
  onSearchFocus,
  vegMode,
  onVegModeChange,
  categories = [],
  activeFilters,
  onToggleFilter,
  onOpenFilters,
}) {
  const vegToggleAnchorRef = useRef(null);
  const quickFilters = [
    { id: "delivery-under-30", label: "Under 30 mins" },
    { id: "delivery-under-45", label: "Under 45 mins" },
    { id: "distance-under-1km", label: "Under 1 km", icon: MapPin },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="food-mobile-sticky"
        >
          <div className="food-mobile-sticky__search-row">
            <button type="button" className="food-mobile-sticky__search" onClick={onSearchFocus}>
              <Search className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              <span className="truncate">Search restaurants &amp; dishes</span>
              <Mic className="h-4 w-4 shrink-0 opacity-60" />
            </button>
          </div>

          <AnimatePresence>
            {showCategories && categories.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="food-mobile-sticky__categories overflow-hidden"
              >
                <div className="food-mobile-sticky__categories-scroll">
                  {categories.map((category, index) => (
                    <Link
                      key={`sticky-${category.id || index}`}
                      to={`/food/user/category/${category.slug}`}
                      className="food-mobile-sticky__cat"
                    >
                      <div className="food-mobile-sticky__cat-img">
                        <OptimizedImage src={category.image} alt={category.name} className="w-full h-full object-cover" />
                      </div>
                      <span>{category.name}</span>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="food-mobile-sticky__filters">
            <div
              ref={vegToggleAnchorRef}
              className="food-mobile-filter-chip food-mobile-filter-chip--toggle"
            >
              <span>Veg</span>
              <Switch
                checked={vegMode}
                onCheckedChange={(next) =>
                  onVegModeChange(next, { anchorEl: vegToggleAnchorRef.current })
                }
                className="scale-[0.72]"
              />
            </div>
            <button type="button" className="food-mobile-filter-chip" onClick={onOpenFilters}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </button>
            {quickFilters.map((filter) => {
              const Icon = filter.icon;
              const isActive = activeFilters?.has(filter.id);
              return (
                <button
                  key={filter.id}
                  type="button"
                  className={`food-mobile-filter-chip${isActive ? " is-active" : ""}`}
                  onClick={() => onToggleFilter(filter.id)}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {filter.label}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
