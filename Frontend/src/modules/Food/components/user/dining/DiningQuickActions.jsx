import { Link } from "react-router-dom"
import { CalendarDays, Percent, Star, Coffee } from "lucide-react"

const ACTIONS = [
  {
    label: "My bookings",
    icon: CalendarDays,
    to: "/food/user/bookings",
  },
  {
    label: "Offers",
    icon: Percent,
    to: "/food/user/dining/explore/upto50",
  },
  {
    label: "Top rated",
    icon: Star,
    to: "/food/user/dining/explore/near-rated",
  },
  {
    label: "Cafés",
    icon: Coffee,
    to: "/food/user/dining/coffee",
  },
]

export default function DiningQuickActions() {
  return (
    <div className="mb-2 grid grid-cols-4 gap-2 px-4">
      {ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.to}
            to={action.to}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/70 px-2 py-2.5 text-center transition active:scale-[0.97] dark:bg-white/5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm">
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-[11px] font-bold leading-tight text-gray-800 dark:text-gray-200">
              {action.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
