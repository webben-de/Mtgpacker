import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

export interface GameEvent {
  id: number;
  title: string;
  date: string;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3333/api';

  events = signal<GameEvent[]>([]);

  load() {
    return this.http.get<GameEvent[]>(`${this.apiUrl}/events`).pipe(
      tap(data => this.events.set(data))
    );
  }

  create(title: string, date: string) {
    return this.http.post<GameEvent>(`${this.apiUrl}/events`, { title, date }).pipe(
      tap(ev => this.events.update(evs => [...evs, ev]))
    );
  }
}
