import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

export interface Deck {
  id: number;
  name: string;
  url: string;
  commander_image: string | null;
}

@Injectable({ providedIn: 'root' })
export class DeckService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3333/api';

  decks = signal<Deck[]>([]);

  load() {
    return this.http.get<Deck[]>(`${this.apiUrl}/decks`).pipe(
      tap(data => this.decks.set(data))
    );
  }

  importFromMoxfield(url: string) {
    return this.http.post<Deck>(`${this.apiUrl}/decks/import-moxfield`, { url: url.trim() });
  }

  addManual(name: string, commanderName?: string) {
    return this.http.post<Deck>(`${this.apiUrl}/decks/manual`, { name, commanderName });
  }

  delete(id: number) {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/decks/${id}`).pipe(
      tap(() => this.decks.update(ds => ds.filter(d => d.id !== id)))
    );
  }
}
