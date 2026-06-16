import { Link } from "react-router-dom";
import { CalendarDays, Percent, Star, Coffee } from "lucide-react";

const ACTIONS = [
  {
    label: "My bookings",
    sub: "Upcoming tables",
    icon: CalendarDays,
    to: "/food/user/bookings",
    className: "from-amber-500/15 to-orange-500/5 border-amber-200/60 text-amber-800 dark:text-amber-300",
    iconBg: "bg-amber-500 text-white",
  },
  {
    label: "Up to 50% off",
    sub: "Dining deals",
    icon: Percent,
    to: "/food/user/dining/explore/upto50",
    className: "from-rose-500/10 to-pink-500/5 border-rose-200/60 text-rose-800 dark:text-rose-300",
    iconBg: "bg-rose-500 text-white",
  },
  {
    label: "Top rated",
    sub: "Near you",
    icon: Star,
    to: "/food/user/dining/explore/near-rated",
    className: "from-green-500/10 to-emerald-500/5 border-green-200/60 text-green-800 dark:text-green-300",
    iconBg: "bg-green-600 text-white",
  },
  {
    label: "Cafés",
    sub: "Coffee & more",
    icon: Coffee,
    to: "/food/user/dining/coffee",
    className: "from-stone-500/10 to-stone-500/5 border-stone-200/60 text-stone-800 dark:text-stone-300",
    iconBg: "bg-stone-700 text-white",
  },
];

export default function DiningQuickActions() {
  return (
    <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.to}
            to={action.to}
            className={`flex min-w-[8.5rem] shrink-0 flex-col gap-2 rounded-2xl border bg-gradient-to-br p-3 transition active:scale-[0.97] dark:border-white/10 ${action.className}`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${action.iconBg}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-extrabold leading-tight">{action.label}</p>
              <p className="text-[10px] font-semibold opacity-70">{action.sub}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
