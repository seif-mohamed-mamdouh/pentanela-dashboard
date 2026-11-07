import { Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { OperationsApiService } from '../../core/services/operations-api.service';
import { VendorAccountsService } from '../../core/services/vendor-accounts.service';
import { AuthService } from '../../core/auth/auth.service';
import { NoticeService } from '../../core/state/notice.service';
import { AmazonCredentialDto, ProfileCredentialDetailsDto, BulkProfileCredentialUploadResult, VendorAccountRequest } from '../../core/models/api.models';
import { apiError, saveDownload } from '../../core/utils/api-error';
import { IconComponent } from '../../shared/icon.component';

@Component({ standalone: true, imports: [RouterLink, FormsModule, DatePipe, IconComponent], template: `
<section class="page-heading"><div><p class="eyebrow">AMAZON VENDOR CENTRAL</p><h1>Amazon connection<span class="gold-period">.</span></h1><p class="page-description">Configure your application and manage vendor authorization.</p></div><a class="secondary-button" routerLink="/vendor-accounts">View vendor accounts <app-icon name="arrow" [size]="17" /></a></section>
<p class="scope-explanation">Connection tests verify Amazon token exchange. Catalog batches use the backend’s staging feed service, and order acknowledgments are saved locally.</p>
<div class="integration-layout">
 <section class="panel" aria-labelledby="app-credentials-heading"><div class="panel-heading"><div><p class="eyebrow">SHARED APPLICATION</p><h2 id="app-credentials-heading">Application credentials</h2></div><button class="icon-button" type="button" aria-label="Refresh application credentials" (click)="loadApp()" [disabled]="appBusy() || appLoading()"><app-icon name="refresh" /></button></div>
  @if (appLoading()) { <div class="skeleton chart-skeleton" role="status" aria-label="Loading application credentials"></div> }
  @else {
   @if (appError()) { <p class="inline-error" role="alert">{{ appError() }}</p> }
   <dl class="details-list"><div><dt>Configuration</dt><dd>{{ configured() === null ? 'Unavailable' : configured() ? 'Configured' : 'Not configured' }}</dd></div><div><dt>Application</dt><dd>{{ credential()?.appName || 'Not reported' }}</dd></div><div><dt>Secret</dt><dd>{{ credential()?.maskedClientSecret || 'Not reported' }}</dd></div><div><dt>Rotation deadline</dt><dd>{{ (credential()?.rotationDeadlineUtc | date:'mediumDate':'UTC') || 'Not set' }}</dd></div></dl>
   @if (isAdmin()) {
    <form #credentialForm="ngForm" (ngSubmit)="saveApp()"><fieldset [disabled]="appBusy() || appLoadFailed()"><div class="form-grid">
     <label class="form-field full-width">Application name<input name="appName" [(ngModel)]="app.appName" required></label><label class="form-field full-width">Client ID<input name="clientId" [(ngModel)]="app.clientId" autocomplete="off" required></label>
     <div class="form-field full-width"><label for="application-client-secret">{{ credential() ? 'Replacement client secret' : 'Client secret' }}</label><input id="application-client-secret" name="clientSecret" type="password" [(ngModel)]="app.clientSecret" autocomplete="new-password" aria-describedby="application-secret-help" required><small id="application-secret-help">The API requires a secret each time application settings are saved.</small></div>
     <label class="form-field full-width">Rotation deadline (UTC, optional)<input name="rotationDeadline" type="date" [(ngModel)]="app.rotationDate"></label><label class="form-field full-width">Application notes<textarea name="appNotes" rows="3" [(ngModel)]="app.notes"></textarea></label>
    </div><button class="primary-button" type="submit" [disabled]="credentialForm.invalid || appBusy() || !app.clientId.trim() || !app.clientSecret.trim()">{{ appBusy() ? 'Saving…' : 'Save application credentials' }}</button></fieldset></form>
   } @else { <p class="section-note">An administrator manages application and vendor credentials.</p> }
  }
 </section>
 <section class="panel" aria-labelledby="profile-import-heading"><p class="eyebrow">VENDOR AUTHORIZATION</p><h2 id="profile-import-heading">{{ isAdmin() ? 'Import vendor profiles' : 'Connect a vendor account' }}</h2>
  @if (isAdmin()) {
   <p class="section-note">Import a CSV or JSON file using the profile template, or paste a JSON array. Imports are matched by vendor code and marketplace ID.</p>
   @if (importError()) { <p class="inline-error" role="alert">{{ importError() }}</p> }
   <form #importForm="ngForm" (ngSubmit)="importProfiles()"><fieldset [disabled]="importBusy() || validateBusy()"><div class="form-grid">
    <label class="form-field full-width">Profile input method<select name="importMode" [(ngModel)]="importMode"><option value="file">CSV or JSON file</option><option value="json">Paste profile JSON</option></select></label>
    @if (importMode === 'file') { <label class="form-field full-width">Profile file<input #profileFile type="file" accept=".csv,.json" (change)="chooseFile($event)"></label> }
    @else { <label class="form-field full-width">Profile JSON<textarea name="profileJson" rows="8" [(ngModel)]="profileJson" spellcheck="false" required [placeholder]="profileExample"></textarea></label> }
    <label class="check-field full-width"><input name="overwriteExisting" type="checkbox" [(ngModel)]="overwrite">Overwrite existing profiles</label><label class="check-field full-width"><input name="validateImmediately" type="checkbox" [(ngModel)]="validateImmediately">Test tokens after import</label>
   </div><div class="action-row"><button class="primary-button" type="submit" [disabled]="importForm.invalid || importBusy() || (importMode === 'file' && !file)">{{ importBusy() ? 'Importing…' : 'Import profiles' }}</button><button class="secondary-button" type="button" (click)="downloadTemplate()" [disabled]="downloading()">{{ downloading() ? 'Downloading…' : 'Download CSV template' }}</button></div></fieldset></form>
  } @else { <ol class="setup-steps"><li><div><h3>Confirm access</h3><p>Ask your administrator to configure the approved Amazon application.</p></div></li><li><div><h3>Authorize the account</h3><p>Your administrator adds the account’s refresh token and marketplace.</p></div></li><li><div><h3>Test the connection</h3><p>Open an account in the directory to test its Amazon token exchange.</p></div></li></ol> }
 </section>
</div>
@if (result(); as r) { <section class="panel workflow-panel mt-6" aria-labelledby="profile-results-heading"><div class="panel-heading"><h2 id="profile-results-heading">Profile results</h2><button class="secondary-button" type="button" (click)="result.set(null)">Dismiss results</button></div><p class="section-note" role="status">{{ r.totalProcessed }} processed · {{ r.createdCount }} created · {{ r.updatedCount }} updated · {{ r.failedCount }} failed</p><div class="table-scroller" tabindex="0" role="region" aria-label="Profile processing results"><table><thead><tr><th scope="col">Profile</th><th scope="col">Action</th><th scope="col">Result</th><th scope="col">Token check</th></tr></thead><tbody>@for (row of r.details; track $index) { <tr><td>{{ row.name }}<small class="block muted">{{ row.vendorCode }} · {{ row.marketplaceId }}</small></td><td>{{ row.actionTaken }}</td><td>{{ row.errorMessage || (row.success ? 'Successful' : 'Failed') }}</td><td>{{ row.tokenValidationResult || 'Not requested' }}</td></tr> }</tbody></table></div></section> }
@if (isAdmin()) {
 <section class="panel directory-panel mt-6" aria-labelledby="managed-profiles-heading"><div class="directory-heading"><div><p class="eyebrow">SAVED AUTHORIZATION</p><h2 id="managed-profiles-heading">Managed vendor profiles</h2></div><div class="action-row"><button class="secondary-button" type="button" (click)="loadProfiles()" [disabled]="profilesLoading() || validateBusy() || importBusy()">Refresh profiles</button><button class="secondary-button" type="button" (click)="validateProfiles()" [disabled]="profilesLoading() || validateBusy() || importBusy() || !profiles().length">{{ validateBusy() ? 'Testing tokens…' : 'Test all profile tokens' }}</button></div></div>
  @if (profilesError()) { <p class="inline-error px-6" role="alert">{{ profilesError() }}</p> }
  @if (profilesLoading()) { <div class="skeleton list-skeleton" role="status" aria-label="Loading profiles"></div> }
  @else if (!profiles().length && !profilesError()) { <div class="empty-state"><h3>No profiles yet</h3><p>Add an account in the directory or import vendor profiles above.</p></div> }
  @else if (profiles().length) { <div class="table-scroller" tabindex="0" role="region" aria-label="Managed vendor credentials"><table><thead><tr><th scope="col">Profile</th><th scope="col">Marketplace</th><th scope="col">Refresh token (masked)</th><th scope="col">Application</th><th scope="col">Token status</th><th scope="col">Last checked</th></tr></thead><tbody>@for (p of profiles(); track p.id) { <tr><td>{{ p.name }}<small class="block muted">{{ p.vendorCode }}</small></td><td>{{ p.marketplaceName || p.marketplaceId }}</td><td>{{ p.maskedRefreshToken }}</td><td>{{ p.hasCustomCredentials ? 'Custom' : 'Shared' }}</td><td>{{ p.tokenStatus }}@if (p.lastValidationError) { <small class="block muted">{{ p.lastValidationError }}</small> }</td><td>{{ (p.lastTokenValidatedAtUtc | date:'mediumDate') || 'Not checked' }}</td></tr> }</tbody></table></div> }
 </section>
}` })
export class IntegrationComponent implements OnInit {
 private readonly api = inject(OperationsApiService); private readonly vendors = inject(VendorAccountsService); private readonly auth = inject(AuthService); private readonly notices = inject(NoticeService); private readonly destroyRef = inject(DestroyRef);
 readonly isAdmin = computed(() => this.auth.user()?.role?.toLowerCase() === 'admin'); readonly appLoading = signal(false); readonly appBusy = signal(false); readonly appError = signal(''); readonly appLoadFailed = signal(false); readonly configured = signal<boolean | null>(null); readonly credential = signal<AmazonCredentialDto | null>(null);
 readonly profiles = signal<ProfileCredentialDetailsDto[]>([]); readonly profilesLoading = signal(false); readonly profilesError = signal(''); readonly importBusy = signal(false); readonly validateBusy = signal(false); readonly importError = signal(''); readonly downloading = signal(false); readonly result = signal<BulkProfileCredentialUploadResult | null>(null);
 @ViewChild('profileFile') profileFile?: ElementRef<HTMLInputElement>;
 app = { appName:'', clientId:'', clientSecret:'', rotationDate:'', notes:'' }; importMode = 'file'; file: File | null = null; profileJson = ''; overwrite = false; validateImmediately = false;
 readonly profileExample = '[{"name":"Vendor name","vendorCode":"CODE","marketplaceId":"MARKETPLACE","refreshToken":"…"}]';
 ngOnInit(): void { this.loadApp(); if (this.isAdmin()) this.loadProfiles(); }
 loadApp(): void {
  if (this.appBusy() || this.appLoading()) return; this.appLoading.set(true); this.appError.set(''); this.appLoadFailed.set(false); this.configured.set(null);
  this.api.credentialStatus().pipe(switchMap(status => { this.configured.set(status.hasConfiguredCredentials); return this.isAdmin() ? this.api.credential() : of(null); }), takeUntilDestroyed(this.destroyRef)).subscribe({ next: c => { this.credential.set(c); this.app = { appName:c?.appName || '', clientId:c?.clientId || '', clientSecret:'', rotationDate:c?.rotationDeadlineUtc?.slice(0,10) || '', notes:c?.notes || '' }; this.appLoading.set(false); }, error: e => { this.appError.set(apiError(e, 'Application configuration could not load. Refresh to try again.')); this.appLoadFailed.set(true); this.appLoading.set(false); } });
 }
 saveApp(): void {
  if (!this.isAdmin() || this.appBusy() || !this.app.clientId.trim() || !this.app.clientSecret.trim()) return;
  this.appBusy.set(true); this.appError.set('');
  this.api.saveCredential({ appName:this.app.appName.trim(), clientId:this.app.clientId.trim(), clientSecret:this.app.clientSecret.trim(), rotationDeadlineUtc:this.app.rotationDate ? new Date(this.app.rotationDate + 'T00:00:00Z').toISOString() : null, notes:this.app.notes.trim() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: c => { this.credential.set(c); this.configured.set(c.isActive); this.app.clientSecret = ''; this.appBusy.set(false); this.notices.show('Application credentials saved'); }, error: e => { this.appError.set(apiError(e)); this.appBusy.set(false); } });
 }
 loadProfiles(): void { this.profilesLoading.set(true); this.profilesError.set(''); this.api.profiles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: p => { this.profiles.set(p); this.profilesLoading.set(false); }, error: e => { this.profilesError.set(apiError(e)); this.profilesLoading.set(false); } }); }
 chooseFile(event: Event): void { const input = event.target as HTMLInputElement; this.file = input.files?.[0] || null; this.importError.set(''); if (this.file && (!/\.(csv|json)$/i.test(this.file.name) || !this.file.size)) { this.file = null; input.value = ''; this.importError.set('Choose a non-empty CSV or JSON file.'); } }
 importProfiles(): void {
  if (!this.isAdmin() || this.importBusy() || this.validateBusy() || (this.importMode === 'file' && !this.file)) return;
  let profiles: VendorAccountRequest[] = []; this.importError.set(''); this.result.set(null);
  if (this.importMode === 'json') { try { const value: unknown = JSON.parse(this.profileJson);
   if (!Array.isArray(value) || !value.length || !value.every(p => p && typeof p === 'object' && ['name','vendorCode','marketplaceId','refreshToken'].every(key => typeof p[key] === 'string' && p[key].trim()))) throw new Error();
   profiles = value;
  } catch { this.importError.set('Enter a non-empty JSON array. Every profile needs name, vendorCode, marketplaceId, and refreshToken.'); return; } }
  this.importBusy.set(true);
  const request = this.importMode === 'file' ? this.api.importProfileFile(this.file!, this.overwrite, this.validateImmediately) : this.api.importProfiles({ profiles, overwriteExisting:this.overwrite, validateTokensImmediately:this.validateImmediately });
  request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: r => { this.result.set(r); this.file = null; this.profileJson = ''; if (this.profileFile) this.profileFile.nativeElement.value = ''; this.importBusy.set(false); this.notices.show('Profile import processed', r.failedCount ? 'Review the failed profiles in the results below.' : 'Vendor profiles have been processed.', r.failedCount ? 'warning' : 'success'); this.loadProfiles(); this.refreshVendors(); }, error: e => { this.importError.set(apiError(e)); this.importBusy.set(false); } });
 }
 validateProfiles(): void { if (!this.isAdmin() || this.validateBusy() || this.importBusy()) return; this.validateBusy.set(true); this.profilesError.set(''); this.api.validateProfiles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: r => { this.result.set(r); this.validateBusy.set(false); this.loadProfiles(); this.refreshVendors(); }, error: e => { this.profilesError.set(apiError(e)); this.validateBusy.set(false); } }); }
 private refreshVendors(): void { this.vendors.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => this.notices.show('Account selector needs a refresh', 'Profiles were processed, but the account selector could not reload.', 'warning') }); }
 downloadTemplate(): void { if (this.downloading()) return; this.downloading.set(true); this.api.downloadTemplate('profiles').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: blob => { saveDownload(blob, 'Amazon_Vendor_Profiles_Template.csv'); this.downloading.set(false); }, error: e => { this.importError.set(apiError(e)); this.downloading.set(false); } }); }
}
