import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { Deck } from './deck.service';

export interface VoteResult {
  event_title: string;
  deck_name: string;
  votes: number;
}

export interface VoteDetail {
  event: string;
  deck: string;
  participant: string;
}

@Injectable({ providedIn: 'root' })
export class VoteService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3333/api';

  results = signal<VoteResult[]>([]);
  details = signal<VoteDetail[]>([]);

  loadAvailableDecks(eventId: number, userName: string) {
    const name = encodeURIComponent(userName.trim());
    return this.http.get<Deck[]>(`${this.apiUrl}/events/${eventId}/available-decks?userName=${name}`);
  }

  submit(eventId: number, deckIds: number[], userName: string) {
    return this.http.post(`${this.apiUrl}/votes`, { eventId, deckIds, userName: userName.trim() });
  }

  loadResults() {
    return this.http.get<{ title: string; name: string; stimmen: number }[]>(
      `${this.apiUrl}/results/summary`
    ).pipe(
      tap(rows => this.results.set(rows.map(r => ({ event_title: r.title, deck_name: r.name, votes: r.stimmen }))))
    );
  }

  loadDetails() {
    return this.http.get<{ event: string; deck: string; teilnehmer: string }[]>(
      `${this.apiUrl}/results/details`
    ).pipe(
      tap(rows => this.details.set(rows.map(r => ({ event: r.event, deck: r.deck, participant: r.teilnehmer }))))
    );
  }
}
