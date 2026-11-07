import { Component, DestroyRef, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { finalize } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AuthService } from "../../core/auth/auth.service";
import { IconComponent } from "../../shared/icon.component";
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  template: ` <main class="login-screen">
    <section class="login-brand" aria-label="About your workspace">
      <div class="brand-lockup">
        <img
          src="/assets/Pentanela-logo.png"
          width="58"
          height="58"
          alt="Pentanela logo"
          class="brand-logo"
        /><span
          ><strong>Pentanela</strong
          ><small>E-COMMERCE & GENERAL SUPPLY</small></span
        >
      </div>
      <div class="login-story">
        <p class="eyebrow">A BETTER VIEW OF YOUR BUSINESS</p>
        <h2>Every connection.<br />One clear picture<span>.</span></h2>
        <p>
          Your vendor accounts, products, and daily operations. Together in one
          considered workspace.
        </p>
        <div class="login-feature">
          <app-icon name="accounts" />One home for your vendor portfolio
        </div>
        <div class="login-feature">
          <app-icon name="orders" />Clarity across your daily operations
        </div>
        <div class="login-feature">
          <app-icon name="shield" />A workspace for your team
        </div>
      </div>
    </section>
    <section class="login-form-panel">
      <div class="login-form-wrap">
        <div class="mobile-login-brand">
          <img
            src="/assets/Pentanela-logo.png"
            width="56"
            height="56"
            alt="Pentanela logo"
          /><strong>Pentanela</strong>
        </div>
        <p class="eyebrow">WELCOME TO YOUR WORKSPACE</p>
        <h1>Good to see you again.</h1>
        <p class="page-description">
          Sign in with your company account to get started.
        </p>
        @if (error()) {
          <div class="error-panel mt-6" role="alert">
            <app-icon name="alert" [size]="18" />{{ error() }}
          </div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label for="identity">Email or username</label
          ><input
            id="identity"
            autocomplete="username"
            formControlName="usernameOrEmail"
            placeholder="Enter your email or username"
            [attr.aria-invalid]="
              form.controls.usernameOrEmail.touched &&
              form.controls.usernameOrEmail.invalid
            "
          />
          <div class="flex items-center justify-between mt-3">
            <label for="password">Password</label>
          </div>
          <div class="password-field">
            <input
              id="password"
              [type]="showPassword() ? 'text' : 'password'"
              autocomplete="current-password"
              formControlName="password"
              placeholder="Enter your password"
              [attr.aria-invalid]="
                form.controls.password.touched && form.controls.password.invalid
              "
            /><button
              type="button"
              class="icon-button"
              [attr.aria-label]="
                showPassword() ? 'Hide password' : 'Show password'
              "
              [attr.aria-pressed]="showPassword()"
              (click)="showPassword.set(!showPassword())"
            >
              <app-icon name="eye" [size]="19" />
            </button>
          </div>
          <button
            type="submit"
            class="primary-button full"
            [disabled]="loading() || form.invalid"
          >
            {{ loading() ? "Signing in…" : "Sign in to workspace"
            }}<app-icon name="arrow" [size]="18" />
          </button>
        </form>
        <p class="login-help">
          Need access? Contact your workspace administrator.
        </p>
      </div>
    </section>
  </main>`,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly error = signal("");
  readonly loading = signal(false);
  readonly showPassword = signal(false);
  readonly form = this.fb.nonNullable.group({
    usernameOrEmail: ["", [Validators.required, Validators.pattern(/\S/)]],
    password: ["", Validators.required],
  });
  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set("");
    this.auth
      .login(this.form.getRawValue())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl("/dashboard"),
        error: () =>
          this.error.set(
            "We couldn’t sign you in. Check your details or try again in a moment.",
          ),
      });
  }
}
