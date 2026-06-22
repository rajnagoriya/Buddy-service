import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import useMediaQuery from "@food/hooks/useMediaQuery"

const SIZE_CLASSES = {
  sm: "lg:max-w-sm",
  md: "lg:max-w-md",
  lg: "lg:max-w-lg",
  xl: "lg:max-w-xl",
  "2xl": "lg:max-w-2xl",
}

const MOBILE_HEIGHT_CLASSES = {
  auto: "max-h-[min(85vh,fit-content)]",
  medium: "max-h-[70vh]",
  tall: "max-h-[85vh]",
  full: "max-h-[90vh]",
}

export default function RestaurantPanelModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  mobileMaxHeight = "tall",
  zIndex = 50,
  className = "",
  bodyClassName = "",
  headerRight = null,
  titleCentered = false,
  showDragHandle = true,
  showCloseButton = true,
  closeOnOverlay = true,
  hideHeader = false,
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const mobileHeightClass = MOBILE_HEIGHT_CLASSES[mobileMaxHeight] || MOBILE_HEIGHT_CLASSES.tall

  if (typeof document === "undefined") return null

  const desktopMotion = {
    initial: { opacity: 0, scale: 0.96, x: "-50%", y: "-48%" },
    animate: { opacity: 1, scale: 1, x: "-50%", y: "-50%" },
    exit: { opacity: 0, scale: 0.96, x: "-50%", y: "-48%" },
  }

  const mobileMotion = {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
  }

  const motionProps = isDesktop ? desktopMotion : mobileMotion

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            style={{ zIndex }}
            onClick={closeOnOverlay ? onClose : undefined}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "rt-panel-modal-title" : undefined}
            {...motionProps}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={`
              fixed flex w-full flex-col overflow-hidden bg-white shadow-2xl
              inset-x-0 bottom-0 rounded-t-2xl ${mobileHeightClass}
              lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2
              lg:h-auto lg:w-[calc(100%-2rem)] ${SIZE_CLASSES[size] || SIZE_CLASSES.md}
              lg:max-h-[90vh] lg:rounded-2xl lg:border lg:border-gray-200
              ${className}
            `}
            style={{ zIndex: zIndex + 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            {showDragHandle && !hideHeader ? (
              <div className="flex shrink-0 justify-center pt-2 pb-1 lg:hidden">
                <div className="h-1 w-10 rounded-full bg-gray-300" />
              </div>
            ) : null}

            {!hideHeader && (title || description || headerRight || showCloseButton) ? (
              <div
                className={`flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 lg:px-5 lg:py-4 ${
                  titleCentered ? "text-center" : ""
                }`}
              >
                <div className={`min-w-0 flex-1 ${titleCentered ? "mx-auto text-center" : ""}`}>
                  {title ? (
                    <h2 id="rt-panel-modal-title" className="text-lg font-bold text-gray-900">
                      {title}
                    </h2>
                  ) : null}
                  {description ? <p className="mt-0.5 text-sm text-gray-500">{description}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {headerRight}
                  {showCloseButton ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-full p-1.5 transition-colors hover:bg-gray-100"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5 text-gray-600" />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div
              className={`flex-1 overflow-y-auto overscroll-contain ${
                bodyClassName || "px-4 py-4 lg:px-5 lg:py-5"
              }`}
            >
              {children}
            </div>

            {footer ? (
              <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:px-5 lg:pb-4">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export function RestaurantConfirmModal({
  open,
  onClose,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  confirmVariant = "primary",
  loading = false,
  icon = null,
  size = "sm",
  zIndex = 50,
  showCancel = true,
}) {
  const confirmClass =
    confirmVariant === "danger"
      ? "bg-rose-600 hover:bg-rose-700 text-white"
      : confirmVariant === "warning"
        ? "bg-orange-500 hover:bg-orange-600 text-white"
        : "bg-[var(--rt-primary-strong)] hover:opacity-90 text-white"

  return (
    <RestaurantPanelModal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      mobileMaxHeight="auto"
      showDragHandle={false}
      zIndex={zIndex}
      bodyClassName="px-5 py-4 lg:px-6 lg:py-5"
      footer={
        <div className={`flex flex-col-reverse gap-2 ${showCancel ? "sm:flex-row sm:justify-end" : ""}`}>
          {showCancel ? (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 sm:flex-none"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`${showCancel ? "flex-1 sm:flex-none" : "w-full"} rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${confirmClass}`}
          >
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      }
    >
      {icon ? <div className="mb-4 flex justify-center">{icon}</div> : null}
      {children}
    </RestaurantPanelModal>
  )
}
