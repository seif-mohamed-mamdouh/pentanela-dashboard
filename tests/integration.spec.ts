import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApi, product, order, batch, credential, profileResult, vendors, user } from './fixtures';

test.beforeEach(async ({ page }) => { await mockApi(page); });
async function addProduct(page: Page) {
  await page.goto('/products'); await page.getByRole('button', { name:'Add product', exact:true }).click();
  await page.getByRole('combobox', { name:'Vendor account', exact:true }).selectOption('vendor-0');
  await page.getByLabel('SKU', { exact:true }).fill('NEW-001'); await page.getByLabel('Title', { exact:true }).fill('New serving set');
  await page.getByLabel('Cost price', { exact:true }).fill('99.50'); await page.getByLabel('Currency', { exact:true }).fill('egp');
}

test('product creation sends the full contract, retains values after conflict, and retries', async ({ page }) => {
  let attempts = 0; let payload: unknown;
  await page.route('**/api/products', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    payload = route.request().postDataJSON(); attempts++;
    await route.fulfill(attempts === 1 ? { status:409, json:'This SKU already exists.' } : { status:201, json:{ ...product, ...payload as object } });
  });
  await addProduct(page); await page.getByLabel('Brand', { exact:true }).fill('Pentanela');
  await page.getByLabel('Case pack quantity', { exact:true }).fill('6');
  await page.getByRole('button', { name:'Create product', exact:true }).click();
  await expect(page.getByRole('alert').filter({ hasText:'This SKU already exists.' })).toBeVisible();
  await expect(page.getByLabel('SKU', { exact:true })).toHaveValue('NEW-001');
  await page.getByRole('button', { name:'Create product', exact:true }).click();
  await expect(page.locator('.workspace-notice')).toContainText('Product created');
  expect(payload).toEqual({ vendorAccountId:'vendor-0', sku:'NEW-001', title:'New serving set', brand:'Pentanela', productType:'PRODUCT', barcodeType:'EAN', barcodeValue:'', costPrice:99.5, currency:'EGP', casePackQuantity:6, innerPackQuantity:1, countryOfOrigin:'' });
});

test('catalog search and status reach the server and restart pagination', async ({ page }) => {
  await page.goto('/products'); await page.getByRole('button', { name:'Next', exact:true }).click();
  await page.getByRole('searchbox', { name:'Search catalog' }).fill('ceramic');
  const searched = page.waitForRequest(r => r.url().includes('/api/products?') && new URL(r.url()).searchParams.get('search') === 'ceramic');
  await page.getByRole('button', { name:'Search', exact:true }).click();
  const params = new URL((await searched).url()).searchParams; expect(params.get('page')).toBe('1'); expect(params.get('pageSize')).toBe('25');
  const filtered = page.waitForRequest(r => r.url().includes('status=Rejected'));
  await page.getByLabel('Filter by status').selectOption('Rejected'); await filtered;
  await page.getByRole('searchbox', { name:'Search catalog' }).fill('');
  await expect(page.getByText('Page 1 · Search applies to the catalog')).toBeVisible();
});

test('product detail uses GET and requires confirmation for deletion', async ({ page }) => {
  let deletes = 0;
  await page.route('**/api/products/product-0', async route => { if (route.request().method() === 'DELETE') { deletes++; return route.fulfill({ status:204 }); } return route.fulfill({ json:product }); });
  await page.goto('/products'); await page.getByRole('button', { name:product.title, exact:true }).click();
  await expect(page.getByText('1234567890123', { exact:false })).toBeVisible();
  await page.getByRole('button', { name:'Delete product', exact:true }).click(); expect(deletes).toBe(0);
  await page.getByRole('button', { name:'Keep product' }).click(); expect(deletes).toBe(0);
  await page.getByRole('button', { name:'Delete product', exact:true }).click(); await page.getByRole('button', { name:'Confirm delete product' }).click();
  await expect(page.locator('.workspace-notice')).toContainText('Product deleted'); expect(deletes).toBe(1);
});

test('order details validate quantities and save per-item acknowledgments', async ({ page }) => {
  let payload: any;
  await page.route('**/api/purchase-orders/po-1', route => route.fulfill({ json:payload ? { ...order, orderStatus:'Acknowledged', acknowledgedAtUtc:'2026-11-07T12:00:00Z', items:order.items.map((item,i) => ({ ...item, acknowledgedStatus:payload.items[i].status, acknowledgedQuantity:payload.items[i].acknowledgedQuantity, rejectionReason:payload.items[i].rejectionReason })) } : order }));
  await page.route('**/api/purchase-orders/acknowledge', async route => { payload = route.request().postDataJSON(); await route.fulfill({ json:{ success:true } }); });
  await page.goto('/purchase-orders'); await page.getByRole('button', { name:order.amazonOrderNumber, exact:true }).click();
  await expect(page.getByText('This endpoint does not send an acknowledgment to Amazon.', { exact:false })).toBeVisible();
  await page.getByLabel('Quantity for PEN-0001', { exact:true }).fill('11'); await expect(page.getByRole('button', { name:'Save acknowledgment' })).toBeDisabled();
  await page.getByLabel('Quantity for PEN-0001', { exact:true }).fill('8'); await page.getByRole('combobox', { name:'Response for PEN-0001', exact:true }).selectOption('Backordered'); await page.getByLabel('Quantity for PEN-0001', { exact:true }).fill('8');
  await page.getByRole('combobox', { name:'Response for PEN-0002', exact:true }).selectOption('Rejected'); await expect(page.getByLabel('Quantity for PEN-0002', { exact:true })).toHaveValue('0');
  await page.getByLabel('Rejection reason for PEN-0002', { exact:true }).fill('Out of stock');
  await page.getByRole('button', { name:'Save acknowledgment', exact:true }).click();
  await expect(page.locator('.workspace-notice')).toContainText('Acknowledgment saved');
  expect(payload).toEqual({ orderId:'po-1', items:[{ itemId:'item-1', status:'Backordered', acknowledgedQuantity:8, rejectionReason:null }, { itemId:'item-2', status:'Rejected', acknowledgedQuantity:0, rejectionReason:'Out of stock' }] });
  await expect(page.getByRole('combobox', { name:'Response for PEN-0001', exact:true })).toBeDisabled();
});

test('Excel upload sends multipart field names and shows returned batch item errors', async ({ page }) => {
  let upload = '';
  await page.route('**/api/bulk-upload/excel', async route => { upload = route.request().postDataBuffer()!.toString(); expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary='); await route.fulfill({ json:batch }); });
  await page.goto('/bulk-upload'); await page.locator('#vendor-selector').selectOption('vendor-0'); await page.getByRole('button', { name:'New batch' }).click();
  await page.getByLabel('Batch reference (optional)').fill('NOV-UPLOAD');
  await page.getByLabel('Product workbook (.xlsx)').setInputFiles({ name:'catalog.xlsx', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer:Buffer.from('mock workbook') });
  await page.getByRole('button', { name:'Submit batch to workspace' }).click();
  await expect(page.locator('.workflow-panel')).toContainText('Barcode is required');
  expect(upload).toContain('name="VendorAccountId"'); expect(upload).toContain('vendor-0'); expect(upload).toContain('name="File"; filename="catalog.xlsx"'); expect(upload).toContain('name="BatchReference"'); expect(upload).toContain('NOV-UPLOAD');
  const refresh = page.waitForRequest(r => r.url().endsWith('/api/bulk-upload/batches/batch-1/refresh') && r.method() === 'POST');
  await page.getByRole('button', { name:'Refresh batch status', exact:true }).click(); await refresh;
});

test('JSON batch validates before submission and uses the selected account', async ({ page }) => {
  let payload: any;
  await page.route('**/api/bulk-upload', async route => { payload = route.request().postDataJSON(); await route.fulfill({ json:batch }); });
  await page.goto('/bulk-upload'); await page.locator('#vendor-selector').selectOption('vendor-2'); await page.getByRole('button', { name:'New batch' }).click();
  await page.getByLabel('Input method').selectOption('json'); await page.getByLabel('Product items', { exact:true }).fill('[{"sku":"A"}]');
  await page.getByRole('button', { name:'Submit batch to workspace' }).click(); await expect(page.getByRole('alert')).toContainText('Each item needs'); expect(payload).toBeUndefined();
  const items = [{ sku:'A', title:'Product A', costPrice:125, currency:'EGP', casePackQuantity:2 }];
  await page.getByLabel('Product items', { exact:true }).fill(JSON.stringify(items)); await page.getByRole('button', { name:'Submit batch to workspace' }).click();
  await expect(page.locator('.workspace-notice')).toContainText('Batch recorded'); expect(payload).toEqual({ vendorAccountId:'vendor-2', batchReference:null, items });
});

test('both template downloads use authenticated API requests', async ({ page }) => {
  await page.route('**/api/bulk-upload/template/excel', route => route.fulfill({ contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body:'mock workbook' }));
  await page.route('**/api/vendor-accounts/template/csv', route => route.fulfill({ contentType:'text/csv', body:'Name,VendorCode,MarketplaceId,RefreshToken' }));
  await page.goto('/bulk-upload'); await page.getByRole('button', { name:'New batch' }).click();
  let download = page.waitForEvent('download'); await page.getByRole('button', { name:'Download Excel template' }).click(); expect((await download).suggestedFilename()).toBe('Amazon_Vendor_Product_Upload_Template.xlsx');
  await page.goto('/integration'); download = page.waitForEvent('download'); await page.getByRole('button', { name:'Download CSV template' }).click(); expect((await download).suggestedFilename()).toBe('Amazon_Vendor_Profiles_Template.csv');
});

test('vendor updates preserve blank secrets, test token exchange, and fetch masked credentials', async ({ page }) => {
  let payload: any;
  await page.route('**/api/vendor-accounts/vendor-0', async route => { if (route.request().method() === 'PUT') { payload = route.request().postDataJSON(); return route.fulfill({ json:{ ...vendors[0], ...payload } }); } return route.fulfill({ json:vendors[0] }); });
  await page.goto('/vendor-accounts'); await page.getByRole('button', { name:'Pentanela Egypt', exact:true }).click();
  await page.getByRole('button', { name:'Test connection', exact:true }).click();
  await expect(page.getByRole('status').filter({ hasText:'Amazon token exchange succeeded.' })).toBeVisible();
  await page.getByRole('button', { name:'View masked credentials', exact:true }).click(); await expect(page.getByText('fixture...masked', { exact:true })).toBeVisible();
  await page.getByLabel('Account name', { exact:true }).fill('Updated Egypt'); await page.getByRole('button', { name:'Save account', exact:true }).click();
  await expect(page.locator('.workspace-notice')).toContainText('Account updated'); expect(payload.refreshToken).toBe(''); expect(payload.customClientId).toBeNull(); expect(payload.customClientSecret).toBeNull(); expect(payload.name).toBe('Updated Egypt'); expect(payload.isActive).toBe(true);
});

test('vendor creation synchronizes the working-account selector', async ({ page }) => {
  let created: any;
  await page.route('**/api/vendor-accounts', async route => {
    if (route.request().method() === 'POST') { created = { ...vendors[0], ...route.request().postDataJSON(), id:'new-account' }; return route.fulfill({ status:201, json:created }); }
    return route.fulfill({ json:created ? [...vendors,created] : vendors });
  });
  await page.goto('/vendor-accounts'); await page.getByRole('button', { name:'Add account', exact:true }).click();
  await page.getByLabel('Account name', { exact:true }).fill('New account'); await page.getByLabel('Vendor code', { exact:true }).fill('NEW'); await page.getByLabel('Marketplace ID', { exact:true }).fill('new-market'); await page.getByLabel('Refresh token', { exact:true }).fill('fixture-refresh-token');
  await page.getByRole('button', { name:'Create account', exact:true }).click(); await expect(page.locator('#vendor-selector option[value="new-account"]')).toHaveText('New account');
  expect(created.refreshToken).toBe('fixture-refresh-token');
});

test('removing custom credentials is explicit and vendor deletion requires confirmation', async ({ page }) => {
  let payload: any; let deletes = 0;
  await page.route('**/api/vendor-accounts/vendor-0', async route => {
    if (route.request().method() === 'DELETE') { deletes++; return route.fulfill({ status:204 }); }
    if (route.request().method() === 'PUT') { payload = route.request().postDataJSON(); return route.fulfill({ json:vendors[0] }); }
    return route.fulfill({ json:vendors[0] });
  });
  await page.goto('/vendor-accounts'); await page.getByRole('button', { name:'Pentanela Egypt', exact:true }).click();
  await page.getByText('Custom application credentials (optional)', { exact:true }).click(); await page.getByLabel('Remove custom credentials and use shared application').check();
  await page.getByRole('button', { name:'Save account', exact:true }).click(); await expect(page.locator('.workspace-notice')).toContainText('Account updated'); expect(payload.customClientId).toBe(''); expect(payload.customClientSecret).toBe('');
  await page.getByRole('button', { name:'Pentanela Egypt', exact:true }).click(); await page.getByRole('button', { name:'Delete account', exact:true }).click(); expect(deletes).toBe(0);
  await page.getByRole('button', { name:'Confirm delete account', exact:true }).click(); await expect(page.locator('.workspace-notice')).toContainText('Account deleted'); expect(deletes).toBe(1);
});

test('application settings send UTC rotation and clear the replacement secret', async ({ page }) => {
  let payload: any;
  await page.route('**/api/amazon-credentials', async route => { if (route.request().method() === 'POST') { payload = route.request().postDataJSON(); return route.fulfill({ json:{ ...credential, ...payload, clientSecret:undefined } }); } return route.fulfill({ json:credential }); });
  await page.goto('/integration'); await page.getByLabel('Replacement client secret', { exact:true }).fill('fixture-new-secret'); await page.getByLabel('Rotation deadline (UTC, optional)').fill('2027-02-01');
  await page.getByRole('button', { name:'Save application credentials', exact:true }).click(); await expect(page.locator('.workspace-notice')).toContainText('Application credentials saved'); expect(payload.rotationDeadlineUtc).toBe('2027-02-01T00:00:00.000Z'); expect(payload.clientSecret).toBe('fixture-new-secret'); await expect(page.getByLabel('Replacement client secret', { exact:true })).toHaveValue('');
  expect(await page.evaluate(() => [localStorage.length,sessionStorage.length])).toEqual([0,0]);
});

test('profile JSON import handles partial results and forwards import options', async ({ page }) => {
  let payload: any;
  await page.route('**/api/vendor-accounts/upload-credentials', async route => { payload = route.request().postDataJSON(); await route.fulfill({ json:{ ...profileResult, failedCount:1, details:[{ ...profileResult.details[0], success:false, actionTaken:'Failed', errorMessage:'Refresh token rejected' }] } }); });
  await page.goto('/integration'); await page.getByLabel('Profile input method').selectOption('json');
  await page.getByLabel('Profile JSON', { exact:true }).fill('[{}]'); await page.getByRole('button', { name:'Import profiles', exact:true }).click(); await expect(page.getByRole('alert')).toContainText('Every profile needs'); expect(payload).toBeUndefined();
  const profiles = [{ name:'New vendor', vendorCode:'NEW', marketplaceId:'market', refreshToken:'fixture-token' }]; await page.getByLabel('Profile JSON', { exact:true }).fill(JSON.stringify(profiles)); await page.getByLabel('Overwrite existing profiles').check(); await page.getByLabel('Test tokens after import').check();
  await page.getByRole('button', { name:'Import profiles', exact:true }).click(); await expect(page.getByText('Refresh token rejected', { exact:true })).toBeVisible(); expect(payload).toEqual({ profiles, overwriteExisting:true, validateTokensImmediately:true }); await expect(page.getByLabel('Profile JSON', { exact:true })).toHaveValue('');
});

test('profile file import uses exact form fields and batch validation returns results', async ({ page }) => {
  let data = '';
  await page.route('**/api/vendor-accounts/upload-credentials-file', async route => { data = route.request().postDataBuffer()!.toString(); await route.fulfill({ json:profileResult }); });
  await page.goto('/integration'); await page.getByLabel('Profile file', { exact:true }).setInputFiles({ name:'profiles.csv', mimeType:'text/csv', buffer:Buffer.from('Name,VendorCode,MarketplaceId,RefreshToken\nFixture,NEW,market,fixture-token') });
  await page.getByRole('button', { name:'Import profiles', exact:true }).click(); await expect(page.getByRole('heading', { name:'Profile results' })).toBeVisible(); expect(data).toContain('name="OverwriteExisting"\r\n\r\nfalse'); expect(data).toContain('name="ValidateImmediately"\r\n\r\nfalse'); expect(data).toContain('filename="profiles.csv"');
  await expect(page.getByLabel('Profile file', { exact:true })).toHaveValue('');
  const request = page.waitForRequest(r => r.url().endsWith('/api/vendor-accounts/validate-all-credentials') && r.method() === 'POST'); await page.getByRole('button', { name:'Test all profile tokens', exact:true }).click(); await request;
});

test('team creation is admin-only and sends the selected role', async ({ page }) => {
  let payload: any;
  await page.route('**/api/auth/users', async route => { if (route.request().method() === 'POST') { payload = route.request().postDataJSON(); return route.fulfill({ status:201, json:{ ...user, ...payload, password:undefined } }); } return route.fulfill({ json:[user] }); });
  await page.goto('/employees'); await page.getByRole('button', { name:'Add team member', exact:true }).click();
  await page.getByLabel('Username', { exact:true }).fill('New member'); await page.getByLabel('Email', { exact:true }).fill('member@example.test'); await page.getByLabel('Initial password', { exact:true }).fill('fixture-password'); await page.getByRole('combobox', { name:'Role', exact:true }).selectOption('Admin'); await page.getByRole('button', { name:'Create team member', exact:true }).click(); await expect(page.locator('.workspace-notice')).toContainText('Team member created'); expect(payload).toEqual({ username:'New member', email:'member@example.test', password:'fixture-password', role:'Admin' });
});

test('non-admin does not fetch credentials or see account and application write controls', async ({ page }) => {
  await mockApi(page, 'User'); const credentialRequests: string[] = [];
  page.on('request', r => { if (['/api/amazon-credentials','/api/vendor-accounts/credentials'].includes(new URL(r.url()).pathname)) credentialRequests.push(r.url()); });
  await page.goto('/integration'); await expect(page.getByRole('heading', { name:'Connect a vendor account' })).toBeVisible(); await expect(page.getByRole('button', { name:'Save application credentials' })).toHaveCount(0); expect(credentialRequests).toEqual([]);
  await page.goto('/vendor-accounts'); await expect(page.getByRole('button', { name:'Add account', exact:true })).toHaveCount(0); await page.getByRole('button', { name:'Pentanela Egypt', exact:true }).click(); await expect(page.getByLabel('Account name', { exact:true })).toBeDisabled(); await expect(page.getByRole('button', { name:'Save account', exact:true })).toHaveCount(0);
});

test('switching account closes stale detail and draft panels', async ({ page }) => {
  await addProduct(page); await page.locator('#vendor-selector').selectOption('vendor-2'); await expect(page.getByRole('heading', { name:'Add a product' })).toHaveCount(0);
  await page.getByRole('button', { name:product.title, exact:true }).click(); await expect(page.getByRole('heading', { name:'Product details' })).toBeVisible(); await page.locator('#vendor-selector').selectOption('vendor-0'); await expect(page.getByRole('heading', { name:'Product details' })).toHaveCount(0);
});

test('an expired session during a business request returns to sign in', async ({ page }) => {
  await page.goto('/products'); await expect(page.locator('tbody tr')).toHaveCount(25); await page.route('**/api/products?**', route => route.fulfill({ status:401, json:{} })); await page.getByRole('button', { name:'Refresh records', exact:true }).click(); await expect(page).toHaveURL(/login/);
});

for (const width of [390,1440]) {
  test('new forms are accessible and fit at ' + width + 'px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height:1000 });
    const views = [
      { path:'/products', button:'Add product' }, { path:'/vendor-accounts', button:'Add account' },
      { path:'/purchase-orders', button:order.amazonOrderNumber }, { path:'/bulk-upload', button:'New batch' },
      { path:'/employees', button:'Add team member' }, { path:'/integration', button:'' },
    ];
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    for (const view of views) {
      await page.goto(view.path); if (view.button) await page.getByRole('button', { name:view.button, exact:true }).click();
      await expect(page.locator('#vendor-selector')).toBeEnabled();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      expect(results.violations.map(v => ({ id:v.id, nodes:v.nodes.map(n => ({ target:n.target, summary:n.failureSummary })) })), view.path).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), view.path).toBe(true);
      await page.screenshot({ path:testInfo.outputPath(view.path.slice(1) + '-' + width + '.png'), fullPage:true });
    }
    expect(errors).toEqual([]);
  });
}
