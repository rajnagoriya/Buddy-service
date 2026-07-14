import LegalPolicyPage from "@food/components/user/LegalPolicyPage"
import { XCircle } from "lucide-react"

export default function Cancellation() {
  return (
    <LegalPolicyPage
      pageKey="cancellation"
      defaultTitle="Cancellation Policy"
      backFallback="/food/user/profile/about"
      emptyIcon={XCircle}
    />
  )
}
