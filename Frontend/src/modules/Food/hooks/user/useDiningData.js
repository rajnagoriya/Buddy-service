import { useState, useCallback, useEffect } from "react"
import { diningAPI } from "@food/api"

export const useDiningData = (location) => {
  const [categories, setCategories] = useState([])
  const [limelightItems] = useState([])
  const [mustTryItems] = useState([])
  const [restaurantList, setRestaurantList] = useState([])
  const [bankOfferItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [diningHeroBanner, setDiningHeroBanner] = useState(null)
  const [pagination, setPagination] = useState(null)

  const fetchDiningData = useCallback(async () => {
    try {
      setLoading(true)
      const params = { page: 1, limit: 12 }
      if (location?.city) params.city = location.city
      if (Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude))) {
        params.lat = Math.round(Number(location.latitude) * 1000) / 1000
        params.lng = Math.round(Number(location.longitude) * 1000) / 1000
      }

      const response = await diningAPI.getHome(params)
      const payload = response?.data?.success ? response.data.data || {} : {}

      setCategories(Array.isArray(payload.categories) ? payload.categories : [])
      setRestaurantList(Array.isArray(payload.restaurants) ? payload.restaurants : [])
      setPagination(payload.pagination || null)

      const firstBanner = Array.isArray(payload.banners) ? payload.banners[0] : null
      setDiningHeroBanner(firstBanner?.imageUrl || null)
    } finally {
      setLoading(false)
    }
  }, [location?.city, location?.latitude, location?.longitude])

  useEffect(() => {
    fetchDiningData()
  }, [fetchDiningData])

  return {
    categories,
    limelightItems,
    mustTryItems,
    restaurantList,
    bankOfferItems,
    loading,
    diningHeroBanner,
    pagination,
  }
}
