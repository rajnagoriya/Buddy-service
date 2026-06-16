import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import OptimizedImage from "@food/components/OptimizedImage";
import { shimmerClassName } from "./diningUtils";

function CategorySkeleton({ index }) {
  return (
    <motion.div
      className={`h-[120px] w-[108px] shrink-0 overflow-hidden rounded-2xl border border-amber-100/80 bg-gradient-to-b from-amber-50 to-white dark:border-white/10 dark:from-amber-950/20 dark:to-[#1a1a1a] sm:w-[124px] ${shimmerClassName}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    />
  );
}

export default function DiningCategoryRow({ categories = [], loading = false }) {
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between px-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
            Explore
          </p>
          <h2 className="text-base font-extrabold text-gray-900 dark:text-white">What&apos;s your mood?</h2>
        </div>
        <Link to="/food/user/dining" className="text-xs font-bold text-green-700 dark:text-green-400">
          See all
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-4 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {loading
          ? Array.from({ length: 6 }, (_, i) => <CategorySkeleton key={i} index={i} />)
          : categories.map((category, index) => (
              <Link
                key={category._id || category.id || category.slug}
                to={`/food/user/dining/${category.slug}`}
                className="group shrink-0 md:shrink"
              >
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.04 }}
                  className="relative h-[120px] w-[108px] overflow-hidden rounded-2xl border border-amber-100/90 bg-white shadow-sm transition active:scale-[0.97] sm:w-[124px] md:h-[148px] md:w-full dark:border-white/10 dark:bg-[#1a1a1a]"
                >
                  <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-2.5">
                    <p className="line-clamp-2 text-[11px] font-extrabold leading-tight text-white drop-shadow-sm">
                      {category.name}
                    </p>
                  </div>
                  <div className="h-full w-full bg-amber-50/50 dark:bg-amber-950/10">
                    {category.imageUrl ? (
                      <OptimizedImage
                        src={category.imageUrl}
                        alt={category.name}
                        className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                        objectFit="cover"
                        sizes="124px"
                        priority={index < 4}
                      />
                    ) : (
                      <div className={`h-full w-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/30 dark:to-orange-950/20 ${shimmerClassName}`} />
                    )}
                  </div>
                </motion.div>
              </Link>
            ))}
      </div>
    </section>
  );
}
