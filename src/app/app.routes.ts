import { Routes } from "@angular/router";
import { authGuard, adminGuard } from "./core/auth/auth.guard";
import { ShellComponent } from "./layout/shell.component";
const records = () =>
  import("./features/records/records.component").then(
    (c) => c.RecordsComponent,
  );
export const routes: Routes = [
  {
    path: "login",
    title: "Sign in | Pentanela",
    loadComponent: () =>
      import("./features/auth/login.component").then((c) => c.LoginComponent),
  },
  {
    path: "",
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: "", pathMatch: "full", redirectTo: "dashboard" },
      {
        path: "dashboard",
        title: "Overview | Pentanela",
        loadComponent: () =>
          import("./features/dashboard/dashboard.component").then(
            (c) => c.DashboardComponent,
          ),
      },
      {
        path: "vendor-accounts",
        title: "Vendor accounts | Pentanela",
        loadComponent: () =>
          import("./features/vendor-accounts/vendor-accounts.component").then(
            (c) => c.VendorAccountsComponent,
          ),
      },
      {
        path: "integration",
        title: "Amazon connection | Pentanela",
        loadComponent: () =>
          import("./features/integration/integration.component").then(
            (c) => c.IntegrationComponent,
          ),
      },
      {
        path: "products",
        title: "Products | Pentanela",
        loadComponent: records,
        data: {
          kind: "products",
          title: "Products",
          description:
            "Your catalog, organized by account and ready for a closer look.",
        },
      },
      {
        path: "purchase-orders",
        title: "Purchase orders | Pentanela",
        loadComponent: records,
        data: {
          kind: "orders",
          title: "Purchase orders",
          description: "Keep track of orders and their recorded progress.",
        },
      },
      {
        path: "bulk-upload",
        title: "Bulk uploads | Pentanela",
        loadComponent: records,
        data: {
          kind: "batches",
          title: "Bulk uploads",
          description:
            "Submit product batches and review item results for each account.",
        },
      },
      {
        path: "employees",
        title: "Team members | Pentanela",
        canActivate: [adminGuard],
        loadComponent: records,
        data: {
          kind: "team",
          title: "Team members",
          description: "The people who keep your business moving.",
        },
      },
    ],
  },
  { path: "**", redirectTo: "dashboard" },
];
