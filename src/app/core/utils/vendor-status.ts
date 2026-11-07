import { VendorAccountDto } from '../models/api.models';

export type VendorHealth = 'connected' | 'attention' | 'inactive';
export function vendorHealth(v: VendorAccountDto): VendorHealth {
  if (!v.isActive) return 'inactive';
  return v.tokenStatus?.toLowerCase() === 'valid' ? 'connected' : 'attention';
}
export function vendorHealthLabel(v: VendorAccountDto): string {
  if (!v.isActive) return 'Inactive';
  if (v.tokenStatus?.toLowerCase() === 'valid') return 'Verified';
  return v.tokenStatus || 'Needs verification';
}
