import { forwardRef } from "react"
import ZoneSetup from "@food/pages/restaurant/ZoneSetup"

export default forwardRef(function ZoneSelectionPanel({ mapActive = true }, ref) {
  return <ZoneSetup embedded mapActive={mapActive} ref={ref} />
})
