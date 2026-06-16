import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function HomeSectionHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  actionTo,
  onActionClick,
  className = "",
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4 ${className}`}>
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="food-landing-eyebrow">{eyebrow}</p> : null}
        {title ? <h2 className="food-landing-title">{title}</h2> : null}
        {subtitle ? <p className="food-landing-subtitle">{subtitle}</p> : null}
      </div>
      {actionLabel && actionTo ? (
        <Link to={actionTo} className="food-landing-link inline-flex items-center gap-0.5 shrink-0">
          {actionLabel}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
      {actionLabel && onActionClick ? (
        <button
          type="button"
          onClick={onActionClick}
          className="food-landing-link inline-flex items-center gap-0.5 shrink-0"
        >
          {actionLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
