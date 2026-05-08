import { Injectable } from '@angular/core';
import { fromEvent, map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BroadcastService {
  private readonly _channels = new Map<string, BroadcastChannel>();

  public post(channel: string, message: string): void {
    this.getOrCreate(channel).postMessage(message);
  }

  public messages$(channel: string): Observable<string> {
    return fromEvent<MessageEvent>(this.getOrCreate(channel), 'message').pipe(
      map((e) => e.data),
    );
  }

  private getOrCreate(name: string): BroadcastChannel {
    if (!this._channels.has(name)) {
      this._channels.set(name, new BroadcastChannel(name));
    }
    return this._channels.get(name)!;
  }
}
