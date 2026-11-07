import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VendorAccountsService } from '../../core/services/vendor-accounts.service';
import { OperationsApiService } from '../../core/services/operations-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { NoticeService } from '../../core/state/notice.service';
import { ProfileCredentialDetailsDto, VendorAccountRequest } from '../../core/models/api.models';
import { apiError } from '../../core/utils/api-error';

@Component({ standalone: true, selector: 'app-vendor-editor', imports: [FormsModule, DatePipe], template: `
<section class="panel workflow-panel" aria-labelledby="vendor-editor-heading" [attr.aria-busy]="busy()">
 <div class="panel-heading"><h2 id="vendor-editor-heading">{{ id() ? 'Account details' : 'Add vendor account' }}</h2><button class="secondary-button" type="button" (click)="closed.emit()" [disabled]="busy()">Close</button></div>
 @if (error()) { <p class="inline-error" role="alert">{{ error() }}</p> }
 @if (loading()) { <div class="skeleton list-skeleton" role="status" aria-label="Loading account"></div> }
 @else if (loaded()) {
  @if (id()) {
   <dl class="details-list"><div><dt>Credential status</dt><dd>{{ tokenStatus() }}</dd></div><div><dt>Last checked</dt><dd>{{ (validatedAt() | date:'medium') || 'Not checked' }}</dd></div></dl>
   @if (validationError()) { <p class="inline-error">{{ validationError() }}</p> }
   <div class="action-row mt-5"><button class="secondary-button" type="button" (click)="testConnection()" [disabled]="busy()">{{ busy() ? 'Please wait…' : 'Test connection' }}</button>@if (isAdmin()) { <button class="secondary-button" type="button" (click)="loadCredentials()" [disabled]="busy()">View masked credentials</button> }</div>
   @if (connectionMessage()) { <p class="scope-explanation" role="status">{{ connectionMessage() }}</p> }
   @if (credentials(); as c) { <dl class="details-list"><div><dt>Refresh token (masked)</dt><dd>{{ c.maskedRefreshToken }}</dd></div><div><dt>Custom client ID</dt><dd>{{ c.customClientId || 'Shared application' }}</dd></div><div><dt>Custom secret (masked)</dt><dd>{{ c.maskedCustomClientSecret || 'Shared application' }}</dd></div></dl> }
  }
  <form #vendorForm="ngForm" (ngSubmit)="save()"><fieldset [disabled]="busy() || !isAdmin()"><div class="form-grid">
   <label class="form-field">Account name<input name="name" [(ngModel)]="form.name" required></label><label class="form-field">Vendor code<input name="vendorCode" [(ngModel)]="form.vendorCode" required></label>
   <label class="form-field">Marketplace ID<input name="marketplaceId" [(ngModel)]="form.marketplaceId" required></label><label class="form-field">Marketplace name<input name="marketplaceName" [(ngModel)]="form.marketplaceName"></label>
   <label class="form-field">Region<select name="region" [(ngModel)]="form.region"><option value="NA">North America (NA)</option><option value="EU">Europe / Middle East (EU)</option><option value="FE">Far East (FE)</option></select></label><label class="form-field">Selling partner ID<input name="sellingPartnerId" [(ngModel)]="form.sellingPartnerId"></label>
   <label class="form-field">Contact email<input name="contactEmail" type="email" email [(ngModel)]="form.contactEmail"></label><label class="form-field">Refresh token {{ id() ? '(leave blank to keep)' : '' }}<input name="refreshToken" type="password" [(ngModel)]="form.refreshToken" autocomplete="new-password" [required]="!id()"></label>
   @if (id()) { <label class="check-field full-width"><input name="isActive" type="checkbox" [(ngModel)]="isActive">Account active</label> }
  </div>
  <details class="report-details"><summary>Custom application credentials (optional)</summary><p class="section-note">Leave both fields blank to {{ id() ? 'keep the current credentials' : 'use the shared Amazon application' }}.</p><div class="form-grid"><label class="form-field">Custom client ID<input name="customClientId" [(ngModel)]="form.customClientId" autocomplete="off" [disabled]="clearCustom"></label><label class="form-field">Custom client secret<input name="customClientSecret" type="password" [(ngModel)]="form.customClientSecret" autocomplete="new-password" [disabled]="clearCustom"></label>@if (id()) { <label class="check-field full-width"><input name="clearCustom" type="checkbox" [(ngModel)]="clearCustom">Remove custom credentials and use shared application</label> }</div></details>
  <label class="form-field">Notes<textarea name="notes" [(ngModel)]="form.notes" rows="3"></textarea></label>
  @if (isAdmin()) { <button class="primary-button mt-5" type="submit" [disabled]="vendorForm.invalid || busy() || !valid()">{{ busy() ? 'Saving…' : id() ? 'Save account' : 'Create account' }}</button> }
  </fieldset></form>
  @if (id() && isAdmin()) { @if (confirmDelete()) { <div class="confirmation-box"><p>Delete {{ form.name }} and its linked records? This action cannot be undone.</p><div class="action-row"><button class="danger-button" type="button" (click)="remove()" [disabled]="busy()">Confirm delete account</button><button class="secondary-button" type="button" (click)="confirmDelete.set(false)" [disabled]="busy()">Keep account</button></div></div> } @else { <button class="danger-button mt-5" type="button" (click)="confirmDelete.set(true)" [disabled]="busy()">Delete account</button> } }
 }
</section>` })
export class VendorEditorComponent implements OnInit {
 readonly id = input(''); readonly closed = output<void>(); readonly changed = output<void>(); private readonly api = inject(VendorAccountsService); private readonly operations = inject(OperationsApiService); private readonly auth = inject(AuthService); private readonly notices = inject(NoticeService); private readonly destroyRef = inject(DestroyRef);
 readonly isAdmin = computed(() => this.auth.user()?.role?.toLowerCase() === 'admin'); readonly loading = signal(false); readonly loaded = signal(false); readonly busy = signal(false); readonly error = signal(''); readonly confirmDelete = signal(false); readonly tokenStatus = signal(''); readonly validatedAt = signal<string | null>(null); readonly validationError = signal(''); readonly connectionMessage = signal(''); readonly credentials = signal<ProfileCredentialDetailsDto | null>(null);
 isActive = true; clearCustom = false;
 form: VendorAccountRequest = { name:'', vendorCode:'', marketplaceId:'', marketplaceName:'', region:'EU', sellingPartnerId:'', refreshToken:'', customClientId:'', customClientSecret:'', contactEmail:'', notes:'' };
 ngOnInit(): void {
  if (!this.id()) { this.loaded.set(true); return; }
  this.loading.set(true); this.api.getById(this.id()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: v => {
   this.form = { name:v.name || '', vendorCode:v.vendorCode || '', marketplaceId:v.marketplaceId || '', marketplaceName:v.marketplaceName || '', region:v.region || 'EU', sellingPartnerId:v.sellingPartnerId || '', refreshToken:'', customClientId:'', customClientSecret:'', contactEmail:v.contactEmail || '', notes:v.notes || '' };
   this.isActive = v.isActive; this.tokenStatus.set(v.tokenStatus || 'Unverified'); this.validatedAt.set(v.lastTokenValidatedAtUtc || null); this.validationError.set(v.lastValidationError || ''); this.loading.set(false); this.loaded.set(true);
  }, error: e => { this.error.set(apiError(e)); this.loading.set(false); } });
 }
 valid(): boolean { return !!this.form.name.trim() && !!this.form.vendorCode.trim() && !!this.form.marketplaceId.trim() && (!!this.id() || !!this.form.refreshToken.trim()) && (this.clearCustom || (!this.form.customClientId?.trim() && !this.form.customClientSecret?.trim()) || (!!this.form.customClientId?.trim() && !!this.form.customClientSecret?.trim())); }
 save(): void {
  if (this.busy() || !this.isAdmin() || !this.valid()) return; this.busy.set(true); this.error.set('');
  const request = { ...this.form, customClientId:this.clearCustom ? '' : this.form.customClientId?.trim() || null, customClientSecret:this.clearCustom ? '' : this.form.customClientSecret?.trim() || null };
  const action = this.id() ? this.api.update(this.id(), { ...request, isActive:this.isActive }) : this.api.create(request);
  action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.form.refreshToken = ''; this.form.customClientSecret = ''; this.notices.show(this.id() ? 'Account updated' : 'Account created'); this.changed.emit(); this.closed.emit(); }, error: e => { this.error.set(apiError(e)); this.busy.set(false); } });
 }
 testConnection(): void { if (this.busy()) return; this.busy.set(true); this.error.set(''); this.connectionMessage.set(''); this.api.testConnection(this.id()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: r => { this.connectionMessage.set(r.success ? 'Amazon token exchange succeeded. This verifies authorization, not product or order synchronization.' : r.message || 'Token exchange failed.'); this.busy.set(false); this.changed.emit(); this.reloadStatus(); }, error: e => { this.error.set(apiError(e)); this.busy.set(false); this.changed.emit(); this.reloadStatus(); } }); }
 private reloadStatus(): void { this.api.getById(this.id()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: v => { this.tokenStatus.set(v.tokenStatus || 'Unverified'); this.validatedAt.set(v.lastTokenValidatedAtUtc || null); this.validationError.set(v.lastValidationError || ''); }, error: () => this.connectionMessage.set('The test finished, but the saved account status could not be reloaded. Refresh the directory.') }); }
 loadCredentials(): void { if (this.busy() || !this.isAdmin()) return; this.busy.set(true); this.error.set(''); this.operations.profile(this.id()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: c => { this.credentials.set(c); this.busy.set(false); }, error: e => { this.error.set(apiError(e)); this.busy.set(false); } }); }
 remove(): void { if (this.busy() || !this.confirmDelete() || !this.isAdmin()) return; this.busy.set(true); this.error.set(''); this.api.delete(this.id()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.notices.show('Account deleted'); this.changed.emit(); this.closed.emit(); }, error: e => { this.error.set(apiError(e)); this.busy.set(false); } }); }
}
