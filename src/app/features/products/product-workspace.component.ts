import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OperationsApiService } from '../../core/services/operations-api.service';
import { VendorAccountsService } from '../../core/services/vendor-accounts.service';
import { VendorContextService } from '../../core/state/vendor-context.service';
import { NoticeService } from '../../core/state/notice.service';
import { CreateProductRequest, ProductDto } from '../../core/models/api.models';
import { apiError } from '../../core/utils/api-error';

@Component({ standalone: true, selector: 'app-product-workspace', imports: [FormsModule, DatePipe], template: `
<section class="panel workflow-panel" aria-labelledby="product-workspace-heading" [attr.aria-busy]="busy()">
 <div class="panel-heading"><h2 id="product-workspace-heading">{{ id() ? 'Product details' : 'Add a product' }}</h2><button class="secondary-button" type="button" (click)="closed.emit()" [disabled]="busy()">Close</button></div>
 @if (error()) { <p class="inline-error" role="alert">{{ error() }}</p> }
 @if (loading()) { <div class="skeleton list-skeleton" role="status" aria-label="Loading product"></div> }
 @else if (product(); as p) {
  <h3>{{ p.title }}</h3><dl class="details-list"><div><dt>SKU / ASIN</dt><dd>{{ p.sku }} / {{ p.asin || 'Not assigned' }}</dd></div><div><dt>Account</dt><dd>{{ p.vendorAccountName }}</dd></div><div><dt>Status</dt><dd>{{ p.status }}</dd></div><div><dt>Cost</dt><dd>{{ p.costPrice }} {{ p.currency }}</dd></div><div><dt>Brand / product type</dt><dd>{{ p.brand || 'Not set' }} / {{ p.productType }}</dd></div><div><dt>Barcode</dt><dd>{{ p.barcodeType }} {{ p.barcodeValue || 'Not set' }}</dd></div><div><dt>Case / inner pack</dt><dd>{{ p.casePackQuantity }} / {{ p.innerPackQuantity }}</dd></div><div><dt>Country of origin</dt><dd>{{ p.countryOfOrigin || 'Not set' }}</dd></div><div><dt>Created</dt><dd>{{ p.createdAtUtc | date:'medium' }}</dd></div></dl>
  @if (p.lastSubmissionError) { <p class="inline-error">{{ p.lastSubmissionError }}</p> }
  @if (confirmDelete()) { <div class="confirmation-box"><p>Delete {{ p.sku }} from this workspace? This cannot be undone.</p><div class="action-row"><button class="danger-button" type="button" (click)="remove()" [disabled]="busy()">{{ busy() ? 'Deleting…' : 'Confirm delete product' }}</button><button class="secondary-button" type="button" (click)="confirmDelete.set(false)" [disabled]="busy()">Keep product</button></div></div> }
  @else { <button class="danger-button mt-5" type="button" (click)="confirmDelete.set(true)">Delete product</button> }
 } @else if (!id()) {
  <form #productForm="ngForm" (ngSubmit)="save()"><fieldset [disabled]="busy()"><div class="form-grid">
   <label class="form-field full-width">Vendor account<select name="vendorAccountId" [(ngModel)]="form.vendorAccountId" required><option value="">Choose an account</option>@for (v of accounts.accounts(); track v.id) { <option [value]="v.id">{{ v.name || v.vendorCode }}</option> }</select></label>
   <label class="form-field">SKU<input name="sku" [(ngModel)]="form.sku" required maxlength="150"></label><label class="form-field">Title<input name="title" [(ngModel)]="form.title" required></label>
   <label class="form-field">Brand<input name="brand" [(ngModel)]="form.brand"></label><label class="form-field">Product type<input name="productType" [(ngModel)]="form.productType" required></label>
   <label class="form-field">Cost price<input name="costPrice" type="number" step="0.01" min="0.01" [(ngModel)]="form.costPrice" required></label><label class="form-field">Currency<input name="currency" [(ngModel)]="form.currency" pattern="[A-Za-z]{3}" maxlength="3" required></label>
   <label class="form-field">Barcode type<select name="barcodeType" [(ngModel)]="form.barcodeType"><option>EAN</option><option>UPC</option><option>GTIN</option><option>ISBN</option></select></label><label class="form-field">Barcode value<input name="barcodeValue" [(ngModel)]="form.barcodeValue"></label>
   <label class="form-field">Case pack quantity<input name="casePackQuantity" type="number" min="1" step="1" [(ngModel)]="form.casePackQuantity" required></label><label class="form-field">Inner pack quantity<input name="innerPackQuantity" type="number" min="1" step="1" [(ngModel)]="form.innerPackQuantity" required></label>
   <label class="form-field">Country of origin<input name="countryOfOrigin" [(ngModel)]="form.countryOfOrigin"></label>
  </div><p class="section-note">New products are saved as drafts. Use Bulk uploads to prepare a batch.</p><button class="primary-button" type="submit" [disabled]="productForm.invalid || !valid() || busy()">{{ busy() ? 'Saving…' : 'Create product' }}</button></fieldset></form>
 }
</section>` })
export class ProductWorkspaceComponent implements OnInit {
 readonly id = input(''); readonly closed = output<void>(); readonly changed = output<void>();
 private readonly api = inject(OperationsApiService); readonly accounts = inject(VendorAccountsService);
 private readonly context = inject(VendorContextService); private readonly notices = inject(NoticeService); private readonly destroyRef = inject(DestroyRef);
 readonly product = signal<ProductDto | null>(null); readonly loading = signal(false); readonly busy = signal(false); readonly error = signal(''); readonly confirmDelete = signal(false);
 form: CreateProductRequest = { vendorAccountId: this.context.selected()?.id || '', sku:'', title:'', brand:'', productType:'PRODUCT', barcodeType:'EAN', barcodeValue:'', costPrice:0, currency:'USD', casePackQuantity:1, innerPackQuantity:1, countryOfOrigin:'' };
 ngOnInit(): void { if (this.id()) { this.loading.set(true); this.api.product(this.id()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: p => { this.product.set(p); this.loading.set(false); }, error: e => { this.error.set(apiError(e)); this.loading.set(false); } }); } }
 valid(): boolean { return !!this.form.sku.trim() && !!this.form.title.trim() && this.form.costPrice > 0 && Number.isInteger(this.form.casePackQuantity) && Number.isInteger(this.form.innerPackQuantity); }
 save(): void {
  if (this.busy() || !this.valid() || !this.form.vendorAccountId) return;
  this.busy.set(true); this.error.set('');
  this.api.createProduct({ ...this.form, sku:this.form.sku.trim(), title:this.form.title.trim(), currency:this.form.currency.toUpperCase() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.notices.show('Product created', 'Your draft is saved.'); this.changed.emit(); this.closed.emit(); }, error: e => { this.error.set(apiError(e)); this.busy.set(false); } });
 }
 remove(): void { if (this.busy() || !this.confirmDelete()) return; this.busy.set(true); this.error.set(''); this.api.deleteProduct(this.id()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.notices.show('Product deleted'); this.changed.emit(); this.closed.emit(); }, error: e => { this.error.set(apiError(e)); this.busy.set(false); } }); }
}
