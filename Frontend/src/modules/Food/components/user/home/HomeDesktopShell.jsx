import { Link } from "react-router-dom";
import { Search, Mic, SlidersHorizontal, MapPin } from "lucide-react";
import OptimizedImage from "@food/components/OptimizedImage";
import { Switch } from "@food/components/ui/switch";
import HomeSectionHeader from "./HomeSectionHeader";
import PromoRow from "./PromoRow";

import FestBanner from "./FestBanner";

export default function HomeDesktopShell({
  displayCategories = [],
  heroBanner = null,
  handleSearchFocus,
  vegMode,
  handleVegModeChange,
  under250PriceLimit = 250,
  navigate,
  activeFilters,
  setActiveFilters,
  applyFiltersAndRefetch,
  sortBy,
  selectedCuisine,
  setIsFilterOpen,
  festSlideIndex,
  setFestSlideIndex,
}) {
  const quickFilters = [
    { id: "delivery-under-30", label: "Under 30 mins" },
    { id: "delivery-under-45", label: "Under 45 mins" },
    { id: "distance-under-1km", label: "Under 1 km", icon: MapPin },
  ];

  const toggleFilter = (filterId) => {
    const nextFilters = new Set(activeFilters);
    if (nextFilters.has(filterId)) {
      nextFilters.delete(filterId);
    } else {
      nextFilters.add(filterId);
    }
    setActiveFilters(nextFilters);
    void applyFiltersAndRefetch(nextFilters, sortBy, selectedCuisine);
  };

  return (
    <div className="food-landing-desktop max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-8">
      <section className="rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/90 via-white to-lime-50/50 dark:from-emerald-950/20 dark:via-[#0a0a0a] dark:to-[#0a0a0a] dark:border-emerald-900/40 p-6 lg:p-8 shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] gap-8 items-center">
          <div className="space-y-5 min-w-0 order-2 lg:order-1">
            <p className="food-landing-eyebrow text-primary">Food delivery</p>
            <h1 className="food-landing-hero-title">
              Great food from restaurants near you
            </h1>
            <p className="food-landing-subtitle max-w-lg">
              Search dishes, explore cuisines, and get meals delivered fast with live order tracking.
            </p>
            <button
              type="button"
              onClick={handleSearchFocus}
              className="food-landing-search max-w-xl text-left"
            >
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">Search restaurants, cuisines, dishes…</span>
              <Mic className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Veg mode
                </span>
                <Switch
                  checked={vegMode}
                  onCheckedChange={handleVegModeChange}
                  className="data-[state=checked]:bg-primary h-5 w-9"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className="food-landing-chip"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </button>
            </div>
          </div>
          <div className={`w-full flex flex-col gap-4 rounded-2xl overflow-hidden [&>div]:!p-0 [&_.px-4]:!px-0 order-1 lg:order-2 ${heroBanner ? "min-h-[220px] lg:min-h-[260px]" : ""}`}>
            {heroBanner}
            <FestBanner embedded activeIndex={festSlideIndex} onChange={setFestSlideIndex} />
          </div>
        </div>
      </section>

      <PromoRow
        handleVegModeChange={handleVegModeChange}
        navigate={navigate}
        isVegMode={vegMode}
        under250PriceLimit={under250PriceLimit}
        className="!px-0 !pt-0 !pb-0 !bg-transparent"
      />

      <section>
        <HomeSectionHeader
          eyebrow="Categories"
          title="What's on your mind today?"
          actionLabel="View all"
          actionTo="/food/user/categories"
        />
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {displayCategories.map((category, index) => (
            <Link
              key={category.id || index}
              to={`/food/user/category/${category.slug}`}
              className="flex-shrink-0 flex flex-col items-center gap-2.5 w-[5.5rem] sm:w-24 group"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-border bg-card shadow-sm group-hover:border-primary/40 transition-colors">
                <OptimizedImage
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <span className="food-landing-category-label line-clamp-2 w-full">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {quickFilters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilters.has(filter.id);
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => toggleFilter(filter.id)}
              className={`food-landing-chip ${isActive ? "food-landing-chip--active" : ""}`}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {filter.label}
            </button>
          );
        })}
      </section>
    </div>
  );
}
