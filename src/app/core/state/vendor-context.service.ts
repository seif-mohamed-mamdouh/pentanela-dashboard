import { Injectable, signal } from '@angular/core';
import { VendorAccountDto } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class VendorContextService {
  // In-memory context only. No seller IDs, secrets or authorization material in persistent browser storage.
  private readonly selectedState = signal<VendorAccountDto | null>(null);
  readonly selected = this.selectedState.asReadonly();
  choose(vendor: VendorAccountDto | null): void { this.selectedState.set(vendor); }
  clear(): void { this.selectedState.set(null); }
}