import { expect, test } from '@playwright/test';
import { batch, mockApi, vendors } from './fixtures';

const approved = { ...vendors[0], marketplaceId: 'ARBP9OOSHTCHU', gtinExemptionEnabled: true };
const price = { status: 'Available', amount: 530.25, currency: 'EGP',
  sourceUrl: 'https://www.amazon.eg/dp/0123456789', checkedAtUtc: '2026-11-21T12:00:00Z' };
const product = { asin: '0123456789', title: 'Serving bowl', livePrice: price };

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/vendor-accounts', route => route.fulfill({ json: [approved, vendors[1]] }));
});

test('admin sees the saved exemption and changing the vendor identity clears it', async ({ page }) => {
  await page.route('**/api/vendor-accounts/vendor-0', route => route.fulfill({ json: approved }));
  await page.goto('/vendor-accounts');
  await page.getByRole('button', { name: 'Pentanela Egypt', exact: true }).click();
  const setting = page.getByLabel('Allow GTIN-exempt uploads');
  await expect(setting).toBeChecked();
  await page.getByLabel('Vendor code', { exact: true }).fill('NEW');
  await expect(setting).not.toBeChecked();
  const saved = page.waitForRequest(r => r.url().endsWith('/vendor-accounts/vendor-0') && r.method() === 'PUT');
  await page.getByRole('button', { name: 'Save account', exact: true }).click();
  expect((await saved).postDataJSON().gtinExemptionEnabled).toBe(false);
});

test('single exempt product requires the approved brand and shows the returned batch', async ({ page }) => {
  await page.route('**/api/products/gtin-exempt', route => route.fulfill({ json: { ...batch, useGtinExemption: true } }));
  await page.goto('/products');
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  const vendor = page.getByRole('combobox', { name: 'Vendor account', exact: true });
  const exempt = page.getByLabel('Submit to Amazon with a GTIN exemption');
  await vendor.selectOption(approved.id);
  await exempt.check();
  await vendor.selectOption(vendors[1].id);
  await expect(exempt).toHaveCount(0);
  await vendor.selectOption(approved.id);
  await expect(exempt).not.toBeChecked();
  await exempt.check();
  await page.getByLabel('SKU', { exact: true }).fill('MUG1');
  await page.getByLabel('Title', { exact: true }).fill('Mug');
  await page.getByLabel('Cost price').fill('15');
  const submit = page.getByRole('button', { name: 'Submit GTIN-exempt product' });
  await expect(submit).toBeDisabled();
  await page.getByLabel('Amazon-approved brand').fill('Approved Brand');
  const sent = page.waitForRequest(r => r.url().endsWith('/products/gtin-exempt') && r.method() === 'POST');
  await submit.click();
  expect((await sent).postDataJSON()).toEqual({ vendorAccountId: approved.id,
    item: { sku: 'MUG1', title: 'Mug', brand: 'Approved Brand', productType: 'PRODUCT', costPrice: 15, currency: 'USD', casePackQuantity: 1 } });
  await expect(page.getByRole('heading', { name: batch.batchReference })).toBeVisible();
  await expect(page.getByText('GTIN exemption requested for items without a barcode.')).toBeVisible();
});

for (const mode of ['json', 'excel']) {
  test('submits a GTIN-exempt ' + mode + ' batch', async ({ page }) => {
    const path = '/api/bulk-upload/gtin-exempt' + (mode === 'excel' ? '/excel' : '');
    await page.route('**' + path, route => route.fulfill({ json: { ...batch, useGtinExemption: true } }));
    await page.goto('/bulk-upload');
    await page.getByLabel('Working account').selectOption(approved.id);
    await page.getByRole('button', { name: 'New batch' }).click();
    await page.getByLabel('Use GTIN exemption').check();
    await page.getByLabel('Input method').selectOption(mode);
    const items = [{ sku: 'EXEMPT', title: 'Mug', costPrice: 15, brand: 'Approved Brand' },
      { sku: 'BARCODED', title: 'Plate', costPrice: 20, barcodeType: 'EAN', barcodeValue: '0123456789012' }];
    if (mode === 'json') await page.getByLabel('Product items', { exact: true }).fill(JSON.stringify(items));
    else await page.getByLabel('Product workbook (.xlsx)').setInputFiles({
      name: 'exempt.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('workbook'),
    });
    const sent = page.waitForRequest(r => r.url().endsWith(path) && r.method() === 'POST');
    await page.getByRole('button', { name: 'Submit GTIN-exempt batch' }).click();
    const request = await sent;
    if (mode === 'json') expect(request.postDataJSON()).toEqual({ vendorAccountId: approved.id, batchReference: null, items });
    else {
      expect(request.postDataBuffer()!.toString()).toContain('name="VendorAccountId"\r\n\r\nvendor-0');
      expect(request.postDataBuffer()!.toString()).toContain('name="File"; filename="exempt.xlsx"');
    }
    await expect(page.getByText('GTIN exemption requested for items without a barcode.')).toBeVisible();
  });
}

test('reads storefront prices on all three catalog browsing routes', async ({ page }) => {
  const base = '/api/amazon/catalog';
  await page.route('**' + base + '/**', route => {
    const { pathname, searchParams } = new URL(route.request().url());
    expect(searchParams.get('includeLivePrice')).toBe('true');
    expect(searchParams.get('marketplace')).toBe('EG');
    if (pathname.endsWith('/products')) {
      expect(pathname).toBe(base + '/accounts/' + approved.id + '/products');
      return route.fulfill({ json: { items: [{ product }], isSandbox: false } });
    }
    expect(searchParams.get('accountId')).toBe(approved.id);
    if (pathname.endsWith('/search')) {
      expect(searchParams.get('keyword')).toBe('bowl');
      const next = searchParams.get('pageToken') === 'token+/=';
      return route.fulfill({ json: { items: [next ? { ...product, livePrice: { status: 'RateLimited' } } : product],
        nextToken: next ? null : 'token+/=', isSandbox: false } });
    }
    expect(pathname).toBe(base + '/0123456789');
    return route.fulfill({ json: { product, isSandbox: false } });
  });
  await page.goto('/asin-imports');
  await page.getByLabel('Vendor account', { exact: true }).selectOption(approved.id);
  await page.getByRole('button', { name: 'Browse Amazon catalog' }).click();
  await page.getByLabel('Keyword', { exact: true }).fill('bowl');
  await page.getByLabel('Include live storefront prices').check();
  await page.getByRole('button', { name: 'Find products' }).click();
  const result = page.getByRole('region', { name: 'Amazon catalog results' });
  await expect(result).toContainText('530.25');
  await expect(result.getByRole('link', { name: 'View on Amazon' })).toHaveAttribute('href', price.sourceUrl);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(result).toContainText('Storefront rate limit reached');
  await page.getByLabel('Find products by').selectOption('asin');
  await page.getByLabel('ASIN', { exact: true }).fill(product.asin);
  await page.getByRole('button', { name: 'Find products' }).click();
  await expect(result).toContainText('530.25');
  await page.getByLabel('Find products by').selectOption('imported');
  await page.getByRole('button', { name: 'Show imported products' }).click();
  await expect(result).toContainText('Serving bowl');
  await page.getByLabel('Working account').selectOption(vendors[1].id);
  await expect(result).toHaveCount(0);
});

test('priced preview and export follow 20-row pages through the final cursor', async ({ page }, testInfo) => {
  const jobId = '7cd28d83-1055-4524-8372-d7c42631e2e8';
  const jobPath = '/api/amazon/catalog/bulk-import/jobs/' + jobId;
  const pricedRequests: number[] = [];
  await page.route('**' + jobPath, route => route.fulfill({ json: {
    jobId, accountId: approved.id, marketplaceId: approved.marketplaceId, status: 'Completed',
    total: 21, successful: 21, failed: 0, pending: 0, skipped: 0, isSandbox: false, createdAtUtc: price.checkedAtUtc,
  } }));
  await page.route('**' + jobPath + '/items?*', route => {
    const params = new URL(route.request().url()).searchParams;
    const after = Number(params.get('after'));
    const priced = params.get('includeLivePrice') === 'true';
    if (priced) { expect(params.get('pageSize')).toBe('20'); pricedRequests.push(after); }
    const items = Array.from({ length: Math.min(20, 21 - after) }, (_, index) => ({
      inputNumber: after + index + 1, worksheet: 'Sheet1', rowNumber: after + index + 2, asin: String(after + index + 1).padStart(10, '0'),
      status: 'Successful', product: { ...product, livePrice: priced ? (index === 0 ? price : { status: 'Unavailable' }) : null },
    }));
    return route.fulfill({ json: { jobId, status: 'Completed', items, nextAfter: after === 0 ? 20 : null } });
  });
  await page.goto('/asin-imports/' + jobId);
  await page.getByLabel('Include live storefront prices').check();
  await expect(page.getByRole('region', { name: 'ASIN results preview' })).toContainText('No offer available');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel' }).click();
  await (await download).saveAs(testInfo.outputPath('priced-results.xlsx'));
  expect(pricedRequests).toEqual([0, 0, 20]);
});
