import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OperationsApiService } from '../../core/services/operations-api.service';
import { VendorAccountsService } from '../../core/services/vendor-accounts.service';
import { VendorContextService } from '../../core/state/vendor-context.service';
import { NoticeService } from '../../core/state/notice.service';
import { BulkUploadBatchDto, BulkUploadItemInput } from '../../core/models/api.models';
import { apiError, saveDownload } from '../../core/utils/api-error';

@Component({ standalone: true, selector: 'app-batch-workspace', imports: [FormsModule, DatePipe], template: `
<section class="panel workflow-panel" aria-labelledby="batch-workspace-heading" [attr.aria-busy]="busy()">
 <div class="panel-heading"><h2 id="batch-workspace-heading">{{ id() ? 'Batch details' : 'New product batch' }}</h2><button class="secondary-button" type="button" (click)="closed.emit()" [disabled]="busy()">Close</button></div>
 <p class="scope-explanation">Batch processing is recorded by this backend. Its feed service currently uses staging behavior; a completed status does not confirm Amazon acceptance.</p>
 @if (error()) { <p class="inline-error" role="alert">{{ error() }}</p> }
 @if (loading()) { <div class="skeleton list-skeleton" role="status" aria-label="Loading batch"></div> }
 @if (batch(); as b) {
  <div class="panel-heading"><h3>{{ b.batchReference }}</h3><button class="secondary-button" type="button" (click)="refreshStatus()" [disabled]="busy()">{{ busy() ? 'Refreshing…' : 'Refresh batch status' }}</button></div>
  <dl class="details-list"><div><dt>Vendor</dt><dd>{{ b.vendorAccountName || b.vendorAccountId }}</dd></div><div><dt>Recorded status</dt><dd>{{ b.status }}</dd></div><div><dt>Progress</dt><dd>{{ b.processedItems }} / {{ b.totalItems }} processed · {{ b.successCount }} successful · {{ b.errorCount }} errors</dd></div><div><dt>Feed reference</dt><dd>{{ b.feedId || 'Not assigned' }}</dd></div><div><dt>Submitted</dt><dd>{{ (b.submittedAtUtc | date:'medium') || 'Not yet' }}</dd></div><div><dt>Completed</dt><dd>{{ (b.completedAtUtc | date:'medium') || 'Not yet' }}</dd></div></dl>
  @if (b.errorReportJson) { <details class="report-details"><summary>Processing report</summary><pre>{{ b.errorReportJson }}</pre></details> }
  <div class="table-scroller" tabindex="0" role="region" aria-label="Batch items"><table><thead><tr><th scope="col">Item</th><th scope="col">Cost</th><th scope="col">Recorded status</th><th scope="col">Error</th></tr></thead><tbody>@for (item of b.items || []; track item.id) { <tr><td>{{ item.title }}<small class="block muted">{{ item.sku }}</small></td><td>{{ item.costPrice }} {{ item.currency }}</td><td>{{ item.status }}</td><td>{{ item.errorMessage || 'None reported' }}</td></tr> } @empty { <tr><td colspan="4">No item details returned.</td></tr> }</tbody></table></div>
 } @else if (!id()) {
  <form #uploadForm="ngForm" (ngSubmit)="submit()"><fieldset [disabled]="busy()"><div class="form-grid">
   <label class="form-field">Vendor account<select name="vendorAccountId" [(ngModel)]="vendorId" required><option value="">Choose an account</option>@for (v of accounts.accounts(); track v.id) { <option [value]="v.id">{{ v.name || v.vendorCode }}</option> }</select></label><label class="form-field">Batch reference (optional)<input name="batchReference" [(ngModel)]="reference"></label>
   <label class="form-field full-width">Input method<select name="mode" [(ngModel)]="mode" (ngModelChange)="error.set('')"><option value="excel">Excel workbook</option><option value="json">Product items as JSON</option></select></label>
   @if (mode === 'excel') { <div class="form-field full-width"><label for="product-workbook">Product workbook (.xlsx)</label><input id="product-workbook" type="file" accept=".xlsx" (change)="chooseFile($event)"><button class="text-button" type="button" (click)="download()" [disabled]="downloading()">{{ downloading() ? 'Downloading…' : 'Download Excel template' }}</button></div> }
   @else { <div class="form-field full-width"><label for="batch-product-items">Product items</label><textarea id="batch-product-items" name="items" rows="9" [(ngModel)]="json" required spellcheck="false" [placeholder]="example" aria-describedby="batch-items-help"></textarea><small id="batch-items-help">Provide an array of products with sku, title, and a positive costPrice. Optional fields match the product template.</small></div> }
  </div><button class="primary-button" type="submit" [disabled]="busy() || uploadForm.invalid || (mode === 'excel' && !file)">{{ busy() ? 'Submitting batch…' : 'Submit batch to workspace' }}</button></fieldset></form>
 }
</section>` })
export class BatchWorkspaceComponent implements OnInit {
 readonly id = input(''); readonly closed = output<void>(); readonly changed = output<void>(); private readonly api = inject(OperationsApiService); readonly accounts = inject(VendorAccountsService); private readonly context = inject(VendorContextService); private readonly notices = inject(NoticeService); private readonly destroyRef = inject(DestroyRef);
 readonly loading = signal(false); readonly busy = signal(false); readonly downloading = signal(false); readonly error = signal(''); readonly batch = signal<BulkUploadBatchDto | null>(null);
 vendorId = this.context.selected()?.id || ''; reference = ''; mode = 'excel'; file: File | null = null; json = ''; readonly example = '[{"sku":"SKU-001","title":"Product title","costPrice":100,"currency":"EGP"}]';
 ngOnInit(): void { if (this.id()) { this.loading.set(true); this.api.batch(this.id()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: b => { this.batch.set(b); this.loading.set(false); }, error: e => { this.error.set(apiError(e)); this.loading.set(false); } }); } }
 chooseFile(event: Event): void { const input = event.target as HTMLInputElement; this.file = input.files?.[0] || null; this.error.set(''); if (this.file && (!/\.xlsx$/i.test(this.file.name) || !this.file.size)) { this.file = null; input.value = ''; this.error.set('Choose a non-empty .xlsx workbook.'); } }
 download(): void { if (this.downloading()) return; this.downloading.set(true); this.api.downloadTemplate('products').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: blob => { saveDownload(blob, 'Amazon_Vendor_Product_Upload_Template.xlsx'); this.downloading.set(false); }, error: e => { this.error.set(apiError(e)); this.downloading.set(false); } }); }
 submit(): void {
  if (this.busy() || !this.vendorId || (this.mode === 'excel' && !this.file)) return;
  this.error.set(''); let items: BulkUploadItemInput[] = [];
  if (this.mode === 'json') { try {
   const parsed: unknown = JSON.parse(this.json);
   if (!Array.isArray(parsed) || !parsed.length || !parsed.every(item => item && typeof item === 'object' && typeof item.sku === 'string' && item.sku.trim() && typeof item.title === 'string' && item.title.trim() && typeof item.costPrice === 'number' && Number.isFinite(item.costPrice) && item.costPrice > 0 && (item.casePackQuantity == null || (Number.isInteger(item.casePackQuantity) && item.casePackQuantity > 0)))) throw new Error();
   items = parsed;
  } catch { this.error.set('Enter a non-empty JSON array. Each item needs a SKU, title, positive cost price, and a positive whole case pack quantity when supplied.'); return; } }
  this.busy.set(true);
  const request = this.mode === 'excel' ? this.api.uploadExcel(this.vendorId, this.file!, this.reference) : this.api.submitItems(this.vendorId, this.reference.trim(), items);
  request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: b => { this.batch.set(b); this.file = null; this.json = ''; this.busy.set(false); this.notices.show('Batch recorded', 'Review the item results and recorded processing status.'); this.changed.emit(); }, error: e => { this.error.set(apiError(e)); this.busy.set(false); } });
 }
 refreshStatus(): void { const b = this.batch(); if (!b || this.busy()) return; this.busy.set(true); this.error.set(''); this.api.refreshBatch(b.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: result => { this.batch.set(result); this.busy.set(false); this.changed.emit(); }, error: e => { this.error.set(apiError(e)); this.busy.set(false); } }); }
}
