import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VendorAccountsService } from '../../core/services/vendor-accounts.service';
import { VendorContextService } from '../../core/state/vendor-context.service';
import { NoticeService } from '../../core/state/notice.service';
import { VendorAccountDto } from '../../core/models/api.models';
import { vendorHealth, vendorHealthLabel, VendorHealth } from '../../core/utils/vendor-status';
import { IconComponent } from '../../shared/icon.component';
import { VendorEditorComponent } from './vendor-editor.component';
import { AuthService } from '../../core/auth/auth.service';
@Component({ standalone: true, imports: [DatePipe, RouterLink, IconComponent, VendorEditorComponent], templateUrl: './vendor-accounts.component.html' })
export class VendorAccountsComponent implements OnInit {
 readonly context = inject(VendorContextService);
 private readonly auth = inject(AuthService);
 readonly isAdmin = computed(() => this.auth.user()?.role?.toLowerCase() === 'admin');
 readonly editorId = signal<string | null>(null);
 private readonly notices = inject(NoticeService);
 private readonly api = inject(VendorAccountsService);
 private readonly route = inject(ActivatedRoute);
 private readonly destroyRef = inject(DestroyRef);
 readonly loading = signal(false); readonly error = signal('');
 readonly vendors = signal<VendorAccountDto[]>([]);
 readonly query = signal(''); readonly statusFilter = signal('all'); readonly regionFilter = signal('');
 readonly page = signal(1); readonly pageSize = 8;
 readonly filters = [{ value: 'all', label: 'All accounts' }, { value: 'connected', label: 'Verified' }, { value: 'attention', label: 'Needs review' }, { value: 'inactive', label: 'Inactive' }];
 readonly regions = computed(() => [...new Set(this.vendors().map(v => v.region).filter((r): r is string => Boolean(r)))].sort());
 readonly filtered = computed(() => {
  const term = this.query().trim().toLowerCase();
  return this.vendors().filter(v => (this.statusFilter() === 'all' || vendorHealth(v) === this.statusFilter()) && (!this.regionFilter() || v.region === this.regionFilter()) && (!term || [v.name, v.vendorCode, v.marketplaceId, v.marketplaceName, v.region, v.sellingPartnerId].some(x => x?.toLowerCase().includes(term))));
 });
 readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
 readonly visible = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
 constructor() { effect(() => { this.query(); this.statusFilter(); this.regionFilter(); this.page.set(1); }); }
 ngOnInit(): void {
  this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
   const status = params.get('status') || 'all';
   this.statusFilter.set(this.filters.some(f => f.value === status) ? status : 'all'); this.query.set(params.get('q') || '');
  });
  this.reload();
 }
 reload(): void {
  if (this.loading()) return;
  this.loading.set(true); this.error.set(''); this.vendors.set([]); this.page.set(1);
  this.api.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
   next: result => { this.vendors.set(result); this.loading.set(false); },
   error: () => { this.error.set('Your accounts could not load. Please try again.'); this.loading.set(false); }
  });
 }
 count(status: string): number { return status === 'all' ? this.vendors().length : this.vendors().filter(v => vendorHealth(v) === status).length; }
 health = vendorHealth; label = vendorHealthLabel;
 choose(v: VendorAccountDto): void { this.context.choose(v); this.notices.show('Working account updated', (v.name || v.vendorCode || 'This account') + ' is selected for products and purchase orders.'); }
 clearFilters(): void { this.query.set(''); this.statusFilter.set('all'); this.regionFilter.set(''); }
}
