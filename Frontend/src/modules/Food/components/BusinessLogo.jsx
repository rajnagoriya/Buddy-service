import { useState } from 'react';
import quickSpicyLogo from '@food/assets/quicky-spicy-logo.png';
import { useBusinessSettings } from '@food/hooks/useBusinessSettings';

/**
 * Single logo image with shared settings + fallback to quicky-spicy-logo.png.
 * Prevents duplicate fetches and duplicate fallback <img> branches across navbars.
 */
export default function BusinessLogo({
  className = '',
  alt,
  fallback = 'logo',
  loading = 'lazy',
  crossOrigin,
  src: srcOverride,
  ...imgProps
}) {
  const { logoUrl, companyName } = useBusinessSettings();
  const [failed, setFailed] = useState(false);

  const remoteSrc = logoUrl || srcOverride;

  const resolvedAlt = alt || companyName || 'Buddy Services';
  const showRemoteLogo = Boolean(remoteSrc) && !failed;

  if (showRemoteLogo) {
    return (
      <img
        src={remoteSrc}
        alt={resolvedAlt}
        className={className}
        loading={loading}
        crossOrigin={crossOrigin}
        onError={() => setFailed(true)}
        {...imgProps}
      />
    );
  }

  if (fallback === 'name' && companyName) {
    return (
      <span className={className} {...imgProps}>
        {companyName}
      </span>
    );
  }

  if (fallback === 'both' && companyName) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <img
          src={quickSpicyLogo}
          alt={resolvedAlt}
          className="h-full w-auto object-contain"
          loading={loading}
        />
        <span>{companyName}</span>
      </span>
    );
  }

  return (
    <img
      src={quickSpicyLogo}
      alt={resolvedAlt}
      className={className}
      loading={loading}
      {...imgProps}
    />
  );
}
