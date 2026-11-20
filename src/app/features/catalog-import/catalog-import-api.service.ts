import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, tap } from 'rxjs';
import { apiError } from '../../core/utils/api-error';

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
  product?: {
    title?: string | null;
    mainImageUrl?: string | null;
    images?: { link?: string | null }[] | null;
  } | null;
}

interface CatalogImportPage {
  jobId: string;
  status: CatalogImportStatus;
  items: CatalogImportItem[];
  nextAfter?: number | null;
}

const importPath = '/api/amazon/catalog/bulk-import';

@Injectable({ providedIn: 'root' })
export class CatalogImportApiService {
  private readonly http = inject(HttpClient);

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

  items(jobId: string, after = 0, pageSize = 20): Observable<CatalogImportPage> {
    const params = new HttpParams().set('after', after).set('pageSize', pageSize);
    return this.http.get<CatalogImportPage>(`${jobPath(jobId)}/items`, {
      params, cache: 'no-store', timeout: 30_000,
    });
  }

  resultPages(job: CatalogImportJob): Observable<CatalogImportPage> {
    const fetchPage = (after: number) => this.items(job.jobId, after, 100).pipe(
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
