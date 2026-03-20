import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeckService } from '../../core/services/deck.service';
import { EventService } from '../../core/services/event.service';
import { VoteService } from '../../core/services/vote.service';
import { ScryfallService } from '../../core/services/scryfall.service';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 md:p-8 animate-fade-in">
      <div class="max-w-4xl mx-auto">

        <!-- Header -->
        <header class="mb-8">
          <h1 class="font-display text-3xl text-mtg-gold mb-1">Admin Dashboard</h1>
          <p class="font-body text-sm text-mtg-muted">Verwalte Decks, Events und Abstimmungsergebnisse.</p>
        </header>

        <!-- Tabs -->
        <div class="flex border-b border-mtg-border mb-8 gap-1" role="tablist">
          @for (tab of tabs; track tab.id) {
            <button
              (click)="setTab(tab.id)"
              [class]="activeTab() === tab.id ? 'tab-btn-active' : 'tab-btn'"
              role="tab"
              [attr.aria-selected]="activeTab() === tab.id"
              [attr.aria-controls]="'panel-' + tab.id"
              [id]="'tab-' + tab.id">
              {{ tab.label }}
            </button>
          }
        </div>

        <!-- ── DECKS TAB ────────────────────────────────────────── -->
        @if (activeTab() === 'decks') {
          <div id="panel-decks" role="tabpanel" aria-labelledby="tab-decks" class="animate-fade-in">

            <h2 class="section-title mb-5">Neues Deck hinzufügen</h2>

            <!-- Mode toggle -->
            <div class="flex bg-mtg-bg border border-mtg-border rounded-lg overflow-hidden w-fit mb-5" role="group" aria-label="Importmethode">
              <button (click)="addMode.set('moxfield')"
                [class]="addMode() === 'moxfield' ? 'bg-mtg-primary text-white' : 'text-mtg-muted hover:text-mtg-text'"
                class="px-4 py-2 font-body text-sm transition-colors duration-150 cursor-pointer"
                [attr.aria-pressed]="addMode() === 'moxfield'">Moxfield Import</button>
              <button (click)="addMode.set('manual')"
                [class]="addMode() === 'manual' ? 'bg-mtg-primary text-white' : 'text-mtg-muted hover:text-mtg-text'"
                class="px-4 py-2 font-body text-sm transition-colors duration-150 cursor-pointer"
                [attr.aria-pressed]="addMode() === 'manual'">Manuell</button>
            </div>

            <!-- Moxfield import -->
            @if (addMode() === 'moxfield') {
              <div class="card p-5 mb-8">
                <label for="mox-url" class="block font-body text-xs font-medium text-mtg-secondary mb-2 uppercase tracking-wider">Moxfield Link</label>
                <div class="flex gap-3">
                  <input id="mox-url" [(ngModel)]="moxUrl" type="url" placeholder="https://www.moxfield.com/decks/..."
                    class="input flex-1" autocomplete="off" />
                  <button (click)="importMoxfield()" [disabled]="importing() || !moxUrl.includes('moxfield.com')"
                    class="btn-primary shrink-0">
                    @if (importing()) {
                      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Importiere...
                    } @else {
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                      Importieren
                    }
                  </button>
                </div>
                @if (importMessage()) {
                  <div class="mt-3 animate-fade-in">
                    @if (importMessageType() === 'success') {
                      <div class="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center gap-3">
                        <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                        <p class="font-body text-sm text-emerald-300">{{ importMessage() }}</p>
                      </div>
                    } @else {
                      <div class="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 flex items-center gap-3">
                        <svg class="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>
                        <p class="font-body text-sm text-red-300">{{ importMessage() }}</p>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- Manual add -->
            @if (addMode() === 'manual') {
              <div class="card p-5 mb-8 space-y-4">
                <div>
                  <label for="deck-name" class="block font-body text-xs font-medium text-mtg-secondary mb-2 uppercase tracking-wider">Deck-Name <span class="text-mtg-accent" aria-label="Pflichtfeld">*</span></label>
                  <input id="deck-name" [(ngModel)]="manualDeckName" type="text" placeholder="z. B. Zur's Weirding Control" class="input" required />
                </div>
                <div>
                  <label for="commander-search" class="block font-body text-xs font-medium text-mtg-secondary mb-2 uppercase tracking-wider">Commander suchen</label>
                  <input id="commander-search" [(ngModel)]="commanderQuery" (ngModelChange)="onCommanderSearch($event)"
                    type="text" placeholder="z. B. Atraxa, Praetors' Voice" class="input" autocomplete="off" />
                  @if (commanderSuggestions().length > 0) {
                    <ul class="mt-1 card py-1 max-h-44 overflow-y-auto" role="listbox" aria-label="Commander-Vorschläge">
                      @for (s of commanderSuggestions(); track s) {
                        <li (click)="selectCommander(s)" (keydown.enter)="selectCommander(s)"
                          role="option" tabindex="0" [attr.aria-selected]="selectedCommander() === s"
                          class="px-4 py-2 font-body text-sm text-mtg-text hover:bg-mtg-primary/10 cursor-pointer transition-colors duration-100 focus-visible:bg-mtg-primary/10 outline-none">{{ s }}</li>
                      }
                    </ul>
                  }
                  @if (selectedCommander() && commanderPreviewImage()) {
                    <div class="mt-3 flex items-center gap-3 animate-fade-in">
                      <img [src]="commanderPreviewImage()!" [alt]="selectedCommander()! + ' preview'"
                           class="w-14 rounded-lg" style="aspect-ratio:5/7; object-fit:cover" loading="lazy" />
                      <p class="font-body text-sm text-mtg-secondary">{{ selectedCommander() }}</p>
                    </div>
                  }
                </div>
                <button (click)="addManualDeck()" [disabled]="!manualDeckName.trim() || adding()"
                  class="btn-primary">
                  @if (adding()) {
                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Hinzufügen...
                  } @else {
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                    Deck hinzufügen
                  }
                </button>
              </div>
            }

            <!-- Deck list -->
            <h2 class="section-title mb-4">Deckliste</h2>
            @if (deckService.decks().length === 0) {
              <div class="card p-10 text-center">
                <svg class="w-10 h-10 text-mtg-muted/40 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5Z"/></svg>
                <p class="font-body text-sm text-mtg-muted">Noch keine Decks vorhanden.</p>
              </div>
            } @else {
              <div class="space-y-2" role="list">
                @for (deck of deckService.decks(); track deck.id) {
                  <div class="card flex items-center gap-4 p-3 group" role="listitem">
                    @if (deck.commander_image) {
                      <img [src]="deck.commander_image" [alt]="deck.name + ' Commander'" loading="lazy"
                           class="w-12 rounded-lg shrink-0 object-cover" style="aspect-ratio:5/7" />
                    } @else {
                      <div class="w-12 shrink-0 rounded-lg bg-mtg-border/30 flex items-center justify-center" style="aspect-ratio:5/7">
                        <svg class="w-5 h-5 text-mtg-muted/40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>
                      </div>
                    }
                    <div class="flex-1 min-w-0">
                      <p class="font-body text-sm font-semibold text-mtg-text truncate">{{ deck.name }}</p>
                      @if (deck.url) {
                        <a [href]="deck.url" target="_blank" rel="noopener noreferrer"
                           class="font-body text-xs text-mtg-secondary hover:text-mtg-text transition-colors duration-150">Moxfield ↗</a>
                      }
                    </div>
                    <button (click)="deleteDeck(deck.id)"
                      class="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-mtg-muted hover:text-mtg-destructive hover:bg-mtg-destructive/10 transition-all duration-200 cursor-pointer focus-visible:opacity-100"
                      [attr.aria-label]="'Deck ' + deck.name + ' löschen'">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- ── EVENTS TAB ─────────────────────────────────────────── -->
        @if (activeTab() === 'events') {
          <div id="panel-events" role="tabpanel" aria-labelledby="tab-events" class="animate-fade-in">
            <h2 class="section-title mb-5">Neuen Spieleabend anlegen</h2>
            <div class="card p-5 mb-8">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label for="event-title" class="block font-body text-xs font-medium text-mtg-secondary mb-2 uppercase tracking-wider">Event Name <span class="text-mtg-accent" aria-label="Pflichtfeld">*</span></label>
                  <input id="event-title" [(ngModel)]="eventTitle" type="text" placeholder="Friday Night Magic" class="input" required />
                </div>
                <div>
                  <label for="event-date" class="block font-body text-xs font-medium text-mtg-secondary mb-2 uppercase tracking-wider">Datum <span class="text-mtg-accent" aria-label="Pflichtfeld">*</span></label>
                  <input id="event-date" [(ngModel)]="eventDate" type="date" class="input" required />
                </div>
              </div>
              <button (click)="createEvent()" [disabled]="!eventTitle.trim() || !eventDate" class="btn-primary">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                Event anlegen
              </button>
              @if (eventMessage()) {
                <div class="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 animate-fade-in" role="status" aria-live="polite">
                  <p class="font-body text-sm text-emerald-300">{{ eventMessage() }}</p>
                </div>
              }
            </div>

            <h2 class="section-title mb-4">Geplante Events</h2>
            @if (eventService.events().length === 0) {
              <div class="card p-10 text-center">
                <p class="font-body text-sm text-mtg-muted">Noch keine Events geplant.</p>
              </div>
            } @else {
              <div class="space-y-2">
                @for (event of eventService.events(); track event.id) {
                  <div class="card flex items-center gap-4 px-4 py-3">
                    <div class="w-9 h-9 rounded-lg bg-mtg-primary/15 border border-mtg-primary/30 flex items-center justify-center shrink-0">
                      <svg class="w-4 h-4 text-mtg-secondary" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>
                    </div>
                    <div>
                      <p class="font-body text-sm font-semibold text-mtg-text">{{ event.title }}</p>
                      <time class="font-body text-xs text-mtg-muted" [attr.dateTime]="event.date">{{ event.date }}</time>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- ── RESULTS TAB ────────────────────────────────────────── -->
        @if (activeTab() === 'results') {
          <div id="panel-results" role="tabpanel" aria-labelledby="tab-results" class="animate-fade-in">
            <h2 class="section-title mb-5">Packliste — Top Votes</h2>
            @if (voteService.results().length === 0) {
              <div class="card p-10 text-center mb-8">
                <p class="font-body text-sm text-mtg-muted">Noch keine Abstimmungen vorhanden.</p>
              </div>
            } @else {
              <div class="card overflow-hidden mb-8">
                <table class="w-full text-sm" aria-label="Abstimmungsergebnisse">
                  <thead>
                    <tr class="border-b border-mtg-border bg-mtg-bg/50">
                      <th scope="col" class="text-left px-4 py-3 font-body text-xs font-medium text-mtg-secondary uppercase tracking-wider">Event</th>
                      <th scope="col" class="text-left px-4 py-3 font-body text-xs font-medium text-mtg-secondary uppercase tracking-wider">Deck</th>
                      <th scope="col" class="text-right px-4 py-3 font-body text-xs font-medium text-mtg-secondary uppercase tracking-wider">Stimmen</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of voteService.results(); track $index; let even = $even) {
                      <tr [class]="even ? 'bg-mtg-bg/20' : ''" class="border-b border-mtg-border/50 hover:bg-mtg-primary/5 transition-colors duration-100">
                        <td class="px-4 py-3 font-body text-sm text-mtg-text">{{ r.event_title }}</td>
                        <td class="px-4 py-3 font-body text-sm text-mtg-text">{{ r.deck_name }}</td>
                        <td class="px-4 py-3 text-right">
                          <span class="badge badge-primary">{{ r.votes }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <h2 class="section-title mb-4">Teilnehmer Details</h2>
            @if (voteService.details().length === 0) {
              <div class="card p-10 text-center">
                <p class="font-body text-sm text-mtg-muted">Keine Details vorhanden.</p>
              </div>
            } @else {
              <div class="card overflow-hidden">
                <table class="w-full text-sm" aria-label="Teilnehmer Details">
                  <thead>
                    <tr class="border-b border-mtg-border bg-mtg-bg/50">
                      <th scope="col" class="text-left px-4 py-3 font-body text-xs font-medium text-mtg-secondary uppercase tracking-wider">Event</th>
                      <th scope="col" class="text-left px-4 py-3 font-body text-xs font-medium text-mtg-secondary uppercase tracking-wider">Deck</th>
                      <th scope="col" class="text-left px-4 py-3 font-body text-xs font-medium text-mtg-secondary uppercase tracking-wider">Teilnehmer</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (d of voteService.details(); track $index; let even = $even) {
                      <tr [class]="even ? 'bg-mtg-bg/20' : ''" class="border-b border-mtg-border/50 hover:bg-mtg-primary/5 transition-colors duration-100">
                        <td class="px-4 py-3 font-body text-sm text-mtg-text">{{ d.event }}</td>
                        <td class="px-4 py-3 font-body text-sm text-mtg-text">{{ d.deck }}</td>
                        <td class="px-4 py-3 font-body text-sm text-mtg-muted">{{ d.participant }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }

      </div>
    </div>
  `,
})
export class AdminComponent implements OnInit {
  deckService = inject(DeckService);
  eventService = inject(EventService);
  voteService = inject(VoteService);
  private scryfallService = inject(ScryfallService);

  readonly tabs = [
    { id: 'decks'   as const, label: 'Deck-Verwaltung' },
    { id: 'events'  as const, label: 'Event erstellen' },
    { id: 'results' as const, label: 'Auswertung' },
  ];

  activeTab = signal<'decks' | 'events' | 'results'>('decks');
  addMode = signal<'moxfield' | 'manual'>('moxfield');

  moxUrl = '';
  importing = signal(false);
  importMessage = signal('');
  importMessageType = signal<'success' | 'error'>('success');

  manualDeckName = '';
  commanderQuery = '';
  commanderSuggestions = signal<string[]>([]);
  selectedCommander = signal<string | null>(null);
  commanderPreviewImage = signal<string | null>(null);
  adding = signal(false);
  private commanderSearch$ = new Subject<string>();

  eventTitle = '';
  eventDate = '';
  eventMessage = signal('');

  setTab(id: 'decks' | 'events' | 'results') { this.activeTab.set(id); }

  ngOnInit() {
    this.deckService.load().subscribe();
    this.eventService.load().subscribe();
    this.voteService.loadResults().subscribe();
    this.voteService.loadDetails().subscribe();

    this.commanderSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => this.scryfallService.autocomplete(q))
    ).subscribe(s => this.commanderSuggestions.set(s));
  }

  importMoxfield() {
    if (!this.moxUrl.includes('moxfield.com')) return;
    this.importing.set(true);
    this.importMessage.set('');
    this.deckService.importFromMoxfield(this.moxUrl).subscribe({
      next: (deck) => {
        this.deckService.load().subscribe();
        this.importMessage.set(`Deck "${deck.name}" erfolgreich importiert!`);
        this.importMessageType.set('success');
        this.moxUrl = '';
        this.importing.set(false);
        setTimeout(() => this.importMessage.set(''), 5000);
      },
      error: () => {
        this.importMessage.set('Import fehlgeschlagen. URL prüfen und erneut versuchen.');
        this.importMessageType.set('error');
        this.importing.set(false);
      },
    });
  }

  onCommanderSearch(q: string) {
    this.selectedCommander.set(null);
    this.commanderPreviewImage.set(null);
    if (q.length >= 2) this.commanderSearch$.next(q);
    else this.commanderSuggestions.set([]);
  }

  selectCommander(name: string) {
    this.commanderQuery = name;
    this.selectedCommander.set(name);
    this.commanderSuggestions.set([]);
    this.scryfallService.getCardImage(name).subscribe(url => this.commanderPreviewImage.set(url));
  }

  addManualDeck() {
    if (!this.manualDeckName.trim()) return;
    this.adding.set(true);
    this.deckService.addManual(this.manualDeckName.trim(), this.selectedCommander() ?? undefined).subscribe({
      next: () => {
        this.deckService.load().subscribe();
        this.manualDeckName = '';
        this.commanderQuery = '';
        this.selectedCommander.set(null);
        this.commanderPreviewImage.set(null);
        this.adding.set(false);
      },
      error: () => this.adding.set(false),
    });
  }

  deleteDeck(id: number) { this.deckService.delete(id).subscribe(); }

  createEvent() {
    if (!this.eventTitle.trim() || !this.eventDate) return;
    this.eventService.create(this.eventTitle, this.eventDate).subscribe({
      next: () => {
        this.eventMessage.set(`Event "${this.eventTitle}" am ${this.eventDate} erstellt.`);
        this.eventTitle = ''; this.eventDate = '';
        setTimeout(() => this.eventMessage.set(''), 4000);
      },
    });
  }
}
