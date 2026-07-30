import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[BROWSER PAGE ERROR] ${err.toString()}`);
  });

  console.log("Navigating to http://localhost:5173/taxi/admin/price-management/zones/create...");
  await page.goto('http://localhost:5173/taxi/admin/price-management/zones/create', { waitUntil: 'networkidle2' });
  
  // Wait a few seconds for maps to load
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
  console.log("Done.");
})();
