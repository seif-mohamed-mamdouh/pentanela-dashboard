import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { DatePipe, DecimalPipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { DashboardService } from "../../core/services/dashboard.service";
import { VendorAccountsService } from "../../core/services/vendor-accounts.service";
import { VendorContextService } from "../../core/state/vendor-context.service";
import {
  DashboardSummaryDto,
  VendorAccountDto,
} from "../../core/models/api.models";
import {
  vendorHealth,
  vendorHealthLabel,
} from "../../core/utils/vendor-status";
import { IconComponent } from "../../shared/icon.component";

@Component({
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, IconComponent],
  templateUrl: "./dashboard.component.html",
})
export class DashboardComponent implements OnInit {
  private readonly dashboard = inject(DashboardService);
  private readonly accounts = inject(VendorAccountsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly context = inject(VendorContextService);
  readonly loading = signal(false);
  readonly vendorsLoading = signal(false);
  readonly error = signal("");
  readonly vendorsError = signal(false);
  readonly summary = signal<DashboardSummaryDto | null>(null);
  readonly vendors = signal<VendorAccountDto[]>([]);
  readonly refreshedAt = signal<Date | null>(null);
  readonly connected = computed(
    () => this.vendors().filter((v) => vendorHealth(v) === "connected").length,
  );
  readonly attention = computed(
    () => this.vendors().filter((v) => vendorHealth(v) === "attention").length,
  );
  readonly inactive = computed(
    () => this.vendors().filter((v) => vendorHealth(v) === "inactive").length,
  );
  readonly attentionAccounts = computed(() =>
    this.vendors()
      .filter((v) => vendorHealth(v) !== "connected")
      .slice(0, 4),
  );
  readonly metrics = computed(() => [
    {
      label: "Vendor accounts",
      value: this.summary()?.totalVendorAccounts,
      detail: this.summary()
        ? this.summary()!.activeVendorAccounts + " active accounts"
        : "Account portfolio",
      icon: "accounts",
      path: "/vendor-accounts",
    },
    {
      label: "Catalog products",
      value: this.summary()?.totalProducts,
      detail: "Across your portfolio",
      icon: "box",
      path: "/products",
    },
    {
      label: "Open purchase orders",
      value: this.summary()?.totalOpenPurchaseOrders,
      detail: "New & acknowledged",
      icon: "orders",
      path: "/purchase-orders",
    },
    {
      label: "Pending batches",
      value: this.summary()?.pendingBatches,
      detail: "Awaiting processing",
      icon: "upload",
      path: "/bulk-upload",
    },
  ]);
  ngOnInit(): void {
    this.reload();
  }
  reload(): void {
    if (this.loading() || this.vendorsLoading()) return;
    this.loading.set(true);
    this.error.set("");
    this.summary.set(null);
    this.refreshedAt.set(null);
    this.dashboard
      .summary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          this.summary.set(value);
          this.loading.set(false);
          this.refreshedAt.set(new Date());
        },
        error: () => {
          this.error.set(
            "The overview could not load. Try refreshing in a moment.",
          );
          this.loading.set(false);
        },
      });
    this.vendorsLoading.set(true);
    this.vendorsError.set(false);
    this.vendors.set([]);
    this.accounts
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          this.vendors.set(value);
          this.vendorsLoading.set(false);
        },
        error: () => {
          this.vendorsError.set(true);
          this.vendorsLoading.set(false);
        },
      });
  }
  percent(value: number): number {
    return this.vendors().length ? (value / this.vendors().length) * 100 : 0;
  }
  label = vendorHealthLabel;
}
