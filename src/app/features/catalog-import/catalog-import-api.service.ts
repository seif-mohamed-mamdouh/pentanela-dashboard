import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, tap } from 'rxjs';
import { apiError } from '../../core/utils/api-error';
import type { CatalogRetailPrice } from './catalog-price.component';

type CatalogImportStatus = 'Queued' | 'Running' | 'Completed' | 'Failed';
type CatalogRowStatus = 'Pending' | 'Successful' | 'Failed' | 'Skipped';

export interface CatalogImportJob {
  jobId: string;
  accountId: string;
  marketplaceId: string;
  isSandbox: boolean;
  status: CatalogImportStatus;
  total: number;
  pending: number;
  successful: number;
  failed: number;
  skipped: number;
  createdAtUtc: string;
  error?: string | null;
}

export interface CatalogImportItem {
  inputNumber: number;
  worksheet: string;
  rowNumber: number;
  asin?: string | null;
  status: CatalogRowStatus;
  errorCode?: string | null;
  error?: string | null;
  product?: CatalogProduct | null;
}

export interface CatalogProduct {
  asin: string;
  title?: string | null;
  brand?: string | null;
  description?: string | null;
  mainImageUrl?: string | null;
  images?: { link?: string | null }[] | null;
  livePrice?: CatalogRetailPrice | null;
}

interface CatalogImportPage {
  jobId: string;
  status: CatalogImportStatus;
  items: CatalogImportItem[];
  nextAfter?: number | null;
}

const catalogPath = '/api/amazon/catalog';
const importPath = `${catalogPath}/bulk-import`;

@Injectable({ providedIn: 'root' })
export class CatalogImportApiService {
  private readonly http = inject(HttpClient);

  search(accountId: string, marketplace: string, keyword: string, includeLivePrice: boolean, pageToken?: string) {
    let params = new HttpParams().set('accountId', accountId).set('marketplace', marketplace)
      .set('keyword', keyword).set('includeLivePrice', includeLivePrice).set('pageSize', 10);
    if (pageToken) params = params.set('pageToken', pageToken);
    return this.http.get<{ isSandbox: boolean; items: CatalogProduct[]; nextToken?: string; previousToken?: string }>(
      `${catalogPath}/search`, { params, cache: 'no-store' });
  }

  lookup(accountId: string, marketplace: string, asin: string, includeLivePrice: boolean) {
    return this.http.get<{ isSandbox: boolean; product: CatalogProduct }>(`${catalogPath}/${encodeURIComponent(asin)}`, {
      params: { accountId, marketplace, includeLivePrice }, cache: 'no-store',
    });
  }

  imported(accountId: string, marketplace: string, includeLivePrice: boolean, afterAsin?: string) {
    let params = new HttpParams().set('marketplace', marketplace).set('includeLivePrice', includeLivePrice).set('pageSize', 20);
    if (afterAsin) params = params.set('afterAsin', afterAsin);
    return this.http.get<{ isSandbox: boolean; items: { product: CatalogProduct }[]; nextAfterAsin?: string }>(
      `${catalogPath}/accounts/${encodeURIComponent(accountId)}/products`, { params, cache: 'no-store' });
  }

  upload(file: File, accountId: string, marketplace: string): Observable<CatalogImportJob> {
    const form = new FormData();
    form.append('File', file);
    form.append('AccountId', accountId);
    form.append('Marketplace', marketplace);
    return this.http.post<CatalogImportJob>(`${importPath}/excel`, form);
  }

  status(jobId: string): Observable<CatalogImportJob> {
    return this.http.get<CatalogImportJob>(jobPath(jobId), { cache: 'no-store', timeout: 20_000 });
  }

  items(jobId: string, after = 0, pageSize = 20, includeLivePrice = false): Observable<CatalogImportPage> {
    let params = new HttpParams().set('after', after).set('pageSize', pageSize);
    if (includeLivePrice) params = params.set('includeLivePrice', true);
    return this.http.get<CatalogImportPage>(`${jobPath(jobId)}/items`, {
      params, cache: 'no-store', timeout: 30_000,
    });
  }

  resultPages(job: CatalogImportJob, includeLivePrice = false): Observable<CatalogImportPage> {
    const fetchPage = (after: number) => this.items(job.jobId, after, includeLivePrice ? 20 : 100, includeLivePrice).pipe(
      tap(page => {
        const next = page.nextAfter;
        if (page.jobId !== job.jobId || !isFinished(page.status) ||
            page.items.some((item, i) => item.inputNumber !== after + i + 1) ||
            (next != null && (next <= after || next >= job.total || next !== page.items.at(-1)?.inputNumber))) {
          throw new Error('The import returned an inconsistent results page.');
        }
      }),
    );
    return fetchPage(0).pipe(expand(page => page.nextAfter == null ? EMPTY : fetchPage(page.nextAfter), 1));
  }
}

function jobPath(jobId: string): string {
  return `${importPath}/jobs/${encodeURIComponent(jobId)}`;
}

export function isFinished(status: CatalogImportStatus): boolean {
  return status === 'Completed' || status === 'Failed';
}

export function catalogImportError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    switch (error.error?.code) {
      case 'AccountUnavailable':
        return 'Choose an active vendor account in the matching marketplace that you have Catalog access to.';
      case 'ImportJobNotFound':
        return 'This import is unavailable. Sign in as the original uploader and open the import link again.';
    }
    if (error.status === 413) return 'The server rejected the workbook size. Try a smaller .xlsx file.';
  }
  return apiError(error, fallback);
}
