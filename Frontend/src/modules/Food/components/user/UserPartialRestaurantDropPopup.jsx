import { useEffect, useState } from "react";
import { Button } from "@food/components/ui/button";

/**
 * Global modal when one restaurant is removed from a multi-order (wallet refund).
 * Mounted in UserLayout so it shows on any user screen.
 */
export default function UserPartialRestaurantDropPopup() {
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    const onPartialDrop = (event) => {
      const payload = event?.detail || {};
      setPopup({
        title: payload.title || "Restaurant removed from your order",
        message:
          payload.message ||
          `${payload.restaurantName || "A restaurant"} rejected your order. ₹${Number(payload.refundAmount || 0).toFixed(0)} has been refunded to your wallet. Your order continues with the remaining restaurant(s).`,
        refundAmount: Number(payload.refundAmount) || 0,
        restaurantName: payload.restaurantName || "A restaurant",
      });
    };

    window.addEventListener("orderPartialRestaurantDropped", onPartialDrop);
    return () =>
      window.removeEventListener("orderPartialRestaurantDropped", onPartialDrop);
  }, []);

  if (!popup) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
          {popup.title}
        </h3>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {popup.message}
        </p>
        {popup.refundAmount > 0 && (
          <p className="mt-3 text-sm font-bold text-[#16A34A]">
            ₹{popup.refundAmount.toFixed(0)} credited to wallet
          </p>
        )}
        <Button
          className="w-full mt-6 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-12 rounded-2xl"
          onClick={() => setPopup(null)}
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
