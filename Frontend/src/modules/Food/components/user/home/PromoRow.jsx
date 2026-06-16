import React from "react";
import discountPromoIcon from "@food/assets/category-icons/discount_promo.png";
import vegPromoIcon from "@food/assets/category-icons/veg_promo.png";
import pricePromoIcon from "@food/assets/category-icons/price_promo.png";

const PROMO_ITEMS = [
  {
    id: "offers",
    tag: "Min.",
    value: "40% OFF",
    valueClass: "text-rose-600",
    icon: discountPromoIcon,
    className: "food-mobile-promo--offers",
  },
  {
    id: "pure-veg",
    tag: "Pure",
    value: "Veg Mode",
    valueClass: "text-emerald-700",
    icon: vegPromoIcon,
    className: "food-mobile-promo--veg",
  },
  {
    id: "under-250",
    tag: "Under",
    value: null,
    valueClass: "text-amber-700",
    icon: pricePromoIcon,
    className: "food-mobile-promo--price",
  },
];

export default function PromoRow({
  handleVegModeChange,
  navigate,
  isVegMode,
  toggleRef,
  under250PriceLimit = 250,
  className = "",
  variant = "desktop",
}) {
  const isMobile = variant === "mobile";

  const promoCardsData = [
    {
      id: "offers",
      title: "MIN.",
      value: "40% off",
      icon: discountPromoIcon,
      bgColor: "bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/20",
      borderColor: "border-rose-200/60 dark:border-rose-800/40",
      textColor: "text-rose-600 dark:text-rose-400",
      iconContainerColor: "bg-rose-500/10 dark:bg-rose-400/10",
    },
    {
      id: "pure-veg",
      title: "PURE",
      value: "Veg",
      icon: vegPromoIcon,
      bgColor: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20",
      borderColor: "border-emerald-200/60 dark:border-emerald-800/40",
      textColor: "text-emerald-600 dark:text-emerald-400",
      iconContainerColor: "bg-emerald-500/10 dark:bg-emerald-400/10",
    },
    {
      id: "under-250",
      title: "UNDER",
      value: `₹${under250PriceLimit}`,
      icon: pricePromoIcon,
      bgColor: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20",
      borderColor: "border-amber-200/60 dark:border-amber-800/40",
      textColor: "text-amber-600 dark:text-amber-400",
      iconContainerColor: "bg-amber-500/10 dark:bg-amber-400/10",
    },
  ];

  const handleClick = (id) => {
    if (id === "pure-veg") handleVegModeChange(!isVegMode);
    else if (id === "offers") navigate("/food/user/offers");
    else if (id === "under-250") navigate("/food/user/under-250");
  };

  if (isMobile) {
    return (
      <div className={`food-mobile-promos ${className}`}>
        {PROMO_ITEMS.map((promo) => (
          <button
            key={promo.id}
            type="button"
            ref={promo.id === "pure-veg" ? toggleRef : null}
            className={`food-mobile-promo ${promo.className}${promo.id === "pure-veg" && isVegMode ? " is-active" : ""}`}
            onClick={() => handleClick(promo.id)}
          >
            <span className="food-mobile-promo__tag">{promo.tag}</span>
            <span className={`food-mobile-promo__value ${promo.valueClass}`}>
              {promo.id === "under-250" ? `₹${under250PriceLimit}` : promo.value}
            </span>
            <div className="food-mobile-promo__icon-wrap">
              <img src={promo.icon} alt="" className="food-mobile-promo__icon" />
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-3 gap-3 px-4 pt-4 pb-6 bg-white dark:bg-[#0a0a0a] ${className}`}>
      {promoCardsData.map((promo, idx) => (
        <div
          key={idx}
          ref={promo.id === "pure-veg" ? toggleRef : null}
          className={`${promo.bgColor} ${promo.borderColor} rounded-[2rem] p-1.5 flex flex-col items-center h-[130px] shadow-sm border transition-all duration-300 cursor-pointer active:scale-95 group relative overflow-hidden ${
            promo.id === "pure-veg" && isVegMode ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20" : ""
          }`}
          onClick={() => handleClick(promo.id)}
        >
          <div className={`absolute -top-10 -left-10 w-24 h-24 rounded-full mix-blend-multiply filter blur-2xl opacity-20 ${promo.bgColor}`} />

          <div className="py-2.5 px-1 flex flex-col items-center text-center relative z-10 w-full">
            <span className="text-[9px] font-semibold text-muted-foreground tracking-[0.12em] uppercase leading-none mb-1">
              {promo.title}
            </span>
            <div className={`text-[12px] sm:text-[13px] font-black ${promo.textColor} leading-none truncate w-full px-1 flex items-center justify-center gap-0.5`}>
              {promo.value}
            </div>
          </div>

          <div className={`flex-1 w-full ${promo.iconContainerColor} backdrop-blur-sm rounded-[1.6rem] flex items-center justify-center p-2.5 mt-auto mb-1 overflow-hidden relative shadow-inner`}>
            <img
              src={promo.icon}
              alt={promo.value}
              className="w-full h-full object-contain drop-shadow-xl transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
