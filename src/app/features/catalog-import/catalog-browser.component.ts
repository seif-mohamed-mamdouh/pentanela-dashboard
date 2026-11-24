import { Component, OnChanges, OnDestroy, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, map } from 'rxjs';
import { CatalogImportApiService, CatalogProduct, catalogImportError } from './catalog-import-api.service';
import { CatalogPriceComponent } from './catalog-price.component';

type BrowseMode = 'keyword' | 'asin' | 'imported';
interface CatalogPage { items: CatalogProduct[]; isSandbox: boolean; next?: string; }

@Component({
  selector: 'app-catalog-browser',
  imports: [FormsModule, CatalogPriceComponent],
  styleUrl: './catalog-import.css',
  template: `
    <form (ngSubmit)="load()">
      <div class="form-grid">
        <label class="form-field">Find products by
          <select name="mode" [(ngModel)]="mode" (ngModelChange)="reset()">
            <option value="keyword">Keyword</option><option value="asin">ASIN</option>
            <option value="imported">Previously imported products</option>
          </select>
        </label>
        @if (mode !== 'imported') {
          <label class="form-field">{{ mode === 'asin' ? 'ASIN' : 'Keyword' }}
            <input name="query" [(ngModel)]="query" (ngModelChange)="reset()" [maxlength]="mode === 'asin' ? 10 : 4020" required>
          </label>
        }
        <label class="check-field full-width"><input type="checkbox" name="prices" [(ngModel)]="priced" (ngModelChange)="reset()">Include live storefront prices</label>
      </div>
      <button class="primary-button" type="submit" [disabled]="loading() || !validQuery()">{{ mode === 'imported' ? 'Show imported products' : 'Find products' }}</button>
    </form>
    @if (loading()) { <p class="catalog-help" role="status">Loading catalog results.</p> }
    @if (error()) { <p class="inline-error" role="alert">{{ error() }}</p> }
    @if (page(); as result) {
      @if (result.isSandbox) { <p class="catalog-help">Sandbox test data</p> }
      @if (result.items.length) {
        <div class="table-scroller mt-4" tabindex="0" role="region" aria-label="Amazon catalog results">
          <table><thead><tr><th scope="col">ASIN</th><th scope="col">Product</th>@if (priced) { <th scope="col">Storefront price</th> }</tr></thead>
            <tbody>@for (product of result.items; track product.asin) {
              <tr><td>{{ product.asin }}</td><td>{{ product.title || 'Title unavailable' }}
                @if (product.brand) { <small class="block muted">{{ product.brand }}</small> }
                @if (mode === 'asin' && product.description) { <p>{{ product.description }}</p> }
              </td>@if (priced) { <td><app-catalog-price [price]="product.livePrice" /></td> }</tr>
            }</tbody>
          </table>
        </div>
      } @else { <p class="catalog-help" role="status">No products found.</p> }
      @if (currentPage() > 0 || result.next) {
        <div class="action-row mt-4">
          <button class="secondary-button" type="button" [disabled]="loading() || currentPage() === 0" (click)="load(currentPage() - 1)">Previous page</button>
          <button class="secondary-button" type="button" [disabled]="loading() || !result.next" (click)="load(currentPage() + 1)">Next page</button>
        </div>
      }
    }
  `,
})
export class CatalogBrowserComponent implements OnChanges, OnDestroy {
  readonly accountId = input.required<string>();
  readonly marketplace = input.required<string>();
  private readonly api = inject(CatalogImportApiService);
  private request?: Subscription;
  private tokens: (string | undefined)[] = [];
  readonly currentPage = signal(0);
  readonly page = signal<CatalogPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  mode: BrowseMode = 'keyword';
  query = '';
  priced = false;

  ngOnChanges(): void { this.reset(); }
  ngOnDestroy(): void { this.request?.unsubscribe(); }

  validQuery(): boolean {
    if (this.mode === 'imported') return true;
    return this.mode === 'asin' ? /^[A-Z0-9]{10}$/i.test(this.query.trim()) : !!this.query.trim();
  }

  reset(): void {
    this.request?.unsubscribe();
    this.page.set(null);
    this.currentPage.set(0);
    this.tokens = [];
    this.error.set('');
    this.loading.set(false);
  }

  load(index = 0): void {
    if (this.loading() || !this.validQuery()) return;
    const account = this.accountId();
    const market = this.marketplace();
    const token = this.tokens[index];
    let request: Observable<CatalogPage>;
    if (this.mode === 'imported') {
      request = this.api.imported(account, market, this.priced, token).pipe(map(result => ({
        items: result.items.map(item => item.product), isSandbox: result.isSandbox, next: result.nextAfterAsin,
      })));
    } else if (this.mode === 'asin') {
      request = this.api.lookup(account, market, this.query.trim().toUpperCase(), this.priced).pipe(
        map(result => ({ items: [result.product], isSandbox: result.isSandbox })));
    } else {
      request = this.api.search(account, market, this.query.trim(), this.priced, token).pipe(
        map(result => ({ ...result, next: result.nextToken })));
    }
    this.loading.set(true);
    this.error.set('');
    this.request = request.subscribe({
      next: result => {
        this.page.set(result);
        this.tokens[index + 1] = result.next;
        this.currentPage.set(index);
        this.loading.set(false);
      },
      error: error => {
        this.error.set(catalogImportError(error, 'The catalog could not be loaded. Try again.'));
        this.loading.set(false);
      },
    });
  }
}
