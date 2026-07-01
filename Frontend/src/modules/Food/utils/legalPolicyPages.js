import {
  FileText,
  Lock,
  Receipt,
  Truck,
  XCircle,
} from "lucide-react"

export const USER_LEGAL_POLICY_PAGES = [
  {
    key: "terms",
    path: "/food/user/profile/terms",
    publicPath: "/terms",
    defaultTitle: "Terms and Conditions",
    defaultDescription: "Read our terms and conditions",
    icon: FileText,
  },
  {
    key: "privacy",
    path: "/food/user/profile/privacy",
    publicPath: "/privacy",
    defaultTitle: "Privacy Policy",
    defaultDescription: "Learn how we protect your data",
    icon: Lock,
  },
  {
    key: "refund",
    path: "/food/user/profile/refund",
    publicPath: "/refund",
    defaultTitle: "Refund Policy",
    defaultDescription: "Read our refund terms and conditions",
    icon: Receipt,
  },
  {
    key: "shipping",
    path: "/food/user/profile/shipping",
    publicPath: "/shipping",
    defaultTitle: "Shipping Policy",
    defaultDescription: "Learn about our shipping terms",
    icon: Truck,
  },
  {
    key: "cancellation",
    path: "/food/user/profile/cancellation",
    publicPath: "/cancellation",
    defaultTitle: "Cancellation Policy",
    defaultDescription: "Read our cancellation terms and conditions",
    icon: XCircle,
  },
]
