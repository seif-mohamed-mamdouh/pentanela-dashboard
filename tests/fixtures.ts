import { Page } from "@playwright/test";
export const user = {
  id: "team-1",
  username: "Nour Hassan",
  email: "nour@example.test",
  role: "Admin",
  isActive: true,
  createdAtUtc: "2026-01-01T12:00:00Z",
  lastLoginAtUtc: "2026-11-07T10:00:00Z",
};
export const vendors = [
  ["Pentanela Egypt", "PNEGY", "Egypt", "EU", "Valid", true],
  ["Nile Home Essentials", "NLHME", "Egypt", "EU", "Invalid", true],
  ["Pentanela Emirates", "PNUAE", "UAE", "EU", "Valid", true],
  ["Delta Living", "DELTA", "Saudi Arabia", "EU", "Unverified", true],
  ["Pentanela Europe", "PNEUR", "Germany", "EU", "Valid", true],
  ["Cairo Supply Co.", "CAIRO", "Egypt", "EU", "Unverified", false],
  ["Pentanela North America", "PNUSA", "United States", "NA", "Valid", true],
  ["Everyday Collection", "EVRYD", "United States", "NA", "Valid", true],
  ["Pentanela Japan", "PNJPN", "Japan", "FE", "Valid", true],
  ["Home & Kitchen", "HMKIT", "UAE", "EU", "Invalid", true],
  ["Eastern Trading", "EASTR", "Egypt", "EU", "Valid", true],
  ["Delta Essentials", "DELES", "Egypt", "EU", "Valid", true],
].map((v, i) => ({
  id: "vendor-" + i,
  name: v[0],
  vendorCode: v[1],
  marketplaceName: v[2],
  marketplaceId: "test-market",
  region: v[3],
  tokenStatus: v[4],
  isActive: v[5],
  hasCustomAppCredentials: false,
  lastTokenValidatedAtUtc: i === 3 ? null : "2026-11-06T11:00:00Z",
  createdAtUtc: "2026-01-01T12:00:00Z",
}));
export const summary = {
  totalVendorAccounts: 12,
  activeVendorAccounts: 11,
  totalProducts: 248,
  totalOpenPurchaseOrders: 18,
  totalBatchesProcessed: 32,
  pendingBatches: 3,
  totalOpenPoValue: 89500,
  appStatus: "Healthy",
  hasConfiguredCredentials: true,
  nextCredentialRotationDeadlineUtc: "2027-01-15T12:00:00Z",
};
export const product = {
  id:'product-0', vendorAccountId:'vendor-0', vendorAccountName:'Pentanela Egypt', sku:'PEN-0001',
  title:'Everyday ceramic serving set', asin:'TEST-ASIN', brand:'Pentanela', productType:'PRODUCT',
  barcodeType:'EAN', barcodeValue:'1234567890123', costPrice:380, currency:'EGP',
  casePackQuantity:6, innerPackQuantity:1, countryOfOrigin:'EG', status:'Draft', createdAtUtc:'2026-11-05T12:00:00Z',
};
export const order = {
  id:'po-1', vendorAccountId:'vendor-0', vendorAccountName:'Pentanela Egypt', amazonOrderNumber:'PO-2026-0148',
  itemsCount:2, totalAmount:24500, currency:'EGP', orderStatus:'New', purchaseOrderDateUtc:'2026-11-06T12:00:00Z',
  windowStartDateUtc:'2026-11-09T00:00:00Z', windowEndDateUtc:'2026-11-15T00:00:00Z',
  items:[
    { id:'item-1', sku:'PEN-0001', title:'Serving set', orderedQuantity:10, unitCost:380, currency:'EGP' },
    { id:'item-2', sku:'PEN-0002', title:'Kitchen set', orderedQuantity:5, unitCost:420, currency:'EGP' },
  ],
};
export const batch = {
  id:'batch-1', vendorAccountId:'vendor-0', vendorAccountName:'Pentanela Egypt', batchReference:'CATALOG-NOV-01',
  status:'Completed', totalItems:45, processedItems:45, successCount:44, errorCount:1, feedId:'STAGING-FEED-TEST',
  createdAtUtc:'2026-11-05T12:00:00Z', submittedAtUtc:'2026-11-05T12:00:00Z',
  items:[{ ...product, id:'batch-item-1', status:'Failed', errorMessage:'Barcode is required' }],
};
export const credential = { id:'credential-1', appName:'Pentanela SP-API', clientId:'fixture-client-id', maskedClientSecret:'fix...ret', isActive:true, rotationDeadlineUtc:'2027-01-15T00:00:00Z', createdAtUtc:'2026-01-01T12:00:00Z' };
export const profile = { ...vendors[0], maskedRefreshToken:'fixture...masked', hasCustomCredentials:false };
export const profileResult = { totalProcessed:1, createdCount:1, updatedCount:0, failedCount:0, details:[{ name:'Imported vendor', vendorCode:'NEW', marketplaceId:'market', success:true, actionTaken:'Created', tokenValidationResult:null }] };
export async function mockApi(page: Page, role = "Admin") {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown;
    if (url.pathname === "/api/auth/me") body = { ...user, role };
    else if (
      url.pathname === "/api/auth/login" ||
      url.pathname === "/api/auth/logout"
    )
      body = {};
    else if (url.pathname === "/api/auth/users") body = [user];
    else if (url.pathname === "/api/vendor-accounts") body = vendors;
    else if (url.pathname === "/api/dashboard/summary") body = summary;
    else if (url.pathname === '/api/amazon-credentials/status') body = { hasConfiguredCredentials:true };
    else if (url.pathname === '/api/amazon-credentials') body = credential;
    else if (url.pathname === '/api/vendor-accounts/credentials') body = [profile];
    else if (/\/api\/vendor-accounts\/[^/]+\/credentials$/.test(url.pathname)) body = profile;
    else if (/\/api\/vendor-accounts\/[^/]+\/test-connection$/.test(url.pathname)) body = { success:true, message:'Token exchanged', expiresInSeconds:3600 };
    else if (/\/api\/vendor-accounts\/vendor-\d+$/.test(url.pathname)) body = vendors.find(v => v.id === url.pathname.split('/').pop());
    else if (['/api/vendor-accounts/upload-credentials','/api/vendor-accounts/upload-credentials-file','/api/vendor-accounts/validate-all-credentials'].includes(url.pathname)) body = profileResult;
    else if (url.pathname.startsWith('/api/products/')) body = product;
    else if (url.pathname === '/api/purchase-orders/acknowledge') body = { success:true, message:'Acknowledged' };
    else if (url.pathname.startsWith('/api/purchase-orders/')) body = order;
    else if (url.pathname.startsWith('/api/bulk-upload/batches/')) body = batch;
    else if (url.pathname === '/api/bulk-upload' || url.pathname === '/api/bulk-upload/excel') body = batch;
    else if (url.pathname === "/api/products")
      body =
        Number(url.searchParams.get("page") || 1) > 1
          ? []
          : Array.from({ length: 25 }, (_, i) => ({
              ...product,
              id: "product-" + i,
              vendorAccountId:
                url.searchParams.get("vendorAccountId") || "vendor-0",
              vendorAccountName: "Pentanela Egypt",
              sku: "PEN-" + String(i + 1).padStart(4, "0"),
              title:
                i === 0
                  ? "Everyday ceramic serving set"
                  : "Kitchen collection " + (i + 1),
              asin: "TEST-ASIN",
              costPrice: 380 + i * 10,
              currency: "EGP",
              status: "Draft",
              createdAtUtc: "2026-11-05T12:00:00Z",
            }));
    else if (url.pathname === "/api/purchase-orders")
      body = [order];
    else if (url.pathname.startsWith("/api/bulk-upload/vendor/"))
      body = [batch];
    else {
      await route.fulfill({
        status: 501,
        json: { message: "Unmocked endpoint: " + url.pathname },
      });
      return;
    }
    await route.fulfill({ json: body });
  });
}
