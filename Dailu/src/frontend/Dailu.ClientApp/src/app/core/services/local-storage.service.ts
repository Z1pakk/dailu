import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private readonly prefix = 'dailu_';

  public set(key: string, value: string): void {
    localStorage.setItem(this.prefix + key, value);
  }

  public get(key: string): string | null {
    return localStorage.getItem(this.prefix + key);
  }

  public remove(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }
}
