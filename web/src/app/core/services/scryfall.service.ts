import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ScryfallService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3333/api';

  autocomplete(q: string) {
    return this.http.get<string[]>(
      `${this.apiUrl}/scryfall/autocomplete?q=${encodeURIComponent(q)}`
    );
  }

  getCardImage(name: string) {
    return this.http.get<{ imageUrl: string | null }>(
      `${this.apiUrl}/scryfall/card-image?name=${encodeURIComponent(name)}`
    ).pipe(map(res => res.imageUrl));
  }
}
