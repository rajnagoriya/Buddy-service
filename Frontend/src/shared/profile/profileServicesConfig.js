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
import { ENABLE_DINING } from "@/shared/featureFlags";

/** @typedef {'link' | 'action'} MenuItemType */

/**
 * Shared profile configuration for all end-user services.
 * Menu items use `type: 'action'` for in-page handlers (see UnifiedProfile).
 */
export const PROFILE_SERVICES = [
  {
    id: "unified",
    label: "Unified Profile",
    accent: "#6366F1",
    accentClass: "profile-accent-unified",
    homePath: "/food/user", // Or root path
    header: {
      title: "My Profile",
      backPath: "/food/user",
      actions: [
        { type: "navigate", icon: SettingsIcon, label: "Settings", path: "/taxi/user/profile/settings" },
      ],
    },
    sections: [
      {
        title: "Orders & History",
        items: [
          { type: "link", icon: Building2, label: "All Orders", sub: "Food & Grocery", path: "/food/user/orders" },
          { type: "link", icon: History, label: "My Rides", sub: "Taxi rides & parcels", path: "/taxi/user/activity" },
          ...(ENABLE_DINING
            ? [{ type: "link", icon: Utensils, label: "Dining Bookings", sub: "View table reservations", path: "/food/user/profile/dining-bookings" }]
            : []),
          { type: "link", icon: BusFront, label: "Bus Tickets", sub: "Manage bus bookings", path: "/taxi/user/profile/bus-bookings" },
        ],
      },
      {
        title: "Wallets & Finances",
        items: [
          { type: "link", icon: Wallet, label: "Food Wallet", sub: "Balance & transactions", path: "/food/user/wallet", badgeKey: "foodWallet" },
          { type: "link", icon: Wallet, label: "Taxi Wallet", sub: "Balance & transactions", path: "/taxi/user/wallet", badgeKey: "taxiWallet" },
          { type: "link", icon: Wallet, label: "Grocery Wallet", sub: "Balance & transactions", path: "/qc/wallet", badgeKey: "qcWallet" },
          { type: "link", icon: CreditCard, label: "Order Transactions", sub: "View all payments & refunds", path: "/qc/transactions" },
        ],
      },
      {
        title: "Saved Items",
        items: [
          { type: "action", icon: MapPin, label: "Saved Addresses", subKey: "foodAddressSummary", action: "openLocationSelector", badgeKey: "foodAddressCount" },
          { type: "link", icon: Heart, label: "Your Wishlist", sub: "Saved items from QC", path: "/qc/wishlist", badgeKey: "qcWishlist" },
          { type: "link", icon: Bookmark, label: "Food Collections", path: "/food/user/profile/favorites" },
        ],
      },
      {
        title: "Preferences & Rewards",
        items: [
          { type: "link", icon: User, label: "Profile Settings", path: "/taxi/user/profile/settings" },
          { type: "link", icon: Tag, label: "Your Coupons", path: "/food/user/profile/coupons" },
          { type: "link", icon: Gift, label: "Refer & Earn", path: "/taxi/user/referral" },
          { type: "action", icon: Leaf, label: "Veg Mode", action: "openVegMode", valueKey: "vegMode" },
          { type: "action", icon: Palette, label: "Appearance", action: "openAppearance", valueKey: "appearance" },
        ],
      },
      {
        title: "Help & Legal",
        items: [
          { type: "link", icon: HelpCircle, label: "Help & Support", path: "/taxi/user/support/tickets" },
          { type: "link", icon: Shield, label: "Security & SOS", path: "/taxi/user/safety/sos" },
          { type: "link", icon: FileText, label: "Terms & Conditions", path: "/terms" },
          { type: "link", icon: ShieldCheck, label: "Privacy Policy", path: "/privacy" },
          { type: "link", icon: Info, label: "About Us", path: "/about" },
        ],
      },
    ],
  },
];

export const PROFILE_SERVICE_IDS = PROFILE_SERVICES.map((s) => s.id);

export const DEFAULT_PROFILE_SERVICE = "unified";

export const PROFILE_STORAGE_KEY = "profile_active_service";
