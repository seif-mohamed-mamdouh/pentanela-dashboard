// Response and request contracts matched to the supplied OpenAPI document and .NET DTOs.
export interface UserDto {
  id: string; username?: string | null; email?: string | null; role?: string | null;
  isActive: boolean; lastLoginAtUtc?: string | null; createdAtUtc: string;
}
export interface LoginRequest { usernameOrEmail: string; password: string; }
export interface ProductDto {
  id: string; vendorAccountId: string; vendorAccountName?: string | null;
  sku: string; asin?: string | null; title: string; brand?: string | null;
  productType: string; barcodeType?: string | null; barcodeValue?: string | null;
  casePackQuantity: number; innerPackQuantity: number; countryOfOrigin?: string | null;
  lastSubmissionError?: string | null;
  costPrice: number; currency: string; status: string; createdAtUtc: string;
}
export interface PurchaseOrderDto {
  id: string; vendorAccountId: string; vendorAccountName?: string | null;
  amazonOrderNumber: string; purchaseOrderDateUtc: string; orderStatus: string;
  totalAmount: number; currency: string; itemsCount: number;
  windowStartDateUtc?: string | null; windowEndDateUtc?: string | null;
  acknowledgedAtUtc?: string | null; items?: PurchaseOrderItemDto[] | null;
}
export interface BulkUploadBatchDto {
  id: string; vendorAccountId: string; vendorAccountName?: string | null;
  batchReference: string; status: string; totalItems: number; errorCount: number; createdAtUtc: string;
  feedId?: string | null; feedDocumentId?: string | null; processedItems: number; successCount: number;
  errorReportJson?: string | null; submittedAtUtc?: string | null; completedAtUtc?: string | null;
  items?: BulkUploadItemDto[] | null;
}
// Backend currently returns a token *as well as* issuing a cookie. The UI never reads/stores that token.
export interface DashboardSummaryDto {
  totalVendorAccounts: number; activeVendorAccounts: number; totalProducts: number;
  totalOpenPurchaseOrders: number; totalBatchesProcessed: number; pendingBatches: number;
  totalOpenPoValue: number; appStatus?: string | null;
  hasConfiguredCredentials: boolean; nextCredentialRotationDeadlineUtc?: string | null;
}
export interface VendorAccountDto {
  id: string; name?: string | null; vendorCode?: string | null;
  marketplaceId?: string | null; marketplaceName?: string | null;
  region?: string | null; sellingPartnerId?: string | null;
  tokenStatus?: string | null; lastTokenValidatedAtUtc?: string | null;
  lastValidationError?: string | null; hasCustomAppCredentials: boolean;
  isActive: boolean; contactEmail?: string | null; notes?: string | null;
  createdAtUtc: string;
}

export interface CreateProductRequest {
  vendorAccountId: string; sku: string; title: string; brand: string; productType: string;
  barcodeType: string; barcodeValue: string; costPrice: number; currency: string;
  casePackQuantity: number; innerPackQuantity: number; countryOfOrigin: string;
}
export type AcknowledgmentStatus = 'Accepted' | 'Rejected' | 'Backordered';
export interface PurchaseOrderItemDto {
  id: string; sku: string; asin?: string | null; title: string; orderedQuantity: number;
  unitCost: number; currency: string; acknowledgedStatus?: AcknowledgmentStatus | null;
  acknowledgedQuantity?: number | null; rejectionReason?: string | null;
}
export interface AcknowledgeItemRequest { itemId: string; status: AcknowledgmentStatus; acknowledgedQuantity: number; rejectionReason: string | null; }
export interface BulkUploadItemInput {
  sku: string; title: string; costPrice: number; brand?: string | null; productType?: string | null;
  barcodeType?: string | null; barcodeValue?: string | null; currency?: string | null; casePackQuantity?: number | null;
}
export interface BulkUploadItemDto extends BulkUploadItemInput { id: string; status: string; errorMessage?: string | null; }
export interface CreateUserRequest { username: string; email: string; password: string; role: 'User' | 'Admin'; }
export interface VendorAccountRequest {
  name: string; vendorCode: string; marketplaceId: string; marketplaceName: string; region: string;
  sellingPartnerId: string; refreshToken: string; customClientId: string | null;
  customClientSecret: string | null; contactEmail: string; notes: string;
}
export interface AmazonCredentialDto {
  id: string; appName: string; clientId: string; maskedClientSecret: string;
  rotationDeadlineUtc?: string | null; isActive: boolean; notes?: string | null; createdAtUtc: string;
}
export interface SaveAmazonCredentialRequest { appName: string; clientId: string; clientSecret: string; rotationDeadlineUtc: string | null; notes: string; }
export interface ProfileCredentialDetailsDto {
  id: string; name: string; vendorCode: string; marketplaceId: string; marketplaceName: string; region: string;
  sellingPartnerId?: string | null; maskedRefreshToken: string; customClientId?: string | null;
  maskedCustomClientSecret?: string | null; hasCustomCredentials: boolean; tokenStatus: string;
  lastTokenValidatedAtUtc?: string | null; lastValidationError?: string | null; isActive: boolean; createdAtUtc: string;
}
export interface ProfileUploadResultItem {
  vendorCode: string; marketplaceId: string; name: string; success: boolean; actionTaken: string;
  errorMessage?: string | null; tokenValidationResult?: string | null;
}
export interface BulkProfileCredentialUploadResult {
  totalProcessed: number; createdCount: number; updatedCount: number; failedCount: number; details: ProfileUploadResultItem[];
}
export interface BulkProfileCredentialUploadRequest { profiles: VendorAccountRequest[]; overwriteExisting: boolean; validateTokensImmediately: boolean; }
export interface ConnectionTestResult { success: boolean; message: string; expiresInSeconds?: number; tokenType?: string; }
