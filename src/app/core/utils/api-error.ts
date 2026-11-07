import { HttpErrorResponse } from '@angular/common/http';

export function apiError(error: unknown, fallback = 'The request could not be completed. Please try again.'): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'The server could not be reached. Check your connection and try again.';
  if (error.status === 403) return 'Your account does not have access to this action.';
  if (error.status === 401) return 'Your session has expired. Please sign in again.';
  if (error.status >= 500) return fallback;
  const body = error.error;
  if (typeof body === 'string' && !body.trim().startsWith('<')) return body.slice(0, 600);
  const validation = body?.errors && Object.values(body.errors).flat().filter(value => typeof value === 'string').join(' ');
  return String(validation || body?.message || body?.error || body?.detail || fallback).slice(0, 600);
}

export function saveDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
