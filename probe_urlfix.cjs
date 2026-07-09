const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto('http://localhost:5173/archive', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const input = page.locator('.lock-hidden-input');
  if (await input.count() > 0) { await input.fill('2626'); await page.waitForTimeout(1500); }
  await page.goto('http://localhost:5173/archive/1%EC%B0%A8/brand-report/%EB%84%A4%EC%89%AC', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByText('다운로드', { exact: true }).click();
  await page.waitForTimeout(500);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByText('PPT 다운로드', { exact: true }).click(),
  ]);
  await download.saveAs('C:/Users/user/AppData/Local/Temp/urlfix_check.pptx');
  console.log('SAVED');
  await browser.close();
})();
