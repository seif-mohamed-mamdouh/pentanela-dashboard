import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ProductDto, CreateProductRequest, PurchaseOrderDto, AcknowledgeItemRequest,
  BulkUploadBatchDto, BulkUploadItemInput, CreateUserRequest, UserDto,
  AmazonCredentialDto, SaveAmazonCredentialRequest, ProfileCredentialDetailsDto,
  BulkProfileCredentialUploadRequest, BulkProfileCredentialUploadResult,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class OperationsApiService {
  private readonly http = inject(HttpClient);
  products(params: HttpParams): Observable<ProductDto[]> { return this.http.get<ProductDto[]>('/api/products', { params }); }
  product(id: string): Observable<ProductDto> { return this.http.get<ProductDto>(`/api/products/${encodeURIComponent(id)}`); }
  createProduct(request: CreateProductRequest): Observable<ProductDto> { return this.http.post<ProductDto>('/api/products', request); }
  deleteProduct(id: string): Observable<void> { return this.http.delete<void>(`/api/products/${encodeURIComponent(id)}`); }
  orders(params: HttpParams): Observable<PurchaseOrderDto[]> { return this.http.get<PurchaseOrderDto[]>('/api/purchase-orders', { params }); }
  order(id: string): Observable<PurchaseOrderDto> { return this.http.get<PurchaseOrderDto>(`/api/purchase-orders/${encodeURIComponent(id)}`); }
  acknowledge(orderId: string, items: AcknowledgeItemRequest[]): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>('/api/purchase-orders/acknowledge', { orderId, items });
  }
  batches(vendorId: string): Observable<BulkUploadBatchDto[]> { return this.http.get<BulkUploadBatchDto[]>(`/api/bulk-upload/vendor/${encodeURIComponent(vendorId)}`); }
  batch(id: string): Observable<BulkUploadBatchDto> { return this.http.get<BulkUploadBatchDto>(`/api/bulk-upload/batches/${encodeURIComponent(id)}`); }
  refreshBatch(id: string): Observable<BulkUploadBatchDto> { return this.http.post<BulkUploadBatchDto>(`/api/bulk-upload/batches/${encodeURIComponent(id)}/refresh`, {}); }
  submitItems(vendorAccountId: string, batchReference: string, items: BulkUploadItemInput[]): Observable<BulkUploadBatchDto> {
    return this.http.post<BulkUploadBatchDto>('/api/bulk-upload', { vendorAccountId, batchReference: batchReference || null, items });
  }
  uploadExcel(vendorId: string, file: File, reference: string): Observable<BulkUploadBatchDto> {
    const form = new FormData(); form.append('VendorAccountId', vendorId); form.append('File', file);
    if (reference.trim()) form.append('BatchReference', reference.trim());
    return this.http.post<BulkUploadBatchDto>('/api/bulk-upload/excel', form);
  }
  users(): Observable<UserDto[]> { return this.http.get<UserDto[]>('/api/auth/users'); }
  createUser(request: CreateUserRequest): Observable<UserDto> { return this.http.post<UserDto>('/api/auth/users', request); }
  credential(): Observable<AmazonCredentialDto | null> { return this.http.get<AmazonCredentialDto | null>('/api/amazon-credentials'); }
  credentialStatus(): Observable<{ hasConfiguredCredentials: boolean }> { return this.http.get<{ hasConfiguredCredentials: boolean }>('/api/amazon-credentials/status'); }
  saveCredential(request: SaveAmazonCredentialRequest): Observable<AmazonCredentialDto> { return this.http.post<AmazonCredentialDto>('/api/amazon-credentials', request); }
  profiles(): Observable<ProfileCredentialDetailsDto[]> { return this.http.get<ProfileCredentialDetailsDto[]>('/api/vendor-accounts/credentials'); }
  profile(id: string): Observable<ProfileCredentialDetailsDto> { return this.http.get<ProfileCredentialDetailsDto>(`/api/vendor-accounts/${encodeURIComponent(id)}/credentials`); }
  importProfiles(request: BulkProfileCredentialUploadRequest): Observable<BulkProfileCredentialUploadResult> { return this.http.post<BulkProfileCredentialUploadResult>('/api/vendor-accounts/upload-credentials', request); }
  importProfileFile(file: File, overwrite: boolean, validate: boolean): Observable<BulkProfileCredentialUploadResult> {
    const form = new FormData(); form.append('File', file); form.append('OverwriteExisting', String(overwrite)); form.append('ValidateImmediately', String(validate));
    return this.http.post<BulkProfileCredentialUploadResult>('/api/vendor-accounts/upload-credentials-file', form);
  }
  validateProfiles(): Observable<BulkProfileCredentialUploadResult> { return this.http.post<BulkProfileCredentialUploadResult>('/api/vendor-accounts/validate-all-credentials', {}); }
  downloadTemplate(kind: 'products' | 'profiles'): Observable<Blob> {
    return this.http.get(kind === 'products' ? '/api/bulk-upload/template/excel' : '/api/vendor-accounts/template/csv', { responseType: 'blob' });
  }
}
