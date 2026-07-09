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
    const productsEl = document.querySelector('.season-collection__products');
    const section = productsEl.closest('section');
    const cs = getComputedStyle(section);
    const kids = Array.from(section.children).map(c => ({
      tag: c.tagName, cls: c.className, h: c.getBoundingClientRect().height,
      marginBottom: getComputedStyle(c).marginBottom,
      marginTop: getComputedStyle(c).marginTop,
    }));
    return {
      sectionPadding: cs.padding,
      sectionDisplay: cs.display,
      sectionGap: cs.gap,
      sectionHeight: section.getBoundingClientRect().height,
      children: kids,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
