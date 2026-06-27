/**
 * Smoke-test Food optimization endpoints (cache headers + response time).
 *
 * Usage: node scripts/test-food-optimization.js [baseUrl]
 * Example: node scripts/test-food-optimization.js http://localhost:5000
 */

const baseUrl = (process.argv[2] || 'http://localhost:5000').replace(/\/$/, '');

async function hit(path) {
  const started = Date.now();
  const res = await fetch(`${baseUrl}${path}`);
  const elapsed = Date.now() - started;
  const cacheHeader = res.headers.get('x-cache') || 'n/a';
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, cacheHeader, elapsed, body };
}

function logResult(label, result) {
  const size = result.body ? JSON.stringify(result.body).length : 0;
  console.log(
    `${label}: status=${result.status} cache=${result.cacheHeader} time=${result.elapsed}ms bytes=${size}`,
  );
}

async function main() {
  console.log(`Testing Food optimizations against ${baseUrl}\n`);

  const health = await hit('/health');
  logResult('GET /health', health);
  if (health.status !== 200) {
    console.error('\nServer is not healthy. Start Backend with: npm run dev');
    process.exit(1);
  }

  const endpoints = [
    '/api/v1/food/restaurant/restaurants?limit=5&page=1',
    '/api/v1/food/search/unified?q=pizza&limit=5&page=1',
    '/api/v1/food/hero-banners/public',
    '/api/v1/food/landing/settings/public',
    '/api/v1/food/dining/categories/public',
  ];

  for (const path of endpoints) {
    const first = await hit(path);
    logResult(`FIRST ${path}`, first);

    const second = await hit(path);
    logResult(`SECOND ${path}`, second);

    if (second.cacheHeader === 'HIT') {
      console.log('  -> cache working\n');
    } else if (second.elapsed < first.elapsed) {
      console.log('  -> faster repeat (possible warm DB / memory cache)\n');
    } else {
      console.log('  -> repeat request completed (check cache header)\n');
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
