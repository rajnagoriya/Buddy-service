import { PROFILE_SERVICES } from "../profileServicesConfig";

export default function ServiceSwitcher({ activeService, onChange }) {
  return (
    <div className="profile-service-switcher" role="tablist" aria-label="Switch service">
      {PROFILE_SERVICES.map((service) => {
        const isActive = service.id === activeService;
        return (
          <button
            key={service.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`profile-service-pill${isActive ? " is-active" : ""}`}
            onClick={() => onChange(service.id)}
          >
            <span className="profile-service-dot" style={{ "--profile-accent": service.accent }} />
            {service.label}
          </button>
        );
      })}
    </div>
  );
}
