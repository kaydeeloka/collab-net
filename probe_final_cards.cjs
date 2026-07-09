const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:5173/archive/1%EC%B0%A8/season-web', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const input = page.locator('.lock-hidden-input');
  if (await input.count() > 0) { await input.fill('2626'); await page.waitForTimeout(1500); }
  await page.waitForTimeout(1000);
  await page.getByText('편집', { exact: true }).first().click();
  await page.waitForTimeout(800);
  const products = page.locator('.season-collection__products').first();
  await products.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await products.screenshot({ path: 'C:/Users/user/AppData/Local/Temp/cards_final.png' });

  const info = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.season-collection__product')).map(c => c.getBoundingClientRect().height);
  });
  console.log('card heights:', JSON.stringify(info));
  await browser.close();
})();
