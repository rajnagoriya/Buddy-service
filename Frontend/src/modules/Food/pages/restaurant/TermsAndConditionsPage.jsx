import { motion } from "framer-motion"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { useEffect, useState } from "react"
import { ArrowLeft, FileText } from "lucide-react"
import api, { API_ENDPOINTS } from "@food/api"

export default function TermsAndConditionsPage() {
  const goBack = useRestaurantBackNavigation()
  const [loading, setLoading] = useState(true)
  const [termsData, setTermsData] = useState({ title: "Terms and Conditions", content: "", updatedAt: "" })

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.ADMIN.TERMS_PUBLIC)
        if (response?.data?.success) {
          const payload = response?.data?.data || {}
          setTermsData({
            title: payload?.title || "Terms and Conditions",
            content: payload?.content || "",
            updatedAt: payload?.updatedAt || ""
          })
        }
      } catch (_) {
      } finally {
        setLoading(false)
      }
    }

    fetchTerms()
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--rt-surface-muted,#f4f6f9)] pb-10">
      {/* Header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center gap-3 border-b border-[var(--rt-border,#e8edf2)] bg-white px-4 py-3 shadow-sm sm:px-6">
        <button
          onClick={goBack}
          className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-bold text-gray-900">Terms & Conditions</h1>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 pt-[4.5rem] sm:px-6 lg:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden rounded-2xl border border-[var(--rt-border,#e8edf2)] bg-white shadow-sm"
        >
          <div className="h-1.5 w-full bg-[var(--rt-primary-strong,#27A344)]" />

          <div className="space-y-6 p-6 sm:p-8">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--rt-primary-soft,#E8F7EC)] text-[var(--rt-primary-strong,#27A344)]">
                <FileText className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{termsData.title || "Terms and Conditions"}</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--rt-primary-soft,#E8F7EC)] px-3 py-1 text-xs font-medium text-[var(--rt-primary-strong,#27A344)]">
                Last updated{" "}
                {(termsData.updatedAt ? new Date(termsData.updatedAt) : new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading terms...</p>
            ) : termsData.content ? (
              <div
                className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-700 prose-headings:text-gray-900 prose-a:text-[var(--rt-primary-strong,#27A344)]"
                dangerouslySetInnerHTML={{ __html: termsData.content }}
              />
            ) : (
              <p className="text-sm text-gray-500">No terms content available.</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
