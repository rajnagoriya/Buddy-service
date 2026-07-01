import LegalPolicyPage from "@food/components/user/LegalPolicyPage"
import { Lock } from "lucide-react"

export default function Privacy() {
  return (
    <LegalPolicyPage
      pageKey="privacy"
      defaultTitle="Privacy Policy"
      backFallback="/food/user/profile/about"
      emptyIcon={Lock}
    />
  )
}
