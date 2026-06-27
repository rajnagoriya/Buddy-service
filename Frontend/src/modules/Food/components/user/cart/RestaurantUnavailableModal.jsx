import { AlertCircle, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@food/components/ui/button';

export default function RestaurantUnavailableModal({
  open,
  closedRestaurants = [],
  onRemoveClosedItems,
  onContinueReviewing,
}) {
  if (!open || closedRestaurants.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onContinueReviewing}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="restaurant-unavailable-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#141414] dark:border dark:border-gray-800"
      >
        <button
          type="button"
          onClick={onContinueReviewing}
          className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 id="restaurant-unavailable-title" className="text-lg font-bold text-gray-900 dark:text-white">
              Some restaurants are closed
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Items from closed restaurants cannot be ordered right now. Please remove them or continue reviewing your cart.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
          {closedRestaurants.map((restaurant) => (
            <li
              key={restaurant.restaurantId}
              className="text-sm font-semibold text-amber-900 dark:text-amber-200"
            >
              {restaurant.restaurantName || 'Restaurant'}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={onRemoveClosedItems}
            className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white"
          >
            Remove closed restaurant items
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onContinueReviewing}
            className="w-full"
          >
            Continue reviewing cart
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
