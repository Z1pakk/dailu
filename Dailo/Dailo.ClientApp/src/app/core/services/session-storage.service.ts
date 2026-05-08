import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SessionStorageService {
  private readonly prefix = 'dailu_';

  public set(key: string, value: string): void {
    sessionStorage.setItem(this.prefix + key, value);
  }

  public get(key: string): string | null {
    console.log(
      'Getting session storage item:',
      sessionStorage.getItem(this.prefix + key),
    );

    return sessionStorage.getItem(this.prefix + key);
  }

  public remove(key: string): void {
    sessionStorage.removeItem(this.prefix + key);
  }
}
