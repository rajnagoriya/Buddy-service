import LegalPolicyPage from "@food/components/user/LegalPolicyPage"
import { Truck } from "lucide-react"

export default function Shipping() {
  return (
    <LegalPolicyPage
      pageKey="shipping"
      defaultTitle="Shipping Policy"
      backFallback="/food/user/profile/about"
      emptyIcon={Truck}
    />
  )
}
