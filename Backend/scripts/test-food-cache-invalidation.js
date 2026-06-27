/**
 * Verifies Food cache invalidation on the running API server.
 * Landing admin writes are unauthenticated in dev — used to trigger invalidation.
 *
 * Usage: node scripts/test-food-cache-invalidation.js [baseUrl]
 */

const baseUrl = (process.argv[2] || 'http://localhost:5000').replace(/\/$/, '');

async function hit(path) {
  const res = await fetch(`${baseUrl}${path}`);
  const cacheHeader = res.headers.get('x-cache') || 'n/a';
  await res.json().catch(() => null);
  return { status: res.status, cacheHeader };
}

async function warmAndInvalidate({ path, label, invalidate }) {
  const first = await hit(path);
  const second = await hit(path);

  const inv = await invalidate();
  const third = await hit(path);

  console.log(`${label}`);
  console.log(`  warm: ${first.cacheHeader} -> ${second.cacheHeader} | after invalidate: ${third.cacheHeader} (invalidate HTTP ${inv.status})`);

  if (second.cacheHeader === 'HIT' && third.cacheHeader === 'MISS') {
    console.log('  -> invalidation OK\n');
    return true;
  }

  console.log('  -> unexpected; ensure server is running in development\n');
  return false;
}

async function main() {
  console.log(`Testing Food cache invalidation against ${baseUrl}\n`);

  const health = await fetch(`${baseUrl}/health`);
  if (!health.ok) {
    console.error('Server not reachable. Start Backend first.');
    process.exit(1);
  }

  await warmAndInvalidate({
    path: '/api/v1/food/hero-banners/public',
    label: 'Landing banners',
    invalidate: () =>
      fetch(`${baseUrl}/api/v1/food/hero-banners/000000000000000000000000/status`, {
        method: 'PATCH',
      }),
  });

  await warmAndInvalidate({
    path: '/api/v1/food/landing/settings/public',
    label: 'Landing settings',
    invalidate: () =>
      fetch(`${baseUrl}/api/v1/food/hero-banners/landing/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
  });

  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
