import { computed, Injectable, signal } from '@angular/core';
import { environment } from '@environment';

@Injectable()
export class AltchaService {
  public readonly challengeUrl = `${environment.apiUrl}/auth/altcha-challenge`;

  private readonly _captchaPayload = signal<string | null>(null);
  private readonly _state = signal<string>('unverified');

  public readonly $captchaPayload = this._captchaPayload.asReadonly();
  public readonly $isSolved = computed(() => this._captchaPayload() !== null);
  public readonly $isError = computed(() => this._state() === 'error');

  public onStateChange(event: Event): void {
    const { state, payload } = (
      event as CustomEvent<{ state: string; payload: string | null }>
    ).detail;
    this._state.set(state);
    this._captchaPayload.set(state === 'verified' ? payload : null);
  }
}
