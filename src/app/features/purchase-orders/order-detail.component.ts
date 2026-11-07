import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OperationsApiService } from '../../core/services/operations-api.service';
import { PurchaseOrderDto, AcknowledgeItemRequest } from '../../core/models/api.models';
import { NoticeService } from '../../core/state/notice.service';
import { apiError } from '../../core/utils/api-error';

@Component({ standalone: true, selector: 'app-order-detail', imports: [FormsModule, DatePipe], template: `
<section class="panel workflow-panel" aria-labelledby="order-detail-heading" [attr.aria-busy]="busy()">
 <div class="panel-heading"><h2 id="order-detail-heading">Purchase order details</h2><button class="secondary-button" type="button" (click)="closed.emit()" [disabled]="busy()">Close</button></div>
 @if (error()) { <p class="inline-error" role="alert">{{ error() }}</p> }
 @if (loading()) { <div class="skeleton list-skeleton" role="status" aria-label="Loading purchase order"></div> }
 @if (order(); as o) {
  <h3>{{ o.amazonOrderNumber }}</h3><dl class="details-list"><div><dt>Vendor account</dt><dd>{{ o.vendorAccountName }}</dd></div><div><dt>Status / value</dt><dd>{{ o.orderStatus }} / {{ o.totalAmount }} {{ o.currency }}</dd></div><div><dt>Delivery window</dt><dd>{{ (o.windowStartDateUtc | date:'mediumDate') || 'Not set' }} to {{ (o.windowEndDateUtc | date:'mediumDate') || 'Not set' }}</dd></div><div><dt>Acknowledged</dt><dd>{{ (o.acknowledgedAtUtc | date:'medium') || 'Not yet' }}</dd></div></dl>
  <p class="section-note">Acknowledgments are saved to the workspace. This endpoint does not send an acknowledgment to Amazon.</p>
  <form #ackForm="ngForm" (ngSubmit)="save()"><fieldset [disabled]="busy() || o.orderStatus !== 'New'"><div class="order-lines">
   @for (item of o.items || []; track item.id; let i = $index) { <div class="order-line"><h3>{{ item.title }} <span class="muted">{{ item.sku }}</span></h3><p class="muted">{{ item.orderedQuantity }} ordered · {{ item.unitCost }} {{ item.currency }} each</p><div class="form-grid">
    <label class="form-field">Response for {{ item.sku }}<select [name]="'status' + i" [(ngModel)]="items[i].status" (ngModelChange)="statusChanged(i)"><option>Accepted</option><option>Rejected</option><option>Backordered</option></select></label>
    <label class="form-field">Quantity for {{ item.sku }}<input type="number" [name]="'quantity' + i" [(ngModel)]="items[i].acknowledgedQuantity" min="0" [max]="item.orderedQuantity" step="1" [readonly]="items[i].status === 'Rejected'" required></label>
    @if (items[i].status === 'Rejected') { <label class="form-field full-width">Rejection reason for {{ item.sku }}<input [name]="'reason' + i" [(ngModel)]="items[i].rejectionReason" required></label> }
   </div></div> } @empty { <p class="muted">No line items were returned for this order.</p> }
  </div>@if (o.orderStatus === 'New' && items.length) { <button class="primary-button mt-5" type="submit" [disabled]="busy() || ackForm.invalid || !valid()">{{ busy() ? 'Saving…' : 'Save acknowledgment' }}</button> }</fieldset></form>
 }
</section>` })
export class OrderDetailComponent implements OnInit {
 readonly id = input.required<string>(); readonly closed = output<void>(); readonly changed = output<void>();
 private readonly api = inject(OperationsApiService); private readonly notices = inject(NoticeService); private readonly destroyRef = inject(DestroyRef);
 readonly order = signal<PurchaseOrderDto | null>(null); readonly loading = signal(true); readonly busy = signal(false); readonly error = signal(''); items: AcknowledgeItemRequest[] = [];
 ngOnInit(): void { this.load(); }
 load(): void { this.loading.set(true); this.api.order(this.id()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: o => { this.order.set(o); this.items = (o.items || []).map(item => ({ itemId:item.id, status:item.acknowledgedStatus || 'Accepted', acknowledgedQuantity:item.acknowledgedQuantity ?? item.orderedQuantity, rejectionReason:item.rejectionReason || null })); this.loading.set(false); }, error: e => { this.error.set(apiError(e)); this.loading.set(false); } }); }
 statusChanged(index: number): void { const item = this.items[index]; item.acknowledgedQuantity = item.status === 'Rejected' ? 0 : this.order()?.items?.[index].orderedQuantity || 0; if (item.status !== 'Rejected') item.rejectionReason = null; }
 valid(): boolean { return !!this.items.length && this.items.every((item, i) => Number.isInteger(item.acknowledgedQuantity) && item.acknowledgedQuantity >= 0 && item.acknowledgedQuantity <= (this.order()?.items?.[i].orderedQuantity || 0) && (item.status !== 'Rejected' || !!item.rejectionReason?.trim())); }
 save(): void { if (this.busy() || !this.valid() || this.order()?.orderStatus !== 'New') return; this.busy.set(true); this.error.set(''); this.api.acknowledge(this.id(), this.items).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.busy.set(false); this.notices.show('Acknowledgment saved', 'The response is recorded in your workspace.'); this.changed.emit(); this.load(); }, error: e => { this.error.set(apiError(e)); this.busy.set(false); } }); }
}
