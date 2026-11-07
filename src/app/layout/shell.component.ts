import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from "@angular/core";
import { DOCUMENT } from "@angular/common";
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { filter } from "rxjs";
import { AuthService } from "../core/auth/auth.service";
import { VendorAccountsService } from "../core/services/vendor-accounts.service";
import { VendorContextService } from "../core/state/vendor-context.service";
import { NoticeService } from "../core/state/notice.service";
import { IconComponent } from "../shared/icon.component";

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: ` <a
      class="skip-link"
      href="#main-content"
      (click)="skipToContent($event)"
      >Skip to content</a
    >
    <div class="app-shell">
      @if (mobile() && drawerOpen()) {
        <button
          class="drawer-backdrop"
          tabindex="-1"
          aria-label="Close navigation"
          (click)="closeDrawer()"
        ></button>
      }
      <aside
        #sidebar
        id="workspace-navigation"
        class="sidebar"
        [class.is-open]="drawerOpen()"
        [attr.inert]="mobile() && !drawerOpen() ? '' : null"
        [attr.role]="mobile() && drawerOpen() ? 'dialog' : null"
        [attr.aria-modal]="mobile() && drawerOpen() ? 'true' : null"
        aria-label="Workspace navigation"
      >
        <div class="flex items-center justify-between gap-2">
          <a
            routerLink="/dashboard"
            class="brand-lockup"
            aria-label="Pentanela home"
            ><img
              src="/assets/Pentanela-logo.png"
              width="48"
              height="48"
              alt=""
              class="brand-logo"
            /><span
              ><strong>Pentanela</strong><small>VENDOR WORKSPACE</small></span
            ></a
          >
          <button
            class="icon-button drawer-close"
            type="button"
            aria-label="Close navigation"
            (click)="closeDrawer()"
          >
            <app-icon name="close" />
          </button>
        </div>
       
        <p class="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation" class="nav-stack">
          @for (item of navigation; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              class="nav-link"
              ><app-icon [name]="item.icon" /><span>{{ item.label }}</span></a
            >
          }
        </nav>
        <p class="nav-label nav-label-secondary">MANAGEMENT</p>
        <nav aria-label="Management" class="nav-stack">
          <a
            routerLink="/integration"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            class="nav-link"
            ><app-icon name="link" /><span>Amazon connection</span></a
          >
          @if (isAdmin()) {
            <a
              routerLink="/employees"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              class="nav-link"
              ><app-icon name="users" /><span>Team members</span></a
            >
          }
        </nav>
        <div class="sidebar-bottom">
          
          <button
            class="sidebar-logout"
            type="button"
            (click)="logout()"
            [disabled]="signingOut()"
          >
            <app-icon name="logout" /><span>{{
              signingOut() ? "Signing out…" : "Sign out"
            }}</span>
          </button>
          
        </div>
      </aside>
      <div class="app-main" [attr.inert]="mobile() && drawerOpen() ? '' : null">
        <header class="topbar">
          <div class="flex items-center gap-3">
            <button
              #menuButton
              class="icon-button mobile-menu"
              type="button"
              (click)="openDrawer()"
              aria-label="Open navigation"
              aria-controls="workspace-navigation"
              [attr.aria-expanded]="drawerOpen()"
            >
              <app-icon name="menu" />
            </button>
            <div class="workspace-heading">
              <span>Workspace</span
              ><app-icon name="arrow" [size]="13" /><strong>{{
                sectionTitle()
              }}</strong>
            </div>
          </div>
          <div class="topbar-actions">
            <div class="account-control">
              <label for="vendor-selector">Working account</label
              ><select
                id="vendor-selector"
                [disabled]="vendorsLoading() || vendorsError()"
                [value]="context.selected()?.id || ''"
                (change)="changeAccount($event)"
              >
                <option value="">
                  {{
                    vendorsLoading()
                      ? "Loading accounts…"
                      : vendorsError()
                        ? "Accounts unavailable"
                        : "All vendor accounts"
                  }}
                </option>
                @for (vendor of vendors(); track vendor.id) {
                  <option [value]="vendor.id">
                    {{ vendor.name || vendor.vendorCode || vendor.id }}
                  </option>
                }
              </select>
            </div>
            <button
              type="button"
              class="icon-button notification-button"
              aria-label="Show workspace message"
              (click)="notices.restore()"
            >
              <app-icon name="bell" />
              @if (notices.current()) {
                <span class="notification-dot"></span>
              }
            </button>
            <div class="user-chip">
              <span class="user-avatar">{{ initials() }}</span
              ><span class="user-chip-text"
                ><b>{{ auth.user()?.username || "Employee" }}</b
                ><small>{{
                  isAdmin() ? "Administrator" : "Team member"
                }}</small></span
              >
            </div>
          </div>
        </header>
        <div class="notice-region" aria-live="polite" aria-atomic="true">
          @if (notices.current(); as notice) {
            <div
              class="workspace-notice"
              [class.notice-success]="notice.tone === 'success'"
              [class.notice-error]="notice.tone === 'error'"
              [class.notice-warning]="notice.tone === 'warning'"
              [attr.role]="notice.tone === 'error' ? 'alert' : 'status'"
            >
              <app-icon
                [name]="
                  notice.tone === 'success'
                    ? 'check'
                    : notice.tone === 'error'
                      ? 'alert'
                      : 'info'
                "
                [size]="19"
              />
              <p>
                <strong>{{ notice.title }}</strong>
                <span>{{ notice.message }}</span>
              </p>
              <button
                type="button"
                class="icon-button"
                aria-label="Dismiss message"
                (click)="notices.dismiss()"
              >
                <app-icon name="close" [size]="17" />
              </button>
            </div>
          }
        </div>
        @if (vendorsError()) {
          <div class="shell-error" role="alert">
            The account selector could not load.
            <button class="text-button" type="button" (click)="loadVendors()">
              Retry
            </button>
          </div>
        }
        @if (logoutError()) {
          <div class="shell-error" role="alert">
            Sign out could not be confirmed. Please try again.
          </div>
        }
        <main id="main-content" tabindex="-1" class="page-container">
          <router-outlet />
        </main>
        <footer class="workspace-footer">
          <span>Pentanela · Vendor operations</span
          ><span>Built around your business.</span>
        </footer>
      </div>
    </div>`,
})
export class ShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly context = inject(VendorContextService);
  readonly notices = inject(NoticeService);
  private readonly service = inject(VendorAccountsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  @ViewChild("sidebar") sidebar?: ElementRef<HTMLElement>;
  @ViewChild("menuButton") menuButton?: ElementRef<HTMLButtonElement>;
  readonly vendors = this.service.accounts;
  readonly vendorsLoading = signal(true);
  readonly vendorsError = signal(false);
  readonly drawerOpen = signal(false);
  readonly mobile = signal(
    (this.document.defaultView?.innerWidth || 1280) < 1024,
  );
  readonly signingOut = signal(false);
  readonly logoutError = signal(false);
  readonly routePath = signal(this.router.url);
  readonly isAdmin = computed(
    () => (this.auth.user()?.role || "").toLowerCase() === "admin",
  );
  readonly navigation = [
    { path: "/dashboard", icon: "grid", label: "Overview" },
    { path: "/vendor-accounts", icon: "accounts", label: "Vendor accounts" },
    { path: "/products", icon: "box", label: "Products" },
    { path: "/purchase-orders", icon: "orders", label: "Purchase orders" },
    { path: "/bulk-upload", icon: "upload", label: "Bulk uploads" },
  ];
  readonly sectionTitle = computed(
    () =>
      [
        ...this.navigation,
        { path: "/integration", label: "Amazon connection" },
        { path: "/employees", label: "Team members" },
      ].find((item) => this.routePath().split("?")[0] === item.path)?.label ||
      "Overview",
  );
  private previousOverflow = "";
  ngOnInit(): void {
    this.loadVendors();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.routePath.set(this.router.url);
        this.closeDrawer(false);
        setTimeout(
          () => this.document.getElementById("main-content")?.focus(),
          0,
        );
      });
    this.destroyRef.onDestroy(() => {
      if (this.drawerOpen())
        this.document.documentElement.style.overflow = this.previousOverflow;
    });
  }
  loadVendors(): void {
    this.vendorsLoading.set(true);
    this.vendorsError.set(false);
    this.service
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.vendorsLoading.set(false);
        },
        error: () => {
          this.vendorsError.set(true);
          this.vendorsLoading.set(false);
        },
      });
  }
  initials(): string {
    return (this.auth.user()?.username || this.auth.user()?.email || "P")
      .slice(0, 2)
      .toUpperCase();
  }
  skipToContent(event: Event): void {
    event.preventDefault();
    const main = this.document.getElementById("main-content");
    main?.focus();
    main?.scrollIntoView({ block: "start" });
  }
  changeAccount(event: Event): void {
    const vendor =
      this.vendors().find(
        (v) => v.id === (event.target as HTMLSelectElement).value,
      ) || null;
    this.context.choose(vendor);
    this.notices.show(
      vendor
        ? `${vendor.name || vendor.vendorCode} selected`
        : "All accounts selected",
      "The overview totals remain company-wide.",
    );
  }
  openDrawer(): void {
    if (this.drawerOpen()) return;
    this.previousOverflow = this.document.documentElement.style.overflow;
    this.document.documentElement.style.overflow = "hidden";
    this.drawerOpen.set(true);
    setTimeout(
      () =>
        this.sidebar?.nativeElement.querySelector<HTMLElement>("a")?.focus(),
      0,
    );
  }
  closeDrawer(restoreFocus = true): void {
    if (!this.drawerOpen()) return;
    this.drawerOpen.set(false);
    this.document.documentElement.style.overflow = this.previousOverflow;
    if (restoreFocus)
      setTimeout(() => this.menuButton?.nativeElement.focus(), 0);
  }
  @HostListener("window:resize") onResize(): void {
    this.mobile.set((this.document.defaultView?.innerWidth || 1280) < 1024);
    if (!this.mobile()) this.closeDrawer(false);
  }
  @HostListener("document:keydown", ["$event"]) onKey(
    event: KeyboardEvent,
  ): void {
    if (!this.drawerOpen() || !this.mobile()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.closeDrawer();
    }
    if (event.key !== "Tab") return;
    const elements = Array.from(
      this.sidebar?.nativeElement.querySelectorAll<HTMLElement>(
        "a[href],button:not([disabled])",
      ) || [],
    ).filter((el) => el.getClientRects().length);
    const first = elements[0],
      last = elements[elements.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  logout(): void {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.logoutError.set(false);
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.context.clear();
          void this.router.navigateByUrl("/login");
        },
        error: () => {
          this.logoutError.set(true);
          this.signingOut.set(false);
        },
        complete: () => this.signingOut.set(false),
      });
  }
}
