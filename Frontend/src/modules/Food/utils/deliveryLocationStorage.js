/**
 * Persist delivery location / mode and notify listeners (Home, cart, header).
 */

export function setDeliveryAddressMode(mode) {
  const next = mode === "current" ? "current" : "saved"
  try {
    localStorage.setItem("deliveryAddressMode", next)
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent("deliveryAddressModeUpdated"))
  } catch {
    // ignore
  }
}

export function setUserLocationStorage(locationData) {
  if (!locationData || typeof locationData !== "object") return
  try {
    localStorage.setItem("userLocation", JSON.stringify(locationData))
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(
      new CustomEvent("userLocationUpdated", { detail: { location: locationData } }),
    )
  } catch {
    // ignore
  }
}
