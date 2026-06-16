import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Gift, Sparkles } from "lucide-react";

export const FEST_SLIDES = [
  {
    id: "blue",
    heading: "Flat ₹150 OFF",
    sub: "on Premium Dining restaurants",
    cta: "Explore now",
    section: "bg-gradient-to-b from-[#dce7ff] to-[#d3ddff]",
    theme: {
      card: "from-[#dbe6ff] via-[#d5e1ff] to-[#cddaff]",
      text: "text-[#1c2c5a]",
      button: "bg-[#1e3a8a] text-white",
      badge: "bg-white text-[#1e3a8a]",
      accent: "text-[#5167bf]",
      icon: "text-[#90a4ff]",
      iconBorder: "border-[#b9c6ff]",
      dotActive: "bg-[#2b3f83]",
      dotInactive: "bg-[#2b3f83]/25",
    },
    right: "sparkle",
  },
  {
    id: "pink",
    heading: "Get",
    sub: "on your first order under 7 km",
    cta: "Know more",
    section: "bg-gradient-to-b from-[#ff2f7a] to-[#ff4a8d]",
    theme: {
      card: "from-[#ff2f7a] via-[#ff3b84] to-[#ff5d96]",
      text: "text-white",
      button: "bg-white text-[#ff3b84]",
      badge: "bg-white text-[#ff3b84]",
      accent: "text-white/70",
      icon: "text-white/70",
      iconBorder: "border-white/60",
      dotActive: "bg-white",
      dotInactive: "bg-white/50",
    },
    right: "burger",
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?w=240&h=240&fit=crop&q=80",
  },
  {
    id: "green",
    heading: "Free Delivery",
    sub: "on all fast food orders above ₹199",
    cta: "Order now",
    section: "bg-gradient-to-b from-[#d9f6e6] to-[#c8f0dd]",
    theme: {
      card: "from-[#d9f6e6] via-[#d2f2e2] to-[#c8f0dd]",
      text: "text-[#0f5d4b]",
      button: "bg-[#0f6b53] text-white",
      badge: "bg-white text-[#0f6b53]",
      accent: "text-[#0f5d4b]/70",
      icon: "text-[#78c8a7]",
      iconBorder: "border-[#9bd8bf]",
      dotActive: "bg-[#0f6b53]",
      dotInactive: "bg-[#0f6b53]/25",
    },
    right: "gift",
  },
];

const renderRightVisual = (slide) => {
  if (slide.right === "burger") {
    return (
      <div className="w-20 h-20 rounded-2xl bg-white shadow-[0_10px_22px_rgba(0,0,0,0.12)] flex items-center justify-center">
        <img
          src={slide.image}
          alt="burger"
          className="w-14 h-14 rounded-xl object-cover"
        />
      </div>
    );
  }

  if (slide.right === "gift") {
    return (
      <div className={`relative w-16 h-16 rounded-2xl border-2 ${slide.theme.iconBorder} ${slide.theme.icon} flex items-center justify-center`}>
        <Gift className="w-7 h-7" />
      </div>
    );
  }

  return (
    <div className={`relative w-16 h-16 rounded-[20px] border-2 ${slide.theme.iconBorder} ${slide.theme.icon} flex items-center justify-center`}>
      <Sparkles className="w-6 h-6" />
      <div className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-current" />
      <div className="absolute right-4 bottom-2 h-2 w-2 rounded-full border border-current" />
    </div>
  );
};

export default function FestBanner({ activeIndex, onChange, embedded = false }) {
  const [localIndex, setLocalIndex] = useState(0);
  const resolvedIndex = Number.isFinite(activeIndex) ? activeIndex : localIndex;
  const setIndex = onChange || setLocalIndex;

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % FEST_SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [setIndex]);

  const shellClassName = embedded
    ? "relative pt-1 pb-2 overflow-hidden min-h-[150px] sm:min-h-[180px] w-full"
    : "relative pt-2 pb-4 overflow-hidden min-h-[160px] sm:min-h-[190px] w-full -mx-4 px-4";

  return (
    <motion.div initial={false} className={shellClassName}>
      <div className="relative z-10">
        <AnimatePresence mode="wait" initial={false}>
          {FEST_SLIDES.map((slide, index) =>
            index === resolvedIndex ? (
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4 }}
                className={`relative w-full px-5 sm:px-6 py-5 sm:py-6 overflow-hidden ${
                  embedded
                    ? `rounded-[1.25rem] shadow-[0_8px_28px_rgba(0,0,0,0.22)] bg-gradient-to-br ${slide.theme.card}`
                    : `rounded-[24px] shadow-[0_10px_22px_rgba(0,0,0,0.08)] bg-gradient-to-br ${slide.theme.card}`
                }`}
              >
                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-80">
                  {renderRightVisual(slide)}
                </div>

                <div className={`space-y-2 ${slide.theme.text}`}>
                  {slide.id === "pink" ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg sm:text-xl font-black tracking-tight">{slide.heading}</span>
                        <span className={`text-[12px] font-black rounded-full px-2 py-0.5 ${slide.theme.badge}`}>
                          50% OFF
                        </span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black leading-tight">FREE delivery</div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg sm:text-xl font-black tracking-tight">
                        {slide.heading}
                      </span>
                      {slide.id === "blue" && (
                        <span className="text-[12px] font-bold rounded-full px-2 py-0.5 bg-white/90 text-[#1d2d5c]">
                          Premium
                        </span>
                      )}
                    </div>
                  )}

                  <p className={`text-sm sm:text-base font-semibold ${slide.theme.accent}`}>
                    {slide.id === "pink" ? `& FREE delivery ${slide.sub}` : slide.sub}
                  </p>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 text-xs sm:text-sm font-black px-4 py-2 rounded-full shadow-sm ${slide.theme.button}`}
                  >
                    {slide.cta}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ) : null,
          )}
        </AnimatePresence>

        <div className="mt-3 flex items-center justify-center gap-2">
          {FEST_SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setIndex(index)}
              className={`h-1.5 rounded-full transition-all ${index === resolvedIndex ? `w-6 ${FEST_SLIDES[resolvedIndex].theme.dotActive}` : `w-2.5 ${FEST_SLIDES[resolvedIndex].theme.dotInactive}`}`}
              aria-label={`Show banner ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

