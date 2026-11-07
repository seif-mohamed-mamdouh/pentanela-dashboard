import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { VendorAccountDto, VendorAccountRequest, ConnectionTestResult } from '../models/api.models';
import { VendorContextService } from '../state/vendor-context.service';

@Injectable({ providedIn: 'root' })
export class VendorAccountsService {
  private readonly http = inject(HttpClient);
  private readonly context = inject(VendorContextService);
  private readonly accountState = signal<VendorAccountDto[]>([]);
  readonly accounts = this.accountState.asReadonly();
  getAll(): Observable<VendorAccountDto[]> {
    return this.http.get<VendorAccountDto[]>('/api/vendor-accounts').pipe(tap(accounts => {
      this.accountState.set(accounts);
      const selected = this.context.selected();
      if (selected) this.context.choose(accounts.find(account => account.id === selected.id) || null);
    }));
  }
  getById(id: string): Observable<VendorAccountDto> { return this.http.get<VendorAccountDto>(`/api/vendor-accounts/${encodeURIComponent(id)}`); }
  create(request: VendorAccountRequest): Observable<VendorAccountDto> {
    return this.http.post<VendorAccountDto>('/api/vendor-accounts', request);
  }
  update(id: string, request: VendorAccountRequest & { isActive: boolean }): Observable<VendorAccountDto> {
    return this.http.put<VendorAccountDto>(`/api/vendor-accounts/${encodeURIComponent(id)}`, request);
  }
  delete(id: string): Observable<void> { return this.http.delete<void>(`/api/vendor-accounts/${encodeURIComponent(id)}`); }
  testConnection(id: string): Observable<ConnectionTestResult> {
    return this.http.post<ConnectionTestResult>(`/api/vendor-accounts/${encodeURIComponent(id)}/test-connection`, {});
  }
}
