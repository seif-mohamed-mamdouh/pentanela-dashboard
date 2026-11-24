import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EMPTY, Subject, catchError, distinctUntilChanged, finalize, map, reduce, repeat,
  startWith, switchMap, takeUntil, takeWhile, tap,
} from 'rxjs';
import { VendorAccountsService } from '../../core/services/vendor-accounts.service';
import { saveDownload } from '../../core/utils/api-error';
import {
  CatalogImportApiService, CatalogImportItem, CatalogImportJob, catalogImportError, isFinished,
} from './catalog-import-api.service';
import { catalogMarketplace } from './catalog-marketplaces';
import { CatalogPriceComponent } from './catalog-price.component';
import { CatalogWorkbookRow, createCatalogWorkbook, primaryImageUrl, workbookRow } from './catalog-workbook';

const pollInterval = 5000;

@Component({
  standalone: true,
  imports: [DecimalPipe, RouterLink, CatalogPriceComponent],
  templateUrl: './catalog-import-job.component.html',
  styleUrl: './catalog-import.css',
})
export class CatalogImportJobComponent implements OnInit {
  private readonly api = inject(CatalogImportApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly vendorAccounts = inject(VendorAccountsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly statusRefresh = new Subject<void>();
  private readonly previewRefresh = new Subject<void>();
  private readonly cancelDownload = new Subject<void>();

  readonly job = signal<CatalogImportJob | null>(null);
  readonly statusLoading = signal(true);
  readonly statusError = signal('');
  readonly previewItems = signal<CatalogImportItem[]>([]);
  readonly previewLoading = signal(false);
  readonly previewError = signal('');
  readonly downloading = signal(false);
  readonly downloadError = signal('');
  readonly collected = signal(0);
  readonly includeLivePrice = signal(false);
  readonly finished = computed(() => {
    const job = this.job();
    return job !== null && isFinished(job.status);
  });
  readonly vendorName = computed(() => {
    const vendor = this.vendorAccounts.accounts().find(account => account.id === this.job()?.accountId);
    return vendor?.name || vendor?.vendorCode;
  });
  readonly marketplace = computed(() => {
    const id = this.job()?.marketplaceId;
    return catalogMarketplace(id)?.name ?? id ?? '';
  });
  readonly primaryImageUrl = primaryImageUrl;

  ngOnInit(): void {
    this.route.paramMap.pipe(
      map(params => params.get('jobId') ?? ''),
      distinctUntilChanged(),
      switchMap(jobId => {
        this.cancelDownload.next();
        this.includeLivePrice.set(false);
        this.job.set(null);
        this.previewItems.set([]);
        this.previewError.set('');
        this.downloadError.set('');
        return this.statusRefresh.pipe(
          startWith(undefined),
          switchMap(() => this.poll(jobId)),
          switchMap(job => isFinished(job.status) ? this.previewRefresh.pipe(
            startWith(undefined),
            switchMap(() => this.loadPreview(jobId)),
          ) : EMPTY),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(items => this.previewItems.set(items));
  }

  refreshStatus(): void {
    this.statusRefresh.next();
  }

  refreshPreview(): void {
    this.previewRefresh.next();
  }

  setLivePrices(enabled: boolean): void {
    this.includeLivePrice.set(enabled);
    this.previewItems.set([]);
    this.downloadError.set('');
    this.refreshPreview();
  }

  stopDownload(): void { this.cancelDownload.next(); }

  download(): void {
    const job = this.job();
    if (!job || !this.finished() || this.downloading()) return;

    this.downloading.set(true);
    this.downloadError.set('');
    this.collected.set(0);
    const accountName = this.vendorName() ?? job.accountId;
    const marketplace = this.marketplace();
    const priced = this.includeLivePrice();
    this.api.resultPages(job, priced).pipe(
      reduce((rows, page) => {
        rows.push(...page.items.map(item => workbookRow(item, priced)));
        this.collected.set(rows.length);
        return rows;
      }, [] as CatalogWorkbookRow[]),
      switchMap(rows => {
        if (rows.length !== job.total) throw new Error('The import returned an incomplete set of rows.');
        return createCatalogWorkbook(rows, job, accountName, marketplace, priced);
      }),
      takeUntil(this.cancelDownload),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.downloading.set(false)),
    ).subscribe({
      next: blob => saveDownload(blob, `ASIN_Import_${job.jobId.slice(0, 8)}.xlsx`),
      error: error => this.downloadError.set(catalogImportError(error, 'The complete workbook could not be downloaded. Try downloading it again.')),
    });
  }

  private poll(jobId: string) {
    this.statusLoading.set(true);
    this.statusError.set('');
    return this.api.status(jobId).pipe(
      repeat({ delay: pollInterval }),
      takeWhile(job => !isFinished(job.status), true),
      tap(job => {
        this.job.set(job);
        this.statusLoading.set(false);
      }),
      catchError(error => {
        this.statusLoading.set(false);
        this.statusError.set(catalogImportError(error, 'The import status could not be loaded.'));
        return EMPTY;
      }),
    );
  }

  private loadPreview(jobId: string) {
    this.previewLoading.set(true);
    this.previewError.set('');
    return this.api.items(jobId, 0, 20, this.includeLivePrice()).pipe(
      map(page => page.items),
      catchError(error => {
        this.previewError.set(catalogImportError(error, 'The results preview could not be loaded.'));
        return EMPTY;
      }),
      finalize(() => this.previewLoading.set(false)),
    );
  }
}
