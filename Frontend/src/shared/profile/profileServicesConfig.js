import {
  User,
  Wallet,
  Tag,
  ShoppingCart,
  MapPin,
  Leaf,
  Palette,
  Bookmark,
  Utensils,
  Building2,
  Settings as SettingsIcon,
  Info,
  AlertTriangle,
  Package,
  History,
  Gift,
  BusFront,
  Bell,
  Shield,
  HelpCircle,
  FileText,
  CreditCard,
  Heart,
  ShieldCheck,
  Share2,
  Star,
} from "lucide-react";

/** @typedef {'link' | 'action'} MenuItemType */

/**
 * Shared profile configuration for all end-user services.
 * Menu items use `type: 'action'` for in-page handlers (see UnifiedProfile).
 */
export const PROFILE_SERVICES = [
  {
    id: "food",
    label: "Food",
    accent: "#16A34A",
    accentClass: "profile-accent-food",
    homePath: "/food/user",
    header: {
      title: "Profile",
      backPath: "/food/user",
      actions: [],
    },
    sections: [
      {
        title: "Account",
        items: [
          { type: "link", icon: Wallet, label: "Money", sub: "Wallet balance", path: "/food/user/wallet", badgeKey: "foodWallet" },
          { type: "link", icon: Tag, label: "Your coupons", path: "/food/user/profile/coupons" },
          { type: "link", icon: ShoppingCart, label: "Your cart", path: "/food/user/cart" },
          { type: "link", icon: Tag, label: "Refer & Earn", sub: "Invite friends & earn rewards", path: "/food/user/profile/refer-earn", badgeKey: "foodReferral" },
          { type: "action", icon: MapPin, label: "Saved addresses", subKey: "foodAddressSummary", action: "openLocationSelector", badgeKey: "foodAddressCount" },
          { type: "link", icon: User, label: "Your profile", path: "/food/user/profile/edit", badgeKey: "foodProfileCompletion" },
          { type: "action", icon: Leaf, label: "Veg Mode", action: "openVegMode", valueKey: "vegMode" },
          { type: "action", icon: Palette, label: "Appearance", action: "openAppearance", valueKey: "appearance" },
        ],
      },
      {
        title: "Collections",
        items: [
          { type: "link", icon: Bookmark, label: "Your collections", path: "/food/user/profile/favorites" },
        ],
      },
      {
        title: "Dining Bookings",
        items: [
          { type: "link", icon: Utensils, label: "Your reservations", sub: "View table booking status", path: "/food/user/profile/dining-bookings" },
        ],
      },
      {
        title: "Food Orders",
        items: [
          { type: "link", icon: Building2, label: "Your orders", path: "/food/user/orders" },
        ],
      },
      {
        title: "More",
        items: [
          { type: "link", icon: SettingsIcon, label: "Help & Support", path: "/food/user/profile/support" },
          { type: "link", icon: Info, label: "About", path: "/food/user/profile/about" },
          { type: "link", icon: AlertTriangle, label: "Report a safety emergency", path: "/food/user/profile/report-safety-emergency" },
        ],
      },
    ],
  },
  {
    id: "taxi",
    label: "Taxi",
    accent: "#6366F1",
    accentClass: "profile-accent-taxi",
    homePath: "/taxi/user",
    header: {
      title: "Taxi Profile",
      backPath: "/taxi/user",
      actions: [
        { type: "navigate", icon: SettingsIcon, label: "Settings", path: "/taxi/user/profile/settings" },
      ],
    },
    stats: [
      { label: "Total Trips", key: "taxiTrips" },
      { label: "Rating", key: "taxiRating", suffix: " ★" },
      { label: "Credits", key: "taxiWallet", prefix: "₹" },
    ],
    sections: [
      {
        title: "Personal",
        items: [
          { type: "link", icon: User, label: "Profile Settings", sub: "Manage your personal info", path: "/taxi/user/profile/settings" },
          { type: "link", icon: MapPin, label: "Saved Addresses", sub: "Home, office & others", path: "/taxi/user/profile/addresses" },
          { type: "link", icon: History, label: "My Rides", sub: "Rides, parcels & trips", path: "/taxi/user/activity" },
        ],
      },
      {
        title: "Financial & Rewards",
        items: [
          { type: "link", icon: Wallet, label: "My Wallet", sub: "Balance & transactions", path: "/taxi/user/wallet", badgeKey: "taxiWallet" },
          { type: "link", icon: Package, label: "Subscriptions", sub: "Ride plans & credits", path: "/taxi/user/profile/subscriptions" },
          { type: "link", icon: Gift, label: "Refer & Earn", sub: "Invite friends & get rewards", path: "/taxi/user/referral" },
          { type: "link", icon: BusFront, label: "Bus Tickets", sub: "Manage bus bookings", path: "/taxi/user/profile/bus-bookings" },
        ],
      },
      {
        title: "Preferences",
        items: [
          { type: "link", icon: Bell, label: "Notifications", sub: "Offers & alerts", path: "/taxi/user/profile/notifications" },
          { type: "link", icon: Shield, label: "Security & SOS", sub: "Trust & safety settings", path: "/taxi/user/safety/sos" },
          { type: "link", icon: HelpCircle, label: "Help & Support", sub: "Help center & tickets", path: "/taxi/user/support/tickets" },
        ],
      },
      {
        title: "Legal",
        items: [
          { type: "link", icon: FileText, label: "Terms & Conditions", path: "/terms" },
          { type: "link", icon: Shield, label: "Privacy Policy", path: "/privacy" },
          { type: "link", icon: CreditCard, label: "Refund Policy", path: "/refund" },
        ],
      },
    ],
    inactiveFallback: {
      title: "Taxi Profile Inactive",
      description: "Start using Taxi to book rides, view subscription plans, and manage emergency contacts.",
      ctaLabel: "Activate Taxi Profile",
      ctaPath: "/taxi/user",
    },
    enabledKey: "taxiEnabled",
  },
  {
    id: "qc",
    label: "Grocery",
    accent: "#10B981",
    accentClass: "profile-accent-qc",
    homePath: "/qc",
    header: {
      title: "My Profile",
      backPath: "/qc",
      actions: [
        { type: "action", icon: Bell, label: "Test push", action: "testPush" },
        { type: "navigate", icon: User, label: "Edit profile", path: "/qc/profile/edit" },
      ],
    },
    sections: [
      {
        title: "Personal Account",
        items: [
          { type: "link", icon: Package, label: "Your Orders", sub: "Track, return or buy things again", path: "/qc/orders" },
          { type: "link", icon: CreditCard, label: "Order Transactions", sub: "View all payments & refunds", path: "/qc/transactions" },
          { type: "link", icon: Wallet, label: "Wallet", sub: "Balance & return refunds", path: "/qc/wallet", badgeKey: "qcWallet" },
          { type: "link", icon: Heart, label: "Your Wishlist", sub: "Your saved items", path: "/qc/wishlist", badgeKey: "qcWishlist" },
          { type: "link", icon: MapPin, label: "Saved Addresses", sub: "Manage your delivery locations", path: "/qc/addresses" },
        ],
      },
      {
        title: "Help & Settings",
        items: [
          { type: "link", icon: HelpCircle, label: "Help & Support", path: "/qc/support" },
          { type: "link", icon: ShieldCheck, label: "Privacy Policy", path: "/qc/privacy" },
          { type: "link", icon: Info, label: "About Us", path: "/qc/about" },
        ],
      },
    ],
    summary: [
      { label: "QC Wallet", key: "qcWallet", prefix: "₹", icon: Wallet },
      { label: "Wishlist", key: "qcWishlist", suffix: " Items", icon: Heart },
      { label: "Total Orders", key: "qcOrders", icon: Building2 },
    ],
  },
];

export const PROFILE_SERVICE_IDS = PROFILE_SERVICES.map((s) => s.id);

export const DEFAULT_PROFILE_SERVICE = "food";

export const PROFILE_STORAGE_KEY = "profile_active_service";
