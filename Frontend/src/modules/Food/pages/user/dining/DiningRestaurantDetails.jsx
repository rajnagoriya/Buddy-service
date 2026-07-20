import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { restaurantAPI } from "@food/api"
import { useProfile } from "@food/context/ProfileContext"
import { getMenuFromResponse } from "@food/utils/menuItems"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { Ticket } from "lucide-react"
import { toast } from "sonner"
import DiningDetailHero from "@food/components/user/dining/details/DiningDetailHero"
import DiningDetailTabs from "@food/components/user/dining/details/DiningDetailTabs"
import DiningOfferSection from "@food/components/user/dining/details/DiningOfferSection"
import DiningMenuSections from "@food/components/user/dining/details/DiningMenuSections"
import DiningPhotoGrid from "@food/components/user/dining/details/DiningPhotoGrid"
import DiningAboutPanel from "@food/components/user/dining/details/DiningAboutPanel"
import DiningBookingSheet from "@food/components/user/dining/details/DiningBookingSheet"
import DiningDetailSkeleton from "@food/components/user/dining/details/DiningDetailSkeleton"

const debugError = (...args) => {}

const formatAddress = (restaurant) =>
  restaurant?.location?.formattedAddress ||
  restaurant?.location?.addressLine1 ||
  restaurant?.location?.address ||
  [restaurant?.location?.area || restaurant?.area, restaurant?.location?.city || restaurant?.city]
    .filter(Boolean)
    .join(", ")

const buildImageList = (restaurant) => {
  const candidates = [
    restaurant?.coverImage?.url,
    restaurant?.coverImage,
    ...(Array.isArray(restaurant?.coverImages) ? restaurant.coverImages.map((image) => image?.url || image) : []),
    ...(Array.isArray(restaurant?.menuImages) ? restaurant.menuImages.map((image) => image?.url || image) : []),
    restaurant?.profileImage?.url,
    restaurant?.profileImage,
  ]
  return candidates
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
}

const buildFacilities = (restaurant) => {
  const facilities = []
  if (restaurant?.diningSettings?.tableBookingEnabled !== false) facilities.push("Table booking")
  if (restaurant?.isAcceptingOrders !== false) facilities.push("Lunch & dinner")
  if (restaurant?.diningSettings?.homeDeliveryAvailable || restaurant?.homeDeliveryAvailable) facilities.push("Home delivery")
  if (restaurant?.diningSettings?.takeawayAvailable || restaurant?.takeawayAvailable) facilities.push("Takeaway")
  if (restaurant?.diningSettings?.vegOnly || restaurant?.vegOnly) facilities.push("Vegetarian only")
  if (restaurant?.diningSettings?.lessNoisy || restaurant?.ambience === "quiet") facilities.push("Quiet ambience")
  return facilities.length > 0 ? facilities : ["Table booking", "Lunch & dinner", "Takeaway", "Family friendly"]
}

const formatTimeLabel = (value) => {
  if (!value) return null
  if (/[ap]m/i.test(value)) return value.toUpperCase()
  const date = new Date(`2000-01-01T${String(value).padStart(5, "0")}`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
}

const scrollToSection = (id) => {
  const element = document.getElementById(id)
  if (element) element.scrollIntoView({ behavior: "smooth", block: "start" })
}

const normalizeMenuSections = (sections) => {
  if (!Array.isArray(sections)) return []
  return [...sections]
    .map((section, index) => ({
      ...section,
      id: String(section.id || section._id || section.categoryId || `section-${index}`),
      categoryId: String(section.categoryId || section.id || section._id || `section-${index}`),
      name: section.name || section.title || "Category",
      itemCount: Number(section.itemCount) || (Array.isArray(section.items) ? section.items.length : 0),
      sortOrder: Number(section.sortOrder) || 0,
      items: Array.isArray(section.items) ? section.items : [],
      subsections: Array.isArray(section.subsections) ? section.subsections : [],
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export default function DiningRestaurantDetails() {
  const { diningType, slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const { addFavorite, removeFavorite, isFavorite } = useProfile()

  const [restaurant, setRestaurant] = useState(location.state?.restaurant || null)
  const [menuSections, setMenuSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedGuests, setSelectedGuests] = useState(2)
  const [isBookingSheetOpen, setIsBookingSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("offers")
  const [expandedMenuSections, setExpandedMenuSections] = useState(new Set([0]))

  const fetchRestaurantData = async () => {
    try {
      setLoading(true)
      setError(null)

      const routeRestaurant = location.state?.restaurant || null
      const preferredRestaurantLookup =
        routeRestaurant?._id ||
        routeRestaurant?.restaurantId ||
        routeRestaurant?.id ||
        decodeURIComponent(slug || "")

      const restaurantResponse = await restaurantAPI.getRestaurantById(preferredRestaurantLookup)
      if (!restaurantResponse?.data?.success) {
        setError("Restaurant not found")
        setRestaurant(null)
        return
      }

      const resolvedRestaurant =
        restaurantResponse?.data?.data?.restaurant || restaurantResponse?.data?.data || null

      if (!resolvedRestaurant) {
        setError("Restaurant not found")
        setRestaurant(null)
        return
      }

      setRestaurant(resolvedRestaurant)

      const restaurantId = resolvedRestaurant?._id || resolvedRestaurant?.id || slug

      const menuResponse = await restaurantAPI.getMenuByRestaurantId(restaurantId).catch(() => null)
      const resolvedMenu = menuResponse ? getMenuFromResponse(menuResponse) : null
      const sections = normalizeMenuSections(resolvedMenu?.sections)
      setMenuSections(sections)
      setExpandedMenuSections(new Set(sections.map((_, index) => index)))
    } catch {
      setError("Failed to load restaurant")
      setRestaurant(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRestaurantData()
  }, [location.state?.restaurant, slug])

  const occupiedSeats = 0
  const maxCapacity = restaurant?.diningSettings?.maxGuests || 6
  const remainingSeats = maxCapacity

  if (loading) return <DiningDetailSkeleton />

  if (error || !restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAFAFA] px-4 text-center dark:bg-[#0a0a0a]">
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Restaurant not found</h2>
        <Button onClick={goBack} variant="outline">
          Go Back
        </Button>
      </div>
    )
  }

  const restaurantName = restaurant.name || restaurant.restaurantName || "Restaurant"
  const address = formatAddress(restaurant) || "Address unavailable"
  const imageGallery = buildImageList(restaurant)
  const heroImage = imageGallery[0] || ""
  const cuisines =
    Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
      ? restaurant.cuisines.join(", ")
      : restaurant?.cuisine || "Multi-cuisine"
  const costForTwo = restaurant?.costForTwo ? `\u20B9${restaurant.costForTwo} for two` : "\u20B91500 for two"
  const facilities = buildFacilities(restaurant)
  const rating = Number(restaurant?.rating || restaurant?.avgRating || 0).toFixed(1)
  const reviewCount = restaurant?.totalRatings || restaurant?.reviewCount || restaurant?.reviewsCount || 0
  const openingTime = formatTimeLabel(restaurant?.openingTime || restaurant?.diningSettings?.openingTime || "12:00")
  const closingTime = formatTimeLabel(restaurant?.closingTime || restaurant?.diningSettings?.closingTime || "23:00")
  const isDiningEnabled = restaurant?.diningSettings?.isEnabled !== false

  const restaurantFavoriteSlug = restaurant?.restaurantNameNormalized || restaurant?.slug || slug
  const favorite = isFavorite(restaurantFavoriteSlug)

  const handleShare = async () => {
    const shareData = {
      title: restaurantName,
      text: `Check out ${restaurantName} for dining!`,
      url: window.location.href,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied to clipboard!")
    } catch (err) {
      if (err.name !== "AbortError") toast.error("Sharing failed. Please try again.")
    }
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      goBack()
      return
    }
    if (diningType) {
      navigate(`/food/user/dining/${diningType}`)
      return
    }
    navigate("/food/user/dining")
  }

  const handleToggleFavorite = () => {
    if (favorite) {
      removeFavorite(restaurantFavoriteSlug)
      return
    }
    addFavorite({
      slug: restaurantFavoriteSlug,
      name: restaurantName,
      cuisine: cuisines,
      rating,
      image: heroImage,
    })
  }

  const openBooking = () => {
    if (!isDiningEnabled) return
    setIsBookingSheetOpen(true)
  }

  const handleContinueBooking = () => {
    if (!isDiningEnabled) return
    setIsBookingSheetOpen(false)
    navigate(`/food/user/dining/book/${slug}`, {
      state: { guestCount: selectedGuests, restaurant },
    })
  }

  const handleTabChange = (tabId, targetId) => {
    setActiveTab(tabId)
    scrollToSection(targetId)
  }

  const toggleMenuSection = (index) => {
    setExpandedMenuSections((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <AnimatedPage className="min-h-screen bg-[#FAFAFA] dark:bg-[#0a0a0a] pb-28">
      <div className="mx-auto max-w-2xl">
        <DiningDetailHero
          restaurantName={restaurantName}
          address={address}
          costForTwo={costForTwo}
          cuisines={cuisines}
          openingTime={openingTime}
          closingTime={closingTime}
          rating={rating}
          reviewCount={reviewCount}
          heroImage={heroImage}
          favorite={favorite}
          onBack={handleBack}
          onShare={handleShare}
          onToggleFavorite={handleToggleFavorite}
        />

        <div className="px-4 mt-4">
          <button
            type="button"
            onClick={openBooking}
            disabled={!isDiningEnabled}
            className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border text-[15px] font-bold shadow-sm transition-all ${
              isDiningEnabled
                ? "border-green-200 dark:border-green-900/40 bg-white dark:bg-[#141414] text-[#16A34A] hover:bg-green-50/50 dark:hover:bg-green-950/20"
                : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 opacity-80"
            }`}
          >
            <Ticket className="h-4 w-4" />
            {isDiningEnabled ? "Book a table" : "Dining paused"}
          </button>

          {!isDiningEnabled && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Dining bookings are currently turned off by the restaurant.
            </div>
          )}
        </div>

        <DiningDetailTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="px-4 py-5 space-y-8">
          <DiningOfferSection isDiningEnabled={isDiningEnabled} onBookClick={openBooking} />

          <div id="dining-menu" className="scroll-mt-28">
            <DiningMenuSections
              menuSections={menuSections}
              expandedSections={expandedMenuSections}
              onToggleSection={toggleMenuSection}
            />
          </div>

          <DiningPhotoGrid images={imageGallery} restaurantName={restaurantName} />

          <DiningAboutPanel
            costForTwo={costForTwo}
            cuisines={cuisines}
            address={address}
            facilities={facilities}
            heroImage={heroImage}
            restaurantName={restaurantName}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-[#0a0a0a]/95 p-4 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          <Button
            onClick={openBooking}
            disabled={!isDiningEnabled}
            className={`h-12 w-full rounded-2xl text-base font-bold ${
              isDiningEnabled
                ? "bg-[#16A34A] hover:bg-[#15803D] text-white shadow-lg shadow-green-600/20"
                : "cursor-not-allowed bg-gray-100 text-gray-400"
            }`}
          >
            {isDiningEnabled ? "Book a table" : "Dining paused"}
          </Button>
        </div>
      </div>

      <DiningBookingSheet
        open={isBookingSheetOpen}
        onClose={() => setIsBookingSheetOpen(false)}
        maxCapacity={maxCapacity}
        occupiedSeats={occupiedSeats}
        remainingSeats={remainingSeats}
        selectedGuests={selectedGuests}
        onSelectGuests={setSelectedGuests}
        onContinue={handleContinueBooking}
      />
    </AnimatedPage>
  )
}
