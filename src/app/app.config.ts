import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from "@angular/core";
import { provideRouter, withInMemoryScrolling } from "@angular/router";
import {
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration,
} from "@angular/common/http";
import { routes } from "./app.routes";
import { cookieInterceptor } from "./core/http/cookie.interceptor";
import { apiErrorInterceptor } from "./core/http/api-error.interceptor";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: "enabled",
        anchorScrolling: "enabled",
      }),
    ),
    provideHttpClient(
      withXsrfConfiguration({
        cookieName: "XSRF-TOKEN",
        headerName: "X-XSRF-TOKEN",
      }),
      withInterceptors([cookieInterceptor, apiErrorInterceptor]),
    ),
  ],
};
