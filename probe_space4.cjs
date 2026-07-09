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

  const info = await page.evaluate(() => {
    const products = document.querySelectorAll('.season-collection__product');
    return Array.from(products).map(c => {
      const media = c.querySelector('.season-collection__product-media');
      const copy = c.querySelector('.season-collection__product-copy');
      const desc = c.querySelector('.season-collection__product-desc');
      return {
        cardH: c.getBoundingClientRect().height,
        mediaH: media ? media.getBoundingClientRect().height : null,
        copyH: copy ? copy.getBoundingClientRect().height : null,
        descH: desc ? desc.getBoundingClientRect().height : null,
        cls: c.className,
      };
    });
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
