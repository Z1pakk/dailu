import { Injectable } from '@angular/core';
import { ParamMap } from '@angular/router';
import { Observable } from 'rxjs';

export class OAuthPopupBlockedError extends Error {
  constructor() {
    super('OAuth popup was blocked by the browser');
  }
}

export class OAuthConnectionError extends Error {
  constructor() {
    super('OAuth connection failed');
  }
}

interface OAuthMessage {
  type: string;
  status: 'connected' | 'error';
}

@Injectable({ providedIn: 'root' })
export class OAuthPopupService {
  open(authUrl: string, channel: string): Observable<void> {
    return new Observable(observer => {
      const width = 600;
      const height = 700;
      const left = Math.round((screen.width - width) / 2);
      const top = Math.round((screen.height - height) / 2);

      const popup = window.open(
        authUrl,
        channel,
        `width=${width},height=${height},left=${left},top=${top},resizable=yes`,
      );

      if (!popup) {
        observer.error(new OAuthPopupBlockedError());
        return;
      }

      const listener = (event: MessageEvent<OAuthMessage>) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== channel) return;

        window.removeEventListener('message', listener);

        if (event.data.status === 'connected') {
          observer.next();
          observer.complete();
        } else {
          observer.error(new OAuthConnectionError());
        }
      };

      window.addEventListener('message', listener);

      return () => window.removeEventListener('message', listener);
    });
  }

  handleCallbackIfInPopup(
    params: ParamMap,
    successParam: string,
    errorParam: string,
    channel: string,
  ): boolean {
    if (!window.opener) return false;

    const msg: OAuthMessage = {
      type: channel,
      status: params.has(successParam) ? 'connected' : 'error',
    };

    window.opener.postMessage(msg, window.location.origin);
    window.close();
    return true;
  }
}
