import { useEffect, useState } from "react"
import { ChevronDown, Utensils } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { hasFoodVariants } from "@food/utils/foodVariants"
import { MenuDishCarouselCard, MenuDishListCard } from "./MenuDishCard"

export function FssaiLogoImage({
  src,
  className = "h-full w-auto object-contain",
  alt = "FSSAI",
}) {
  const [hasError, setHasError] = useState(false)
  const imageSrc = typeof src === "string" ? src.trim() : ""

  useEffect(() => {
    setHasError(false)
  }, [imageSrc])

  if (hasError || !imageSrc) {
    return (
      <span
        className="flex h-full w-full items-center justify-center text-[9px] font-bold uppercase tracking-wide text-[#F47920]"
        aria-hidden="true"
      >
        FSSAI
      </span>
    )
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  )
}

function DishCardWrapper({
  item,
  layout,
  quantity,
  isHighlighted,
  priceLabel,
  disabled,
  cardRef,
  onClick,
  onUpdateQuantity,
  nested = false,
}) {
  const handlers = {
    quantity,
    isHighlighted,
    priceLabel,
    disabled,
    nested,
    cardRef: (el) => {
      if (cardRef) cardRef(item.id, el)
    },
    onClick: () => onClick(item),
    onDecrement: (e) => {
      e?.stopPropagation?.()
      onUpdateQuantity(item, Math.max(0, quantity - 1), e)
    },
    onIncrement: (e) => {
      e?.stopPropagation?.()
      onUpdateQuantity(item, quantity + 1, e)
    },
    onAdd: (e) => {
      e?.stopPropagation?.()
      if (hasFoodVariants(item)) {
        onClick(item)
        return
      }
      onUpdateQuantity(item, 1, e)
    },
  }

  if (layout === "carousel") {
    return <MenuDishCarouselCard item={item} {...handlers} />
  }
  return <MenuDishListCard item={item} {...handlers} />
}

export default function MenuSectionBlock({
  section,
  originalIndex,
  isRecommended,
  isExpanded,
  loadingMenuItems,
  sectionItems,
  sectionSubsections,
  sectionImage,
  itemCount,
  highlightedDishId,
  shouldShowGrayscale,
  getSectionDisplayName,
  getDishQuantity,
  getFoodPriceLabel,
  onToggleExpand,
  onItemClick,
  onUpdateQuantity,
  dishCardRefs,
  toRenderableArray,
}) {
  const sectionId = `menu-section-${originalIndex}`
  const displayName = isRecommended ? "Recommended for you" : getSectionDisplayName(section)
  const count = itemCount ?? sectionItems.length

  if (isRecommended) {
    return (
      <div id={sectionId} className="scroll-mt-24 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
            {displayName}
          </h2>
          <button
            type="button"
            onClick={() => onToggleExpand(originalIndex)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-expanded={isExpanded}
          >
            <ChevronDown
              className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`}
            />
          </button>
        </div>

        {isExpanded && !loadingMenuItems && sectionItems.length === 0 && (
          <p className="text-center py-8 text-sm text-gray-500">No dishes recommended yet</p>
        )}

        {isExpanded && loadingMenuItems && (
          <div className="flex gap-2 overflow-hidden animate-pulse">
            <div className="h-44 w-[148px] rounded-xl bg-gray-100 dark:bg-gray-800 shrink-0" />
            <div className="h-44 w-[148px] rounded-xl bg-gray-100 dark:bg-gray-800 shrink-0" />
          </div>
        )}

        {isExpanded && sectionItems.length > 0 && (
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-0.5">
            <div className="flex items-stretch gap-2 w-max">
              {sectionItems.map((item) => (
                <DishCardWrapper
                  key={item.id}
                  item={item}
                  layout="carousel"
                  quantity={getDishQuantity(item)}
                  isHighlighted={highlightedDishId === item.id}
                  priceLabel={getFoodPriceLabel(item)}
                  disabled={shouldShowGrayscale}
                  cardRef={(id, el) => {
                    dishCardRefs.current[id] = el
                  }}
                  onClick={onItemClick}
                  onUpdateQuantity={onUpdateQuantity}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      id={sectionId}
      className="scroll-mt-24 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#141414] shadow-sm overflow-hidden"
    >
      <button
        type="button"
        onClick={() => onToggleExpand(originalIndex)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 sm:px-3.5 sm:py-3 text-left bg-gradient-to-r from-gray-50/80 to-white dark:from-[#1a1a1a] dark:to-[#141414] border-b border-gray-100 dark:border-gray-800 hover:from-green-50/40 dark:hover:from-green-950/10 transition-colors"
        aria-expanded={isExpanded}
      >
        {sectionImage ? (
          <img
            src={sectionImage}
            alt=""
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        ) : (
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center shrink-0">
            <Utensils className="h-4 w-4 text-[#16A34A]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-tight truncate">
            {displayName}
          </h2>
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {count} {count === 1 ? "item" : "items"}
            {section?.subtitle ? ` · ${section.subtitle}` : ""}
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`}
        />
      </button>

      {isExpanded && loadingMenuItems && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800 animate-pulse">
          <div className="h-[4.5rem] bg-gray-50 dark:bg-gray-900/50" />
          <div className="h-[4.5rem] bg-gray-50 dark:bg-gray-900/50" />
        </div>
      )}

      {isExpanded && !loadingMenuItems && sectionItems.length === 0 && sectionSubsections.length === 0 && (
        <p className="text-center py-8 text-sm text-gray-500">No items in this category</p>
      )}

      {isExpanded && sectionItems.length > 0 && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {sectionItems.map((item) => (
            <DishCardWrapper
              key={item.id}
              item={item}
              layout="list"
              nested
              quantity={getDishQuantity(item)}
              isHighlighted={highlightedDishId === item.id}
              priceLabel={getFoodPriceLabel(item)}
              disabled={shouldShowGrayscale}
              cardRef={(id, el) => {
                dishCardRefs.current[id] = el
              }}
              onClick={onItemClick}
              onUpdateQuantity={onUpdateQuantity}
            />
          ))}
        </div>
      )}

      {isExpanded &&
        sectionSubsections.map((subsection, subIndex) => {
          const subsectionItems = toRenderableArray ? toRenderableArray(subsection?.items) : subsection?.items || []
          if (!Array.isArray(subsectionItems) || subsectionItems.length === 0) return null

          return (
            <div key={subIndex} className="border-t border-gray-100 dark:border-gray-800">
              <div className="px-3 py-1.5 bg-gray-50/60 dark:bg-gray-900/40">
                <h3 className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  {subsection?.name || subsection?.title || "More"}
                </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {subsectionItems.map((item) => (
                  <DishCardWrapper
                    key={item.id}
                    item={item}
                    layout="list"
                    nested
                    quantity={getDishQuantity(item)}
                    isHighlighted={highlightedDishId === item.id}
                    priceLabel={getFoodPriceLabel(item)}
                    disabled={shouldShowGrayscale}
                    cardRef={(id, el) => {
                      dishCardRefs.current[id] = el
                    }}
                    onClick={onItemClick}
                    onUpdateQuantity={onUpdateQuantity}
                  />
                ))}
              </div>
            </div>
          )
        })}
    </div>
  )
}

export function MenuEmptyComingSoon({ restaurantName }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-green-200/60 bg-white dark:bg-[#141414] px-6 py-14 text-center">
      <div className="bg-green-50 dark:bg-green-950/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Utensils className="h-8 w-8 text-[#16A34A]" />
      </div>
      <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Menu coming soon</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
        {restaurantName || "This restaurant"} is updating their menu. Check back shortly!
      </p>
    </div>
  )
}

export function MenuEmptyNoMatches({ onClearFilters }) {
  return (
    <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414] px-6 py-12 text-center">
      <p className="text-lg font-extrabold text-gray-900 dark:text-white">No dishes match</p>
      <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or search</p>
      <Button variant="outline" size="sm" className="mt-5 rounded-xl font-bold" onClick={onClearFilters}>
        Clear filters
      </Button>
    </div>
  )
}

export function RestaurantFssaiBadge({ registrationNumber, logoSrc }) {
  if (!registrationNumber) return null
  return (
    <div className="mx-4 mb-24 mt-2 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 p-4">
      <div className="flex items-center gap-4 max-w-7xl lg:mx-auto">
        <div className="h-11 w-16 flex items-center justify-center bg-white rounded-xl p-1 shadow-sm border border-gray-100">
          <FssaiLogoImage src={logoSrc} />
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">FSSAI License</p>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 font-mono">{registrationNumber}</p>
        </div>
      </div>
    </div>
  )
}

export function FloatingMenuFab({ hidden, onClick, hasCart }) {
  if (hidden) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`fixed ${hasCart ? 'bottom-36' : 'bottom-24'} right-5 z-[60] sm:bottom-8 flex items-center gap-2 bg-[#16A34A] hover:bg-[#15803D] text-white px-5 py-3.5 rounded-2xl font-bold text-sm shadow-[0_8px_30px_rgba(22,163,74,0.35)] border border-white/20 transition-all hover:scale-105 active:scale-95`}
    >
      <Utensils className="h-4 w-4" />
      Menu
    </button>
  )
}
