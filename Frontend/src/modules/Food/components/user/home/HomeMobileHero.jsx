import { motion } from "framer-motion";
import HomeHeader from "./HomeHeader";
import FestBanner from "./FestBanner";

export default function HomeMobileHero({
  activeTab,
  headerProps,
  festSlideIndex,
  setFestSlideIndex,
}) {
  return (
    <div className="food-mobile-hero">
      <div className="food-mobile-hero__glow food-mobile-hero__glow--left" aria-hidden />
      <div className="food-mobile-hero__glow food-mobile-hero__glow--right" aria-hidden />
      <div className="food-mobile-hero__pattern" aria-hidden />

      <div className="food-mobile-hero__inner">
        <HomeHeader
          {...headerProps}
          activeTab={activeTab}
          tone="dark"
          embedded
          hideSearch={false}
        />

        {activeTab === "food" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="food-mobile-hero__offers"
          >
            <FestBanner
              embedded
              activeIndex={festSlideIndex}
              onChange={setFestSlideIndex}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
