import type { CatalogImportItem, CatalogImportJob } from './catalog-import-api.service';

export type CatalogWorkbookRow = [
  asin: string | null,
  title: string | null,
  mainImageUrl: string | null,
  additionalImageUrls: string | null,
  worksheet: string,
  excelRow: number,
  status: string,
  errorCode: string | null,
  details: string | null,
];

function httpsImageUrl(link?: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function primaryImageUrl(item: CatalogImportItem): string | null {
  return httpsImageUrl(item.product?.mainImageUrl) ??
    item.product?.images?.map(image => httpsImageUrl(image.link)).find(Boolean) ?? null;
}

export function workbookRow(item: CatalogImportItem): CatalogWorkbookRow {
  const image = primaryImageUrl(item);
  const additional = new Set(item.product?.images?.map(value => httpsImageUrl(value.link)));
  additional.delete(null);
  additional.delete(image);
  return [
    item.asin ?? null,
    item.product?.title ?? null,
    image,
    [...additional].join('\n') || null,
    item.worksheet,
    item.rowNumber,
    item.status,
    item.errorCode ?? null,
    item.error ?? null,
  ];
}

export async function createCatalogWorkbook(
  rows: CatalogWorkbookRow[], job: CatalogImportJob, accountName: string, marketplace: string,
): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const header = (labels: string[]) => labels.map(value => ({
    value, fontWeight: 'bold' as const, color: '#F5F8FC', backgroundColor: '#234965',
  }));

  return writeXlsxFile([
    {
      sheet: 'ASIN results',
      stickyRowsCount: 1,
      columns: [16, 60, 48, 48, 26, 13, 16, 26, 60].map(width => ({ width })),
      data: [
        header(['ASIN', 'Title', 'Main image URL', 'Additional image URLs', 'Worksheet', 'Excel row', 'Status', 'Error code', 'Details']),
        ...rows,
      ],
    },
    {
      sheet: 'Import details',
      columns: [{ width: 24 }, { width: 62 }],
      data: [
        header(['Field', 'Value']),
        ['Vendor account', accountName],
        ['Marketplace', marketplace],
        ['Amazon environment', job.isSandbox ? 'Sandbox (test data)' : 'Production'],
        ['Submitted at (UTC)', job.createdAtUtc],
        ['Import status', job.status],
        ['Job reference', job.jobId],
        ['Live Amazon offer prices', 'Unavailable from the Catalog API'],
      ],
    },
  ]).toBlob();
}
