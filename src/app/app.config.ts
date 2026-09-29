import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { RECAPTCHA_SETTINGS, RecaptchaModule } from 'ng-recaptcha';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    importProvidersFrom(RecaptchaModule),
    {
      provide: RECAPTCHA_SETTINGS,
      useValue: {
        siteKey: '6Lev7IYrAAAAANGSU0uF_jbwRu3LF0AXfgVBgNQG',
      },
    },
  ],
};
