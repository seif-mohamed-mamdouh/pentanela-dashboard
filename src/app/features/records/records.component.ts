import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon.component';
import { VendorContextService } from '../../core/state/vendor-context.service';
import { ProductDto, PurchaseOrderDto, BulkUploadBatchDto, UserDto } from '../../core/models/api.models';
import { FormsModule } from '@angular/forms';
import { ProductWorkspaceComponent } from '../products/product-workspace.component';
import { OrderDetailComponent } from '../purchase-orders/order-detail.component';
import { BatchWorkspaceComponent } from '../bulk-upload/batch-workspace.component';
import { TeamFormComponent } from '../team/team-form.component';
import { OperationsApiService } from '../../core/services/operations-api.service';
import { Observable } from 'rxjs';

type RecordKind = 'products' | 'orders' | 'batches' | 'team';
interface DisplayRow { id: string; title: string; subtitle: string; owner: string; status: string; value: string; date: string; }
@Component({ standalone: true, imports: [RouterLink, IconComponent, FormsModule, ProductWorkspaceComponent, OrderDetailComponent, BatchWorkspaceComponent, TeamFormComponent], template: `
 <section class="page-heading"><div><p class="eyebrow">{{ kind === 'team' ? 'WORKSPACE MANAGEMENT' : 'DAILY OPERATIONS' }}</p><h1>{{ title }}<span class="gold-period">.</span></h1><p class="page-description">{{ description }}</p></div><div class="action-row"><button class="secondary-button" type="button" (click)="refresh.update(increment)" [disabled]="loading() || needsAccount()"><app-icon name="refresh" [size]="17" />Refresh records</button>@if (kind !== 'orders') { <button class="primary-button" type="button" (click)="openCreate()">{{ kind === 'products' ? 'Add product' : kind === 'batches' ? 'New batch' : 'Add team member' }}</button> }</div></section>
 <div class="scope-line"><span><span class="scope-dot"></span>{{ kind === 'team' ? 'Company team' : context.selected()?.name || 'All vendor accounts' }}</span><span>Saved workspace records</span></div>
 @if (kind === 'batches') { <p class="scope-explanation">Recorded batch statuses do not confirm Amazon acceptance. Open a batch to inspect its item results.</p> }
 @if (editor()) {
  @if (kind === 'products') { <app-product-workspace (closed)="editor.set(false)" (changed)="refresh.update(increment)" /> }
  @if (kind === 'batches') { <app-batch-workspace (closed)="editor.set(false)" (changed)="refresh.update(increment)" /> }
  @if (kind === 'team') { <app-team-form (closed)="editor.set(false)" (changed)="refresh.update(increment)" /> }
 }
 @for (id of detailId() ? [detailId()] : []; track id) {
  @if (kind === 'products') { <app-product-workspace [id]="id" (closed)="detailId.set('')" (changed)="refresh.update(increment)" /> }
  @if (kind === 'orders') { <app-order-detail [id]="id" (closed)="detailId.set('')" (changed)="refresh.update(increment)" /> }
  @if (kind === 'batches') { <app-batch-workspace [id]="id" (closed)="detailId.set('')" (changed)="refresh.update(increment)" /> }
 }
 <section class="panel directory-panel">
  @if (needsAccount()) { <div class="empty-state"><app-icon name="accounts" [size]="34" /><h2>Choose a vendor to see upload history</h2><p>Select a working account in the top bar, or find one in your account directory.</p><a class="secondary-button" routerLink="/vendor-accounts">Browse accounts <app-icon name="arrow" [size]="16" /></a></div> }
  @else {
   <form class="filters-row" (ngSubmit)="applySearch()"><label class="search-field"><app-icon name="search" [size]="18" /><input type="search" [attr.aria-label]="kind === 'products' ? 'Search catalog' : 'Search displayed records'" [placeholder]="kind === 'products' ? 'Search SKU, title, or brand…' : 'Search displayed records…'" [value]="query()" (input)="searchInput($any($event.target).value)"></label>@if (kind === 'products') { <button class="secondary-button" type="submit">Search</button> }@if (paginated) { <select class="filter-select" aria-label="Filter by status" [value]="status()" (change)="filterStatus($any($event.target).value)"><option value="">All statuses</option>@for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }</select> }<span class="muted">{{ loading() ? 'Loading…' : rows().length + ' records loaded' }}</span></form>
   @if (loading()) { <div class="loading-state px-6" role="status"><div class="skeleton list-skeleton"></div><div class="skeleton list-skeleton"></div><span class="sr-only">Loading records</span></div> }
   @else if (error()) { <div class="empty-state"><app-icon name="alert" [size]="30" /><h2>Records are unavailable</h2><p role="alert">{{ error() }}</p><button class="secondary-button" type="button" (click)="refresh.update(increment)">Try again</button></div> }
   @else if (!filtered().length) { <div class="empty-state"><app-icon [name]="kind === 'orders' ? 'orders' : kind === 'batches' ? 'upload' : kind === 'team' ? 'users' : 'box'" [size]="34" /><h2>{{ query() ? 'No matching records' : 'No records to show yet' }}</h2><p>{{ query() ? 'Try a different search within the loaded records.' : 'Records will appear when they are available for this account and page.' }}</p>@if (query()) { <button type="button" class="secondary-button" (click)="query.set('')">Clear search</button> }</div> }
   @else {
    <div class="table-scroller" tabindex="0" role="region" [attr.aria-label]="title"><table><caption class="sr-only">{{ title }}: workspace records</caption><thead><tr><th scope="col">{{ kind === 'team' ? 'Team member' : kind === 'orders' ? 'Purchase order' : kind === 'batches' ? 'Batch reference' : 'Product' }}</th><th scope="col">{{ kind === 'team' ? 'Role' : 'Vendor account' }}</th><th scope="col">{{ kind === 'batches' ? 'Recorded status' : 'Status' }}</th><th scope="col">{{ kind === 'team' ? 'Last sign-in' : kind === 'batches' ? 'Items' : 'Value' }}</th><th scope="col">{{ kind === 'orders' ? 'Order date' : 'Created' }}</th></tr></thead><tbody>
    @for (row of filtered(); track row.id) { <tr><td><div class="vendor-cell"><span>@if (kind === 'team') { <b>{{ row.title }}</b> } @else { <button class="record-link" type="button" (click)="openDetails(row.id)">{{ row.title }}</button> }<small>{{ row.subtitle }}</small></span></div></td><td>{{ row.owner }}</td><td><span class="status-tag tag-neutral">{{ row.status }}</span></td><td class="whitespace-nowrap">{{ row.value }}</td><td class="whitespace-nowrap">{{ row.date }}</td></tr> }
    </tbody></table></div>
   }
   @if (paginated) { <div class="table-footer"><span>Page {{ page() }} · {{ kind === 'products' ? 'Search applies to the catalog' : 'Search applies to this page' }}</span><div class="flex gap-2"><button class="pagination-button" type="button" [disabled]="page() === 1 || loading()" (click)="previous()">Previous</button><button class="pagination-button" type="button" [disabled]="!hasNext() || loading() || !!error()" (click)="next()">Next</button></div></div> }
  }
 </section>
 <p class="data-note"><app-icon name="info" [size]="14" />{{ kind === 'team' ? 'Administrators can create team members. Role editing is not supported by this API.' : 'These are saved workspace records. Live Amazon synchronization is not yet enabled.' }}</p>` })
export class RecordsComponent {
 private readonly data = inject(ActivatedRoute).snapshot.data;
 private readonly api = inject(OperationsApiService);
 readonly context = inject(VendorContextService);
 readonly kind = this.data['kind'] as RecordKind;
 readonly title = this.data['title'] as string;
 readonly description = this.data['description'] as string;
 readonly paginated = this.kind === 'products' || this.kind === 'orders';
 readonly page = signal(1); readonly query = signal(''); readonly refresh = signal(0);
 readonly editor = signal(false); readonly detailId = signal(''); readonly status = signal(''); readonly serverSearch = signal('');
 readonly statuses = this.kind === 'products' ? ['Draft','ReadyForSubmission','Submitted','Live','Rejected'] : ['New','Acknowledged','Shipped','Closed','Cancelled'];
 readonly loading = signal(false); readonly error = signal(''); readonly hasNext = signal(false);
 readonly rows = signal<DisplayRow[]>([]);
 readonly needsAccount = computed(() => this.kind === 'batches' && !this.context.selected());
 readonly filtered = computed(() => this.kind === 'products' ? this.rows() : this.rows().filter(row => [row.title,row.subtitle,row.owner,row.status].join(' ').toLowerCase().includes(this.query().trim().toLowerCase())));
 readonly increment = (n: number) => n + 1;
 constructor() {
  effect(() => { this.context.selected()?.id; this.page.set(1); this.query.set(''); this.serverSearch.set(''); this.editor.set(false); this.detailId.set(''); });
  effect(onCleanup => {
   const account = this.context.selected()?.id; const page = this.page(); this.refresh();
   const status = this.status(); const search = this.serverSearch();
   this.rows.set([]); this.error.set(''); this.hasNext.set(false);
   if (this.kind === 'batches' && !account) { this.loading.set(false); return; }
   this.loading.set(true);
   let params = new HttpParams();
   if (this.paginated) { params = params.set('page',page).set('pageSize',25); if (account) params = params.set('vendorAccountId',account); }
   if (this.paginated && status) params = params.set('status', status);
   if (this.kind === 'products' && search) params = params.set('search', search);
   const request: Observable<(ProductDto | PurchaseOrderDto | BulkUploadBatchDto | UserDto)[]> = this.kind === 'products' ? this.api.products(params) : this.kind === 'orders' ? this.api.orders(params) : this.kind === 'team' ? this.api.users() : this.api.batches(account!);
   const subscription = request.subscribe({
    next: records => { this.rows.set(records.map(record => this.display(record))); this.hasNext.set(this.paginated && records.length === 25); this.loading.set(false); },
    error: e => { this.error.set(e.status === 403 ? 'Your account does not have access to these records.' : 'We could not load these records. Please try again.'); this.loading.set(false); }
   });
   onCleanup(() => subscription.unsubscribe());
  });
 }
 openCreate(): void { this.detailId.set(''); this.editor.set(true); }
 openDetails(id: string): void { this.editor.set(false); this.detailId.set(id); window.scrollTo({ top:0, behavior:'instant' }); }
 searchInput(value: string): void { this.query.set(value); if (this.kind === 'products' && !value) this.applySearch(); }
 applySearch(): void { if (this.kind === 'products') { this.page.set(1); this.serverSearch.set(this.query().trim()); } }
 filterStatus(value: string): void { this.page.set(1); this.status.set(value); }
 previous(): void { if (this.kind !== 'products') this.query.set(''); this.page.update(p => Math.max(1,p - 1)); }
 next(): void { if (this.kind !== 'products') this.query.set(''); this.page.update(p => p + 1); }
 private date(value?: string | null): string { if (!value) return 'Not recorded'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'short', year:'numeric' }).format(date); }
 private amount(value: number, currency: string): string { return new Intl.NumberFormat('en-GB', { maximumFractionDigits:2, minimumFractionDigits:2 }).format(value) + ' ' + currency; }
 private display(value: ProductDto | PurchaseOrderDto | BulkUploadBatchDto | UserDto): DisplayRow {
  if (this.kind === 'products') { const v = value as ProductDto; return { id:v.id, title:v.title, subtitle:v.sku + (v.asin ? ' · ' + v.asin : ''), owner:v.vendorAccountName || 'Unnamed account', status:v.status, value:this.amount(v.costPrice,v.currency), date:this.date(v.createdAtUtc) }; }
  if (this.kind === 'orders') { const v = value as PurchaseOrderDto; return { id:v.id, title:v.amazonOrderNumber, subtitle:v.itemsCount + ' items', owner:v.vendorAccountName || 'Unnamed account', status:v.orderStatus, value:this.amount(v.totalAmount,v.currency), date:this.date(v.purchaseOrderDateUtc) }; }
  if (this.kind === 'batches') { const v = value as BulkUploadBatchDto; return { id:v.id, title:v.batchReference || 'Unnamed batch', subtitle:'Acceptance not verified', owner:v.vendorAccountName || 'Unnamed account', status:v.status, value:v.totalItems + ' total · ' + v.errorCount + ' errors', date:this.date(v.createdAtUtc) }; }
  const v = value as UserDto; return { id:v.id, title:v.username || 'Team member', subtitle:v.email || '', owner:v.role || 'User', status:v.isActive ? 'Active' : 'Inactive', value:this.date(v.lastLoginAtUtc), date:this.date(v.createdAtUtc) };
 }
}
