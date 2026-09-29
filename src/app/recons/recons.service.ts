import { Injectable } from '@angular/core';

declare var grecaptcha: any;

@Injectable({
  providedIn: 'root',
})
export class RecaptchaService {
  private siteKey = '6LdLGxosAAAAAF8hkAkAB7vdI3oGRlRouh4TfHh_'; // Reemplaza con tu clave del sitio

  constructor() {}

  getRecaptchaToken(action: string): Promise<string> {
    return new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha
          .execute(this.siteKey, { action })
          .then((token: string) => resolve(token))
          .catch((error: any) => reject(error));
      });
    });
  }
}
