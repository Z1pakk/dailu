import { HttpContext, HttpContextToken } from '@angular/common/http';

export const SHOW_ERROR_NOTIFICATION = new HttpContextToken<boolean>(() => true);

export class HttpRequestContext {
  private readonly _context = new HttpContext();

  showErrorNotification(value: boolean): this {
    this._context.set(SHOW_ERROR_NOTIFICATION, value);
    return this;
  }

  build(): HttpContext {
    return this._context;
  }
}

export function httpContext(): HttpRequestContext {
  return new HttpRequestContext();
}
