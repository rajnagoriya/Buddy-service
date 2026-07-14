import LegalPolicyPage from "@food/components/user/LegalPolicyPage"

export default function Terms() {
  return (
    <LegalPolicyPage
      pageKey="terms"
      defaultTitle="Terms and Conditions"
      backFallback="/food/user/profile/about"
    />
  )
}
