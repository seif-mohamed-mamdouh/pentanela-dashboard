import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import writeXlsxFile from 'write-excel-file/node';
import { mockApi, vendors } from './fixtures';

const endpoint = '/api/amazon/catalog/bulk-import';
const jobId = '5c06d25d-20e0-4c5f-b760-883297b4c879';
const account = { ...vendors[0], id: '8211e665-f4a1-42e2-bc5c-02fac779c0d3', marketplaceId: 'ARBP9OOSHTCHU' };
const job = {
  jobId, accountId: account.id, marketplaceId: account.marketplaceId, isSandbox: false,
  status: 'Queued', total: 1, pending: 1, successful: 0, failed: 0, skipped: 0,
  createdAtUtc: '2026-11-19T18:00:00Z',
};
const jobPath = `${endpoint}/jobs/${jobId}`;
const xlsxMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/vendor-accounts', route => route.fulfill({ json: [account] }));
});

test('uploads the workbook for the working account and resumes its background job', async ({ page }) => {
  await page.clock.install();
  let uploads = 0;
  let statusChecks = 0;
  await page.route(`**${endpoint}/excel`, async route => {
    uploads++;
    const request = route.request();
    const body = request.postDataBuffer()!.toString('latin1');
    expect(request.method()).toBe('POST');
    expect(request.headers()['content-type']).toContain('multipart/form-data; boundary=');
    expect(body).toContain('name="File"; filename="competitors.xlsx"');
    expect(body).toContain(`name="AccountId"\r\n\r\n${account.id}`);
    expect(body).toContain('name="Marketplace"\r\n\r\nEG');
    await route.fulfill({ status: 202, headers: { Location: jobPath }, json: job });
  });
  await page.route(`**${jobPath}`, async route => {
    statusChecks++;
    if (statusChecks === 2) {
      await route.fulfill({ status: 503, json: {} });
      return;
    }
    const status = statusChecks === 1 ? 'Queued' : statusChecks === 3 ? 'Running' : 'Completed';
    await route.fulfill({ json: {
      ...job, status, pending: status === 'Completed' ? 0 : 1, successful: status === 'Completed' ? 1 : 0,
    } });
  });
  await page.route(`**${jobPath}/items?*`, route => route.fulfill({ json: {
    jobId, status: 'Completed', nextAfter: null,
    items: [{ inputNumber: 1, asin: '0123456789', worksheet: 'Competitors', rowNumber: 2, status: 'Successful',
      product: { title: 'Ceramic serving bowl' } }],
  } }));

  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'ASIN imports', exact: true }).click();
  const start = page.getByRole('button', { name: 'Start import' });
  const file = page.getByLabel('ASIN workbook (.xlsx)');
  await expect(start).toBeDisabled();
  await page.getByLabel('Working account').selectOption(account.id);
  await expect(page.getByLabel('Vendor account', { exact: true })).toHaveValue(account.id);
  await expect(page.getByLabel('Marketplace', { exact: true })).toHaveValue('Egypt (EG)');
  await file.setInputFiles({ name: 'competitors.csv', mimeType: 'text/csv', buffer: Buffer.from('ASIN\n0123456789') });
  await expect(page.getByRole('alert')).toContainText('Choose a nonempty Excel .xlsx workbook.');
  await expect(start).toBeDisabled();
  expect(uploads).toBe(0);

  const workbook = await writeXlsxFile([['ASIN'], ['0123456789']], { sheet: 'Competitors' }).toBuffer();
  await file.setInputFiles({ name: 'competitors.xlsx', mimeType: xlsxMimeType, buffer: workbook });
  await start.click();
  await expect(page).toHaveURL(`/asin-imports/${jobId}`);
  await expect(page.getByText('Queued', { exact: true })).toBeVisible();
  await expect(page.getByText('0 of 1 rows processed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Excel' })).toHaveCount(0);

  await page.clock.runFor(5500);
  await expect(page.getByRole('alert')).toContainText('The import status could not be loaded.');
  await page.getByRole('button', { name: 'Retry status check' }).click();
  await expect(page.getByText('Running', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(page.getByText('Ceramic serving bowl')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Excel' })).toBeEnabled();
  await page.clock.runFor(10_000);
  expect(statusChecks).toBe(4);
  expect(uploads).toBe(1);
});

test('downloads all 20,000 result rows across cursors, including failed and skipped rows', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const total = 20_000;
  const exportCursors: number[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(`**${jobPath}`, route => route.fulfill({ json: {
    ...job, status: 'Completed', isSandbox: true, total, pending: 0, successful: total - 2, failed: 1, skipped: 1,
  } }));
  await page.route('https://example.test/images/**', route => route.fulfill({ status: 404 }));
  await page.route(`**${jobPath}/items?*`, route => {
    const params = new URL(route.request().url()).searchParams;
    const after = Number(params.get('after'));
    const size = Number(params.get('pageSize'));
    if (size === 100) exportCursors.push(after);
    const count = Math.min(size, total - after);
    return route.fulfill({ json: {
      jobId, status: 'Completed', nextAfter: after + count < total ? after + count : null,
      items: Array.from({ length: count }, (_, index) => {
        const inputNumber = after + index + 1;
        const skipped = inputNumber === 2;
        const failed = inputNumber === total;
        return {
          inputNumber, worksheet: 'Competitors & Co', rowNumber: inputNumber + 1,
          asin: String(skipped ? 1 : inputNumber).padStart(10, '0'),
          status: failed ? 'Failed' : skipped ? 'Skipped' : 'Successful',
          errorCode: failed ? 'ProductNotFound' : skipped ? 'DuplicateAsin' : null,
          error: failed ? 'Amazon did not return this ASIN.' : skipped ? 'This ASIN already appeared.' : null,
          product: failed || skipped ? null : {
            title: inputNumber === 1 ? '=1+1' : `Product ${inputNumber}`,
            mainImageUrl: inputNumber === 1 ? 'https://example.test/images/main.jpg' : null,
            images: inputNumber === 1 ? [{ link: 'https://example.test/images/side.jpg' }] : null,
          },
        };
      }),
    } });
  });

  await page.goto(`/asin-imports/${jobId}`);
  await expect(page.getByText('Sandbox test data')).toBeVisible();
  await expect(page.getByText('Showing 20 of 20,000 rows.', { exact: false })).toBeVisible();
  await expect(page.getByText('This ASIN already appeared.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => node.target) }))).toEqual([]);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('ASIN_Import_5c06d25d.xlsx');
  expect(exportCursors).toEqual(Array.from({ length: 200 }, (_, index) => index * 100));
  const path = testInfo.outputPath('large-asin-import.xlsx');
  await file.saveAs(path);
  expect((await readFile(path)).subarray(0, 4).toString('hex')).toBe('504b0304');
});
