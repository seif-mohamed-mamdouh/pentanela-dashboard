import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';

const priceLabels = {
  Available: 'Available',
  Unavailable: 'No offer available',
  RateLimited: 'Storefront rate limit reached',
  AccessBlocked: 'Storefront access blocked',
  LookupFailed: 'Price lookup failed',
  Sandbox: 'Sandbox — no live price',
  UnsupportedMarketplace: 'Marketplace unsupported',
};

export interface CatalogRetailPrice {
  status: keyof typeof priceLabels;
  amount?: number | null;
  currency?: string | null;
  sourceUrl?: string | null;
  checkedAtUtc?: string | null;
}

@Component({
  selector: 'app-catalog-price',
  imports: [CurrencyPipe, DatePipe],
  template: `
    @if (price(); as p) {
      @if (p.status === 'Available' && p.amount != null && p.currency) {
        <strong>{{ p.amount | currency:p.currency:'code' }}</strong>
      } @else {
        <span>{{ p.status === 'Available' ? 'Price unavailable' : labels[p.status] || 'Price unavailable' }}</span>
      }
      @if (p.sourceUrl) { <a class="record-link block" [href]="p.sourceUrl" target="_blank" rel="noopener noreferrer">View on Amazon</a> }
      @if (p.checkedAtUtc) { <small class="block muted">Checked {{ p.checkedAtUtc | date:'short' }}</small> }
    } @else { <span>—</span> }
  `,
})
export class CatalogPriceComponent {
  readonly price = input<CatalogRetailPrice | null>();
  readonly labels = priceLabels;
}
