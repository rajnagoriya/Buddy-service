import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react"
import { buildCartLineId } from "@food/utils/foodVariants"
import { adminAPI, userAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { buildRestaurantMetaFromCart } from "@food/hooks/useCartRestaurantValidation"

import {
  getLastRestaurantFromCart,
  validateChainRestaurantRadius,
  CHAIN_RADIUS_VALIDATION_MESSAGE,
} from "@food/utils/restaurantRadius"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Default cart context value to prevent errors during initial render
const defaultCartContext = {
  _isProvider: false, // Flag to identify if this is from the actual provider
  cart: [],
  items: [],
  itemCount: 0,
  total: 0,
  lastAddEvent: null,
  lastRemoveEvent: null,
  addToCart: () => {
    debugWarn('CartProvider not available - addToCart called');
  },
  removeFromCart: () => {
    debugWarn('CartProvider not available - removeFromCart called');
  },
  updateQuantity: () => {
    debugWarn('CartProvider not available - updateQuantity called');
  },
  getCartCount: () => 0,
  isInCart: () => false,
  getCartItem: () => null,
  clearCart: () => {
    debugWarn('CartProvider not available - clearCart called');
  },
  cleanCartForRestaurant: () => {
    debugWarn('CartProvider not available - cleanCartForRestaurant called');
  },
  replaceCart: () => {
    debugWarn('CartProvider not available - replaceCart called');
  },
  restaurantMeta: [],
  setRestaurantMeta: () => {
    debugWarn('CartProvider not available - setRestaurantMeta called');
  },
  removeItemsByRestaurantIds: () => {
    debugWarn('CartProvider not available - removeItemsByRestaurantIds called');
  },
  updateCartItem: () => {
    debugWarn('CartProvider not available - updateCartItem called');
  },
  flushCartSave: () => {
    debugWarn('CartProvider not available - flushCartSave called');
  },
  cartSyncStatus: 'idle',
}

const CartContext = createContext(defaultCartContext)

const normalizeCartData = (rawCart) => {
  if (!Array.isArray(rawCart)) return []

  return rawCart
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const parsedQuantity = Number(item.quantity)
      const parsedPrice = Number(item.price)
      const normalizedRestaurantName =
        typeof item.restaurant === "string"
          ? item.restaurant
          : typeof item.restaurant?.name === "string"
            ? item.restaurant.name
            : ""

      const normalizedRestaurantId =
        item.restaurantId ||
        item.restaurant_id ||
        item.restaurant?._id ||
        item.restaurant?.restaurantId ||
        null

      const normalizedImage =
        item.image ||
        item.imageUrl ||
        item.product?.imageUrl ||
        item.product?.image ||
        ""

      const baseItemId =
        item.itemId ||
        item.productId ||
        item.foodId ||
        item.baseItemId ||
        item.menuItemId ||
        item.id ||
        item._id ||
        `cart-item-${index}`

      const variantId = item.variantId || item.variant?._id || item.variant?.id || ""
      const variantName =
        typeof item.variantName === "string"
          ? item.variantName
          : typeof item.variant?.name === "string"
            ? item.variant.name
            : ""
      const parsedVariantPrice = Number(
        item.variantPrice ?? item.variant?.price ?? item.price,
      )
      const lineItemId =
        item.lineItemId ||
        item.cartLineId ||
        buildCartLineId(baseItemId, variantId)

      return {
        ...item,
        id: lineItemId,
        lineItemId,
        itemId: String(baseItemId),
        productId: String(baseItemId),
        variantId: variantId ? String(variantId) : "",
        variantName,
        variantPrice: Number.isFinite(parsedVariantPrice) ? parsedVariantPrice : 0,
        name: item.name || item.product?.name || "Item",
        quantity:
          Number.isFinite(parsedQuantity) && parsedQuantity > 0
            ? Math.floor(parsedQuantity)
            : 1,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        restaurant: normalizedRestaurantName,
        restaurantId: normalizedRestaurantId,
        image: normalizedImage,
        imageUrl: normalizedImage,
      }
    })
}

const resolveCartEntryId = (items, itemId, variantId = "") => {
  const normalizedItemId = String(itemId || "")
  const safeItems = Array.isArray(items) ? items : []

  const directMatch = safeItems.find((item) => item.id === normalizedItemId)
  if (directMatch) return directMatch.id

  const preferredId = buildCartLineId(normalizedItemId, variantId)

  const exactMatch = safeItems.find((item) => item.id === preferredId)
  if (exactMatch) return exactMatch.id

  if (!variantId) {
    const legacyBaseMatch = safeItems.find(
      (item) =>
        String(item.itemId || item.productId || item.id || "") === normalizedItemId &&
        !String(item.variantId || "").trim(),
    )
    if (legacyBaseMatch) return legacyBaseMatch.id
  }

  return preferredId
}

const CART_SAVE_DEBOUNCE_MS = 2500

const isFoodUserAuthenticated = () => {
  if (typeof window === "undefined") return false
  return (
    localStorage.getItem("user_authenticated") === "true" ||
    !!localStorage.getItem("user_accessToken")
  )
}

const loadRestaurantMetaFromStorage = () => {
  if (typeof window === "undefined") return []
  try {
    const saved = localStorage.getItem("cartRestaurantMeta")
    const parsed = saved ? JSON.parse(saved) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  // Safe init (works with SSR and bad JSON)
  const [cart, setCart] = useState(() => {
    if (typeof window === "undefined") return []
    try {
      const saved = localStorage.getItem("cart")
      const parsed = saved ? JSON.parse(saved) : []
      return normalizeCartData(parsed)
    } catch {
      return []
    }
  })

  const [restaurantMeta, setRestaurantMeta] = useState(loadRestaurantMetaFromStorage)
  const [cartSyncStatus, setCartSyncStatus] = useState("idle")

  const saveDebounceRef = useRef(null)
  const saveInFlightRef = useRef(null)
  const saveQueuedRef = useRef(false)
  const skipServerSyncRef = useRef(false)
  const hasRestoredFromServerRef = useRef(false)
  const cartRef = useRef(cart)
  const restaurantMetaRef = useRef(restaurantMeta)

  useEffect(() => {
    cartRef.current = cart
  }, [cart])

  useEffect(() => {
    restaurantMetaRef.current = restaurantMeta
  }, [restaurantMeta])

  useEffect(() => {
    setRestaurantMeta((prev) => buildRestaurantMetaFromCart(cart, prev))
  }, [cart])

  const buildCartPayload = useCallback(() => {
    const items = normalizeCartData(cartRef.current)
    const meta = buildRestaurantMetaFromCart(items, restaurantMetaRef.current)
    return { items, restaurantMeta: meta }
  }, [])

  const flushCartSave = useCallback(async () => {
    if (typeof window === "undefined") return
    if (!isFoodUserAuthenticated() || skipServerSyncRef.current) return

    if (saveInFlightRef.current) {
      saveQueuedRef.current = true
      return saveInFlightRef.current
    }

    const payload = buildCartPayload()
    setCartSyncStatus("syncing")

    const request = userAPI
      .syncCart(payload)
      .then(() => {
        setCartSyncStatus("idle")
      })
      .catch((err) => {
        debugError("Failed to sync cart:", err)
        setCartSyncStatus("error")
      })
      .finally(() => {
        saveInFlightRef.current = null
        if (saveQueuedRef.current) {
          saveQueuedRef.current = false
          flushCartSave()
        }
      })

    saveInFlightRef.current = request
    return request
  }, [buildCartPayload])

  const scheduleCartSave = useCallback(() => {
    if (!isFoodUserAuthenticated() || skipServerSyncRef.current) return
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      saveDebounceRef.current = null
      flushCartSave()
    }, CART_SAVE_DEBOUNCE_MS)
  }, [flushCartSave])

  const flushCartSaveKeepalive = useCallback(() => {
    if (!isFoodUserAuthenticated() || skipServerSyncRef.current) return
    const token = localStorage.getItem("user_accessToken")
    if (!token) return

    const baseURL =
      API_BASE_URL ||
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
        ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "")
        : "/api/v1")

    const payload = buildCartPayload()
    try {
      fetch(`${baseURL}/food/user/cart`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // ignore
    }
  }, [buildCartPayload])

  const restoreCartFromServer = useCallback(async () => {
    if (!isFoodUserAuthenticated()) return
    skipServerSyncRef.current = true
    try {
      const res = await userAPI.getCart()
      const data = res?.data?.data
      const serverItems = Array.isArray(data?.items) ? normalizeCartData(data.items) : []
      const serverMeta = Array.isArray(data?.restaurantMeta) ? data.restaurantMeta : []
      const localItems = normalizeCartData(cartRef.current)

      if (serverItems.length > 0) {
        setCart(serverItems)
      } else if (localItems.length > 0) {
        scheduleCartSave()
      }

      if (serverMeta.length > 0) {
        setRestaurantMeta(serverMeta)
      }
    } catch (err) {
      debugError("Failed to restore cart from server:", err)
    } finally {
      skipServerSyncRef.current = false
      hasRestoredFromServerRef.current = true
    }
  }, [scheduleCartSave])

  useEffect(() => {
    if (!isFoodUserAuthenticated()) return
    if (hasRestoredFromServerRef.current) return
    restoreCartFromServer()
  }, [])

  useEffect(() => {
    const handleAuthRefresh = () => {
      if (!isFoodUserAuthenticated()) return
      hasRestoredFromServerRef.current = false
      restoreCartFromServer()
    }

    const handleStorage = (event) => {
      if (event.key === "user_accessToken" || event.key === "user_authenticated") {
        handleAuthRefresh()
      }
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener("userAuthChanged", handleAuthRefresh)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("userAuthChanged", handleAuthRefresh)
    }
  }, [restoreCartFromServer])

  useEffect(() => {
    scheduleCartSave()
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    }
  }, [cart, restaurantMeta, scheduleCartSave])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (saveDebounceRef.current) {
          clearTimeout(saveDebounceRef.current)
          saveDebounceRef.current = null
        }
        flushCartSave()
      }
    }

    const handleBeforeUnload = () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current)
        saveDebounceRef.current = null
      }
      flushCartSaveKeepalive()
    }

    window.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [flushCartSave, flushCartSaveKeepalive])

  // Track last add event for animation
  const [lastAddEvent, setLastAddEvent] = useState(null)
  // Track last remove event for animation
  const [lastRemoveEvent, setLastRemoveEvent] = useState(null)
  const [adminSettings, setAdminSettings] = useState(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await adminAPI.getDeliveryBoySettings()
        if (res.data?.success) setAdminSettings(res.data.data)
      } catch (err) {
        debugError('Failed to fetch admin settings for multi-order:', err)
      }
    }
    fetchSettings()
  }, [])

  // Persist to localStorage whenever cart changes
  useEffect(() => {
    try {
      const isAuthenticated = isFoodUserAuthenticated()
      if (cart.length > 0 || isAuthenticated) {
        localStorage.setItem("cart", JSON.stringify(normalizeCartData(cart)))
      }
      localStorage.setItem("cartRestaurantMeta", JSON.stringify(restaurantMeta))
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [cart, restaurantMeta])

  const addToCart = (item, sourcePosition = null) => {
    const safeCart = normalizeCartData(cart)
    const newItemRestaurantId = String(item?.restaurantId || '')
    const newItemRestaurantName = item?.restaurant || ''

    if (safeCart.length > 0) {
      const uniqueRestaurants = []
      const restaurantMap = new Map()

      safeCart.forEach(i => {
        const rid = String(i.restaurantId || '')
        if (rid && !restaurantMap.has(rid)) {
          restaurantMap.set(rid, {
            id: rid,
            name: i.restaurant,
            lat: i.latitude,
            lng: i.longitude
          })
          uniqueRestaurants.push(restaurantMap.get(rid))
        }
      })

      const isNewRestaurant = !restaurantMap.has(newItemRestaurantId)

      if (isNewRestaurant) {
        // Feature Check
        if (adminSettings && !adminSettings.multiOrderEnabled) {
          const message = `Cart already contains items from "${uniqueRestaurants[0]?.name || 'another restaurant'}". Please clear cart to order from here.`
          return { ok: false, error: message, code: 'MULTI_ORDER_DISABLED' }
        }

        const lastRestaurant = getLastRestaurantFromCart(safeCart)
        const chainCheck = validateChainRestaurantRadius(
          {
            latitude: lastRestaurant?.lat,
            longitude: lastRestaurant?.lng,
            restaurantId: lastRestaurant?.restaurantId,
          },
          {
            latitude: item?.latitude,
            longitude: item?.longitude,
            restaurantId: newItemRestaurantId,
          },
        )

        if (!chainCheck.skipped && !chainCheck.valid) {
          return {
            ok: false,
            error: CHAIN_RADIUS_VALIDATION_MESSAGE,
            code: 'RESTAURANT_CHAIN_RADIUS',
            distanceKm: chainCheck.distanceKm,
            lastRestaurantId: lastRestaurant?.restaurantId,
            newRestaurantId: newItemRestaurantId,
          }
        }
      }
    }

    if (!item?.restaurantId && !item?.restaurant) {
      return {
        ok: false,
        error: 'Item is missing restaurant information. Please refresh the page.',
        code: 'MISSING_RESTAURANT'
      }
    }

    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      const existing = safePrev.find((i) => i.id === item.id)
      if (existing) {
        // Set last add event for animation when incrementing existing item
        if (sourcePosition) {
          setLastAddEvent({
            product: {
              id: item.id,
              name: item.name,
              imageUrl: item.image || item.imageUrl,
            },
            sourcePosition,
          })
          // Clear after animation completes (increased delay)
          setTimeout(() => setLastAddEvent(null), 1500)
        }
        return safePrev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      
      // Validate item has required restaurant info
      if (!item.restaurantId && !item.restaurant) {
        debugError('❌ Cannot add item: Missing restaurant information!', item);
        return safePrev;
      }
      
      const newItem = { ...item, quantity: 1 }
      
      // Set last add event for animation if sourcePosition is provided
      if (sourcePosition) {
        setLastAddEvent({
          product: {
            id: item.id,
            name: item.name,
            imageUrl: item.image || item.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes (increased delay to allow full animation)
        setTimeout(() => setLastAddEvent(null), 1500)
      }
      
      return [...safePrev, newItem]
    })

    return { ok: true }
  }

  const removeFromCart = (itemId, sourcePosition = null, productInfo = null) => {
    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      const resolvedItemId = resolveCartEntryId(safePrev, itemId)
      const itemToRemove = safePrev.find((i) => i.id === resolvedItemId)
      if (itemToRemove && sourcePosition && productInfo) {
        // Set last remove event for animation
        setLastRemoveEvent({
          product: {
            id: productInfo.id || itemToRemove.id,
            name: productInfo.name || itemToRemove.name,
            imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes
        setTimeout(() => setLastRemoveEvent(null), 1500)
      }
      return safePrev.filter((i) => i.id !== resolvedItemId)
    })
  }

  const updateQuantity = (itemId, quantity, sourcePosition = null, productInfo = null) => {
    const safeCart = normalizeCartData(cart)
    const resolvedItemId = resolveCartEntryId(safeCart, itemId)
    if (quantity <= 0) {
      setCart((prev) => {
        const safePrev = normalizeCartData(prev)
        const itemToRemove = safePrev.find((i) => i.id === resolvedItemId)
        if (itemToRemove && sourcePosition && productInfo) {
          // Set last remove event for animation
          setLastRemoveEvent({
            product: {
              id: productInfo.id || itemToRemove.id,
              name: productInfo.name || itemToRemove.name,
              imageUrl: productInfo.imageUrl || productInfo.image || itemToRemove.image || itemToRemove.imageUrl,
            },
            sourcePosition,
          })
          // Clear after animation completes
          setTimeout(() => setLastRemoveEvent(null), 1500)
        }
        return safePrev.filter((i) => i.id !== resolvedItemId)
      })
      return
    }
    
    // When quantity decreases (but not to 0), also trigger removal animation
    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      const existingItem = safePrev.find((i) => i.id === resolvedItemId)
      if (existingItem && quantity < existingItem.quantity && sourcePosition && productInfo) {
        // Set last remove event for animation when decreasing quantity
        setLastRemoveEvent({
          product: {
            id: productInfo.id || existingItem.id,
            name: productInfo.name || existingItem.name,
            imageUrl: productInfo.imageUrl || productInfo.image || existingItem.image || existingItem.imageUrl,
          },
          sourcePosition,
        })
        // Clear after animation completes
        setTimeout(() => setLastRemoveEvent(null), 1500)
      }
      return safePrev.map((i) => (i.id === resolvedItemId ? { ...i, quantity } : i))
    })
  }

  const getCartCount = () =>
    normalizeCartData(cart).reduce((total, item) => total + (item.quantity || 0), 0)

  const isInCart = (itemId, variantId = "") => {
    const safeCart = normalizeCartData(cart)
    const resolvedItemId = resolveCartEntryId(safeCart, itemId, variantId)
    return safeCart.some((i) => i.id === resolvedItemId)
  }

  const getCartItem = (itemId, variantId = "") => {
    const safeCart = normalizeCartData(cart)
    const resolvedItemId = resolveCartEntryId(safeCart, itemId, variantId)
    return safeCart.find((i) => i.id === resolvedItemId) || null
  }

  const clearCart = () => setCart([])

  const removeItemsByRestaurantIds = (restaurantIds = []) => {
    const idSet = new Set((Array.isArray(restaurantIds) ? restaurantIds : []).map(String))
    if (idSet.size === 0) return
    setCart((prev) =>
      normalizeCartData(prev).filter((item) => !idSet.has(String(item.restaurantId || ""))),
    )
    setRestaurantMeta((prev) =>
      (Array.isArray(prev) ? prev : []).filter((entry) => !idSet.has(String(entry.restaurantId || ""))),
    )
  }

  const updateCartItem = (itemId, updates = {}) => {
    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      const resolvedItemId = resolveCartEntryId(safePrev, itemId, updates.variantId || "")
      return safePrev.map((item) => {
        if (item.id !== resolvedItemId) return item
        const nextVariantId = updates.variantId ?? item.variantId
        const nextLineId = buildCartLineId(item.itemId || item.productId || item.id, nextVariantId)
        return normalizeCartData([
          {
            ...item,
            ...updates,
            id: nextLineId,
            lineItemId: nextLineId,
            variantId: nextVariantId,
          },
        ])[0]
      })
    })
  }

  const replaceCart = (items) => {
    const normalizedItems = normalizeCartData(items).filter((item) => {
      const quantity = Number(item?.quantity)
      return item?.id && (item?.restaurantId || item?.restaurant) && Number.isFinite(quantity) && quantity > 0
    })

    setCart(normalizedItems)
    return { ok: true, count: normalizedItems.length }
  }

  // Clean cart to remove items from different restaurants
  // Keeps only items from the specified restaurant
  const cleanCartForRestaurant = (restaurantId, restaurantName) => {
    setCart((prev) => {
      const safePrev = normalizeCartData(prev)
      if (safePrev.length === 0) return safePrev;
      
      // Normalize restaurant name for comparison
      const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
      const targetRestaurantNameNormalized = normalizeName(restaurantName);
      
      // Filter cart to keep only items from the target restaurant
      const cleanedCart = safePrev.filter((item) => {
        const itemRestaurantId = item?.restaurantId;
        const itemRestaurantName = item?.restaurant;
        const itemRestaurantNameNormalized = normalizeName(itemRestaurantName);
        
        // Check by restaurant name first (more reliable)
        if (targetRestaurantNameNormalized && itemRestaurantNameNormalized) {
          return itemRestaurantNameNormalized === targetRestaurantNameNormalized;
        }
        // Fallback to ID comparison
        if (restaurantId && itemRestaurantId) {
          return itemRestaurantId === restaurantId || 
                 itemRestaurantId === restaurantId.toString() ||
                 itemRestaurantId.toString() === restaurantId;
        }
        // If no match, remove item
        return false;
      });
      
      if (cleanedCart.length !== safePrev.length) {
        debugWarn('🧹 Cleaned cart: Removed items from different restaurants', {
          before: safePrev.length,
          after: cleanedCart.length,
          removed: safePrev.length - cleanedCart.length
        });
      }
      
      return cleanedCart;
    });
  }

  // Removed restrictive multi-restaurant cleanup logic to support multi-order feature
  useEffect(() => {
    const safeCart = normalizeCartData(cart)
    if (safeCart.length !== cart.length) {
      setCart(safeCart)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount for normalization

  // Transform cart to match AddToCartAnimation expected structure
  const cartForAnimation = useMemo(() => {
    const safeCart = normalizeCartData(cart)
    const items = safeCart.map(item => ({
      product: {
        id: item.id,
        name: item.name,
        imageUrl: item.image || item.imageUrl,
      },
      quantity: item.quantity || 1,
    }))
    
    const itemCount = safeCart.reduce((total, item) => total + (item.quantity || 0), 0)
    const total = safeCart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0)
    
    return {
      items,
      itemCount,
      total,
    }
  }, [cart])

  const value = useMemo(
    () => ({
      _isProvider: true, // Flag to identify this is from the actual provider
      // Keep original cart array for backward compatibility
      cart,
      // Add animation-compatible structure
      items: cartForAnimation.items,
      itemCount: cartForAnimation.itemCount,
      total: cartForAnimation.total,
      lastAddEvent,
      lastRemoveEvent,
      addToCart,
      removeFromCart,
      updateQuantity,
      getCartCount,
      isInCart,
      getCartItem,
      clearCart,
      cleanCartForRestaurant,
      replaceCart,
      restaurantMeta,
      setRestaurantMeta,
      removeItemsByRestaurantIds,
      updateCartItem,
      flushCartSave,
      cartSyncStatus,
    }),
    [cart, cartForAnimation, lastAddEvent, lastRemoveEvent, restaurantMeta, cartSyncStatus]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  // Check if context is from the actual provider by checking the _isProvider flag
  if (!context || context._isProvider !== true) {
    // In development, log a warning but don't throw to prevent crashes
    if (process.env.NODE_ENV === 'development') {
      debugWarn('⚠️ useCart called outside CartProvider. Using default values.');
      debugWarn('💡 Make sure the component is rendered inside UserLayout which provides CartProvider.');
    }
    // Return default context instead of throwing
    return defaultCartContext
  }
  return context
}


