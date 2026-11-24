import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { VendorAccountsService } from '../../core/services/vendor-accounts.service';
import { VendorContextService } from '../../core/state/vendor-context.service';
import { IconComponent } from '../../shared/icon.component';
import { CatalogImportApiService, catalogImportError } from './catalog-import-api.service';
import { CatalogBrowserComponent } from './catalog-browser.component';
import { catalogMarketplace } from './catalog-marketplaces';

const maxFileSize = 10 * 1024 * 1024;

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, CatalogBrowserComponent],
  templateUrl: './catalog-import.component.html',
  styleUrl: './catalog-import.css',
})
export class CatalogImportComponent {
  private readonly api = inject(CatalogImportApiService);
  private readonly context = inject(VendorContextService);
  private readonly vendorAccounts = inject(VendorAccountsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly accounts = computed(() => this.vendorAccounts.accounts()
    .filter(account => account.isActive && account.marketplaceId));
  readonly account = computed(() => this.accounts()
    .find(account => account.id === this.context.selected()?.id));
  readonly marketplace = computed(() => catalogMarketplace(this.account()?.marketplaceId));
  readonly marketplaceInput = linkedSignal(() => {
    const name = this.account()?.marketplaceName?.trim().toUpperCase() ?? '';
    return /^[A-Z]{2}$/.test(name) ? name : '';
  });
  readonly marketplaceCode = computed(() =>
    this.marketplace()?.code ?? this.marketplaceInput().trim().toUpperCase());
  readonly browsing = signal(false);
  readonly file = signal<File | null>(null);
  readonly validMarketplace = computed(() => /^[A-Z]{2}$/.test(this.marketplaceCode()));
  readonly fileError = signal('');
  readonly submitError = signal('');
  readonly uploading = signal(false);
  readonly acceptedJobId = signal('');
  readonly canSubmit = computed(() => Boolean(
    this.account() && this.file() && this.validMarketplace() &&
    !this.uploading() && !this.acceptedJobId(),
  ));

  chooseAccount(id: string): void {
    this.context.choose(this.accounts().find(account => account.id === id) ?? null);
    this.submitError.set('');
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.submitError.set('');
    this.fileError.set('');
    this.file.set(null);
    if (!file) return;

    if (!/\.xlsx$/i.test(file.name) || file.size === 0) {
      this.fileError.set('Choose a nonempty Excel .xlsx workbook.');
    } else if (file.size > maxFileSize) {
      this.fileError.set('Choose an Excel workbook of 10 MiB or less.');
    } else {
      this.file.set(file);
      return;
    }
    input.value = '';
  }

  submit(): void {
    const account = this.account();
    const file = this.file();
    if (this.browsing() || !account || !file || !this.canSubmit()) return;

    this.submitError.set('');
    this.uploading.set(true);
    this.api.upload(file, account.id, this.marketplaceCode()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.uploading.set(false)),
    ).subscribe({
      next: job => {
        this.acceptedJobId.set(job.jobId);
        // Keep a link to the accepted job if navigation fails.
        void this.router.navigate(['/asin-imports', job.jobId]).catch(() => undefined);
      },
      error: error => this.submitError.set(catalogImportError(error, 'The workbook could not be uploaded. Please try again.')),
    });
  }
}
