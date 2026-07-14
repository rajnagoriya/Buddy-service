import LegalPolicyPage from "@food/components/user/LegalPolicyPage"
import { Receipt } from "lucide-react"

export default function Refund() {
  return (
    <LegalPolicyPage
      pageKey="refund"
      defaultTitle="Refund Policy"
      backFallback="/food/user/profile/about"
      emptyIcon={Receipt}
    />
  )
}
