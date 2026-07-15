import { Navigate, useSearchParams } from "react-router-dom"

export default function DeliveryBoyCommission() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get("tab")
  const targetTab = tab === "rules" ? "rules" : "partner"
  return <Navigate to={`/admin/food/fee-settings?tab=${targetTab}`} replace />
}
