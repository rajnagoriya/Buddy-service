import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@food/components/ui/button";

export default function ProfileHeader({ service, headerActions, onHeaderAction }) {
  const { title, backPath, actions = [] } = service.header;

  return (
    <div className="flex items-center gap-2 mb-4">
      <Link to={backPath}>
        <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
          <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
        </Button>
      </Link>
      <h1 className="text-lg font-bold text-gray-900 dark:text-white flex-1">{title}</h1>
      <div className="profile-header-actions">
        {actions.map((action) => {
          const Icon = action.icon;
          if (action.type === "navigate") {
            return (
              <Link
                key={action.label}
                to={action.path}
                className="profile-header-btn"
                title={action.label}
                aria-label={action.label}
              >
                <Icon size={18} />
              </Link>
            );
          }
          return (
            <button
              key={action.label}
              type="button"
              className="profile-header-btn"
              title={action.label}
              aria-label={action.label}
              onClick={() => onHeaderAction?.(action.action)}
              disabled={headerActions?.[action.action]?.disabled}
            >
              <Icon size={18} className={headerActions?.[action.action]?.loading ? "opacity-40" : ""} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
