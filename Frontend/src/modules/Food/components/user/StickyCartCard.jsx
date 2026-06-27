import { Link } from "react-router-dom"
import { X, ChevronRight } from "lucide-react"
import { useCart } from "@food/context/CartContext"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function StickyCartCard() {
  const { cart, getCartCount } = useCart()
  const [isVisible, setIsVisible] = useState(true)
  const [bottomPosition, setBottomPosition] = useState("bottom-[70px]") // Fixed above bottom navigation
  const cartCount = getCartCount()

  // Set fixed position above bottom navigation (no scroll-based movement)
  useEffect(() => {
    // Set initial position based on screen size
    const setInitialPosition = () => {
      if (window.innerWidth >= 768) {
        setBottomPosition("bottom-6") // Desktop: fixed position
      } else {
        setBottomPosition("bottom-[70px]") // Mobile: above bottom nav (fixed, doesn't move with scroll)
      }
    }

    setInitialPosition()

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setBottomPosition("bottom-6") // Desktop: always fixed
      } else {
        setBottomPosition("bottom-[70px]") // Mobile: above bottom nav (fixed)
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Get restaurant info from first cart item or use default
  const restaurantName = cart[0]?.restaurant || "Restaurant"
  const restaurantImage = cart[0]?.image || "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200&h=200&fit=crop"

  // Create restaurant slug from restaurant name
  const restaurantSlug = restaurantName.toLowerCase().replace(/\s+/g, "-")

  // Calculate total price
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity * 83), 0)

  // Animation variants for the popout effect
  const cardVariants = {
    initial: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotate: 0,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotate: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.8,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      y: 100,
      rotate: -5,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  }

  // Don't render if cart is empty
  if (cartCount === 0) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-[9999] pointer-events-none"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={cardVariants}
        >
          <div className="max-w-7xl md:max-w-none mx-auto md:mx-0 pointer-events-auto">
            <div className="bg-white dark:bg-[#0a0a0a] dark:text-white rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden w-full md:w-[400px]">
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 md:p-4">
                {/* Restaurant Image */}
                <div className="flex-shrink-0">
                  <img
                    src={restaurantImage}
                    alt={restaurantName}
                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-lg object-cover"
                  />
                </div>

                {/* Restaurant Info */}
                <Link to={`/user/restaurants/${restaurantSlug}`} className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-gray-200 text-xs sm:text-sm md:text-lg mb-0.5 line-clamp-1">
                    {restaurantName}
                  </h3>
                  <div className="flex items-center gap-0.5 text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs md:text-base">
                    <span>View Menu</span>
                    <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-4 md:w-4" />
                  </div>
                </Link>

                {/* View Cart Button */}
                <Link
                  to="/user/cart"
                  className="flex-shrink-0 bg-[#16A34A] dark:bg-[#15803D] hover:bg-[#15803D] dark:hover:bg-[#3c0f3d] text-white px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-5 md:py-3 rounded-lg font-semibold transition-colors"
                >
                  <div className="text-center">
                    <div className="text-[10px] sm:text-xs md:text-sm opacity-90 leading-tight">View Cart</div>
                    <div className="text-[10px] sm:text-xs md:text-sm font-bold leading-tight">{cartCount} {cartCount === 1 ? 'item' : 'items'}</div>
                  </div>
                </Link>

                {/* Close Button */}
                <motion.button
                  onClick={() => setIsVisible(false)}
                  className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}


