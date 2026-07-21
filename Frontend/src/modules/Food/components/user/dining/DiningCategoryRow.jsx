import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import OptimizedImage from "@food/components/OptimizedImage"
import { shimmerClassName } from "./diningUtils"

function CategorySkeleton({ index }) {
  return (
    <motion.div
      className={`h-[104px] w-[96px] shrink-0 overflow-hidden rounded-2xl bg-white dark:bg-[#1a1a1a] sm:w-[112px] ${shimmerClassName}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    />
  )
}

export default function DiningCategoryRow({ categories = [], loading = false }) {
  if (!loading && categories.length === 0) return null

  return (
    <section className="mt-2">
      <div className="mb-3 px-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
          Explore
        </p>
        <h2 className="text-base font-extrabold text-gray-900 dark:text-white">What&apos;s your mood?</h2>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-4 md:gap-4 md:overflow-visible lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
        {loading
          ? Array.from({ length: 5 }, (_, i) => <CategorySkeleton key={i} index={i} />)
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
                  className="relative h-[104px] w-[96px] overflow-hidden rounded-2xl bg-white shadow-sm transition active:scale-[0.97] sm:w-[112px] md:h-[132px] md:w-full dark:bg-[#1a1a1a]"
                >
                  <div className="h-full w-full bg-amber-50/40 dark:bg-amber-950/10">
                    {category.imageUrl ? (
                      <OptimizedImage
                        src={category.imageUrl}
                        alt={category.name}
                        className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                        objectFit="cover"
                        sizes="112px"
                        priority={index < 4}
                      />
                    ) : (
                      <div
                        className={`h-full w-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/30 dark:to-orange-950/20 ${shimmerClassName}`}
                      />
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-8">
                    <p className="line-clamp-2 text-[11px] font-extrabold leading-tight text-white">
                      {category.name}
                    </p>
                  </div>
                </motion.div>
              </Link>
            ))}
      </div>
    </section>
  )
}
