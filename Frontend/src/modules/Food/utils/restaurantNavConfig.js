import {

  LayoutDashboard,

  FileText,

  Package,

  Info,

  Clock,

  Calendar,

  Settings,

  Truck,

  MapPin,

  Star,

  MessageSquare,

  LifeBuoy,

  Edit,

  IndianRupee,

  Receipt,

  Building2,

  Bell,

  Shield,

  Store,

  Download,

  UtensilsCrossed,

  Phone,

  User,

  Grid3x3,

  Tag,

} from "lucide-react"



export const RESTAURANT_BASE = "/food/restaurant"



export const SIDEBAR_NAV_ITEMS = [

  { id: "home", label: "Dashboard", icon: LayoutDashboard, route: `${RESTAURANT_BASE}` },

  { id: "orders", label: "Live orders", icon: FileText, route: `${RESTAURANT_BASE}/orders/live` },

  { id: "order-history", label: "Order history", icon: FileText, route: `${RESTAURANT_BASE}/orders/all` },

  { id: "inventory", label: "Menu", icon: Package, route: `${RESTAURANT_BASE}/inventory` },

  { id: "menu-categories", label: "Categories", icon: Grid3x3, route: `${RESTAURANT_BASE}/menu-categories` },

  { id: "reservations", label: "Reservations", icon: Calendar, route: `${RESTAURANT_BASE}/reservations` },

  { id: "delivery", label: "Delivery", icon: Truck, route: `${RESTAURANT_BASE}/delivery-settings` },

  { id: "finance", label: "Accounting", icon: IndianRupee, route: `${RESTAURANT_BASE}/hub-finance` },

  { id: "feedback", label: "Feedback", icon: MessageSquare, route: `${RESTAURANT_BASE}/feedback` },

  { id: "outlet", label: "Outlet info", icon: Info, route: `${RESTAURANT_BASE}/outlet-info` },

]



/** Grouped sidebar — desktop replaces Explore hub */

export const SIDEBAR_SECTIONS = [

  {

    key: "main",

    items: [{ id: "home", label: "Dashboard", icon: LayoutDashboard, route: `${RESTAURANT_BASE}` }],

  },

  {

    key: "operations",

    label: "Operations",

    items: [

      { id: "orders", label: "Live orders", icon: FileText, route: `${RESTAURANT_BASE}/orders/live` },

      { id: "reservations", label: "Reservations", icon: Calendar, route: `${RESTAURANT_BASE}/reservations` },

      { id: "order-history", label: "Order history", icon: FileText, route: `${RESTAURANT_BASE}/orders/all` },

    ],

  },

  {

    key: "menu",

    label: "Menu",

    items: [

      { id: "inventory", label: "Menu inventory", icon: Package, route: `${RESTAURANT_BASE}/inventory` },

      { id: "menu-categories", label: "Categories", icon: Grid3x3, route: `${RESTAURANT_BASE}/menu-categories` },

      { id: "coupons", label: "Coupons & offers", icon: Tag, route: `${RESTAURANT_BASE}/coupons` },

    ],

  },

  {

    key: "business",

    label: "Business",

    items: [

      { id: "delivery", label: "Delivery", icon: Truck, route: `${RESTAURANT_BASE}/delivery-settings` },

      { id: "finance", label: "Accounting", icon: IndianRupee, route: `${RESTAURANT_BASE}/hub-finance` },

      { id: "feedback", label: "Feedback", icon: MessageSquare, route: `${RESTAURANT_BASE}/feedback` },

    ],

  },

  {

    key: "outlet",

    label: "Outlet",

    items: [

      { id: "outlet-info", label: "Outlet info", icon: Info, route: `${RESTAURANT_BASE}/outlet-info` },

      { id: "hours-status", label: "Hours & status", icon: Clock, route: `${RESTAURANT_BASE}/outlet-timings` },

      { id: "zone", label: "Zone setup", icon: MapPin, route: `${RESTAURANT_BASE}/zone-setup` },

    ],

  },

  {

    key: "account",

    label: "Account",

    items: [

      { id: "notifications", label: "Notifications", icon: Bell, route: `${RESTAURANT_BASE}/notifications` },

      { id: "support", label: "Support", icon: LifeBuoy, route: `${RESTAURANT_BASE}/help-centre/support` },

      { id: "fssai", label: "FSSAI", icon: Shield, route: `${RESTAURANT_BASE}/fssai` },

    ],

  },

]



/** Mobile Explore — 6 sections per UX plan */

export const EXPLORE_SECTIONS = [

  {

    title: "My outlet",

    key: "outlet",

    items: [

      { id: "outlet-info", label: "Outlet info", icon: Info, route: `${RESTAURANT_BASE}/outlet-info` },

      { id: "hours-status", label: "Hours & status", icon: Clock, route: `${RESTAURANT_BASE}/outlet-timings` },

      { id: "phone", label: "Phone numbers", icon: Phone, route: `${RESTAURANT_BASE}/phone` },

      { id: "manage-outlets", label: "Manage outlets", icon: Store, route: `${RESTAURANT_BASE}/manage-outlets` },

    ],

  },

  {

    title: "Menu",

    key: "menu",

    items: [

      { id: "inventory", label: "Menu inventory", icon: Package, route: `${RESTAURANT_BASE}/inventory` },

      { id: "menu-categories", label: "Categories", icon: Grid3x3, route: `${RESTAURANT_BASE}/menu-categories` },

      { id: "rush-hour", label: "Rush hour", icon: Clock, route: `${RESTAURANT_BASE}/rush-hour` },

      { id: "coupons", label: "Coupons & offers", icon: Tag, route: `${RESTAURANT_BASE}/coupons` },

    ],

  },

  {

    title: "Delivery & dining",

    key: "delivery-dining",

    items: [

      { id: "delivery-settings", label: "Delivery settings", icon: Truck, route: `${RESTAURANT_BASE}/delivery-settings` },

      { id: "zone-setup", label: "Zone setup", icon: MapPin, route: `${RESTAURANT_BASE}/zone-setup` },

      { id: "reservations", label: "Dining reservations", icon: Calendar, route: `${RESTAURANT_BASE}/reservations` },

    ],

  },

  {

    title: "Money",

    key: "finance",

    items: [

      { id: "payout", label: "Payout", icon: IndianRupee, route: `${RESTAURANT_BASE}/hub-finance` },

      { id: "invoices", label: "Invoices", icon: Receipt, route: `${RESTAURANT_BASE}/hub-finance?tab=invoices` },

      { id: "bank-details", label: "Bank details", icon: Building2, route: `${RESTAURANT_BASE}/update-bank-details` },

      { id: "withdrawals", label: "Withdrawal history", icon: Download, route: `${RESTAURANT_BASE}/withdrawal-history` },

      { id: "reports", label: "Download report", icon: Download, route: `${RESTAURANT_BASE}/download-report` },

    ],

  },

  {

    title: "Customers",

    key: "customers",

    items: [

      { id: "reviews", label: "Reviews", icon: MessageSquare, route: `${RESTAURANT_BASE}/feedback` },

      { id: "complaints", label: "Complaints", icon: Star, route: `${RESTAURANT_BASE}/feedback?tab=complaints` },

      { id: "dish-ratings", label: "Dish ratings", icon: UtensilsCrossed, route: `${RESTAURANT_BASE}/dish-ratings` },

    ],

  },

  {

    title: "Account & help",

    key: "help",

    items: [

      { id: "owner-profile", label: "Owner profile", icon: User, route: `${RESTAURANT_BASE}/edit-owner` },

      { id: "fssai", label: "FSSAI details", icon: Shield, route: `${RESTAURANT_BASE}/fssai` },

      { id: "support", label: "Support", icon: LifeBuoy, route: `${RESTAURANT_BASE}/help-centre/support` },

      { id: "share-feedback", label: "Share your feedback", icon: Edit, route: `${RESTAURANT_BASE}/share-feedback` },

      { id: "notifications", label: "Notifications", icon: Bell, route: `${RESTAURANT_BASE}/notifications` },

    ],

  },

]



export const findActiveNavItem = (items, pathname) =>

  items

    .slice()

    .sort((a, b) => b.route.length - a.route.length)

    .find((item) => pathname === item.route || pathname.startsWith(item.route + "/"))

