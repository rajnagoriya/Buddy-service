import { useCallback, useState } from "react"
import { ORDER_FILTER_TABS } from "@food/utils/orderLiveConfig"

export default function useOrderFilters(initialFilter = "new") {
  const [activeFilter, setActiveFilter] = useState(initialFilter)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const setFilterByIndex = useCallback((index) => {
    const tab = ORDER_FILTER_TABS[index]
    if (tab) setActiveFilter(tab.id)
  }, [])

  const getFilterIndex = useCallback(
    () => ORDER_FILTER_TABS.findIndex((tab) => tab.id === activeFilter),
    [activeFilter]
  )

  return {
    filterTabs: ORDER_FILTER_TABS,
    activeFilter,
    setActiveFilter,
    isTransitioning,
    setIsTransitioning,
    setFilterByIndex,
    getFilterIndex,
  }
}
