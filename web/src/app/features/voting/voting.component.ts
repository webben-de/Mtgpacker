import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../core/services/event.service';
import { VoteService } from '../../core/services/vote.service';
import { Deck } from '../../core/services/deck.service';

@Component({
  selector: 'app-voting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 md:p-8 animate-fade-in">
      <div class="max-w-5xl mx-auto">

        <!-- Header -->
        <header class="mb-8">
          <h1 class="font-display text-3xl text-mtg-gold mb-1">Abstimmung</h1>
          <p class="font-body text-sm text-mtg-muted">Wähle bis zu 2 Decks, die zum nächsten Abend mitgebracht werden sollen.</p>
        </header>

        <!-- User + Event row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div>
            <label for="user-name" class="block font-body text-xs font-medium text-mtg-secondary mb-2 uppercase tracking-wider">
              Dein Name
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-mtg-muted">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>
                </svg>
              </span>
              <input
                id="user-name"
                [(ngModel)]="userName"
                (ngModelChange)="onUserNameChange()"
                type="text"
                autocomplete="given-name"
                placeholder="Vor- oder Spitzname"
                class="input pl-9"
              />
            </div>
          </div>

          <div>
            <label for="event-select" class="block font-body text-xs font-medium text-mtg-secondary mb-2 uppercase tracking-wider">
              Event
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-mtg-muted pointer-events-none">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
                </svg>
              </span>
              <select
                id="event-select"
                [(ngModel)]="selectedEventId"
                (ngModelChange)="onEventChange()"
                class="input pl-9 appearance-none cursor-pointer"
              >
                <option [ngValue]="null" disabled>Event wählen...</option>
                @for (event of events(); track event.id) {
                  <option [ngValue]="event.id">{{ event.title }} — {{ event.date }}</option>
                }
              </select>
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-mtg-muted pointer-events-none">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
                </svg>
              </span>
            </div>
          </div>
        </div>

        <!-- Empty: no events -->
        @if (events().length === 0) {
          <div class="card p-12 text-center">
            <svg class="w-12 h-12 text-mtg-muted mx-auto mb-4" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
            </svg>
            <p class="font-body text-mtg-muted">Aktuell sind keine Events geplant.</p>
            <p class="font-body text-xs text-mtg-muted/60 mt-1">Bitte den Admin, ein Event anzulegen.</p>
          </div>
        }

        @if (selectedEventId && !userName.trim()) {
          <div class="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 mb-6 flex items-center gap-3" role="alert">
            <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
            </svg>
            <p class="font-body text-sm text-amber-300">Bitte gib deinen Namen ein, um abstimmen zu können.</p>
          </div>
        }

        @if (selectedEventId && userName.trim()) {
          <!-- Deck section header -->
          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="font-display text-lg text-mtg-text">Welche Decks soll ich mitbringen?</h2>
              <p class="font-body text-xs text-mtg-muted mt-0.5">Maximal 2 Decks auswählen</p>
            </div>
            <!-- View toggle -->
            <div class="flex bg-mtg-bg border border-mtg-border rounded-lg overflow-hidden" role="group" aria-label="Ansicht wählen">
              <button (click)="viewMode.set('grid')"
                [class]="viewMode() === 'grid' ? 'bg-mtg-primary text-white' : 'text-mtg-muted hover:text-mtg-text'"
                class="px-3 py-1.5 text-xs font-body transition-colors duration-150 cursor-pointer"
                [attr.aria-pressed]="viewMode() === 'grid'">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"/></svg>
              </button>
              <button (click)="viewMode.set('list')"
                [class]="viewMode() === 'list' ? 'bg-mtg-primary text-white' : 'text-mtg-muted hover:text-mtg-text'"
                class="px-3 py-1.5 text-xs font-body transition-colors duration-150 cursor-pointer"
                [attr.aria-pressed]="viewMode() === 'list'">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>
              </button>
            </div>
          </div>

          <!-- Loading state -->
          @if (loading()) {
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
              @for (i of [1,2,3,4]; track i) {
                <div class="card animate-pulse">
                  <div class="bg-mtg-border rounded-t-xl" style="aspect-ratio:5/7"></div>
                  <div class="p-3 space-y-2">
                    <div class="h-3 bg-mtg-border rounded w-3/4"></div>
                  </div>
                </div>
              }
            </div>
          }

          @if (!loading() && availableDecks().length === 0) {
            <div class="card p-10 text-center mb-8">
              <p class="font-body text-mtg-muted">Alle Decks wurden bereits reserviert.</p>
            </div>
          }

          <!-- Grid view -->
          @if (!loading() && viewMode() === 'grid' && availableDecks().length > 0) {
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8" role="list">
              @for (deck of availableDecks(); track deck.id) {
                <div
                  (click)="toggleDeck(deck.id)"
                  (keydown.enter)="toggleDeck(deck.id)"
                  (keydown.space)="$event.preventDefault(); toggleDeck(deck.id)"
                  [attr.aria-checked]="isSelected(deck.id)"
                  role="checkbox"
                  tabindex="0"
                  [class]="isSelected(deck.id)
                    ? 'card border-mtg-border-bright shadow-glow-primary ring-1 ring-mtg-primary/60 scale-[1.02]'
                    : 'card hover:border-mtg-primary/50 hover:shadow-glow-primary hover:scale-[1.01]'"
                  class="cursor-pointer transition-all duration-200 overflow-hidden group outline-none focus-visible:ring-2 focus-visible:ring-mtg-primary"
                  [attr.aria-label]="deck.name + (isSelected(deck.id) ? ' — ausgewählt' : '')">

                  <!-- Card art -->
                  <div class="relative overflow-hidden" style="aspect-ratio:5/7">
                    @if (deck.commander_image) {
                      <img [src]="deck.commander_image" [alt]="deck.name + ' Commander'"
                           class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    } @else {
                      <div class="w-full h-full bg-mtg-border/40 flex items-center justify-center">
                        <svg class="w-10 h-10 text-mtg-muted/50" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75Z"/>
                        </svg>
                      </div>
                    }
                    <!-- Selection overlay -->
                    @if (isSelected(deck.id)) {
                      <div class="absolute inset-0 bg-mtg-primary/20 flex items-center justify-center">
                        <div class="w-9 h-9 rounded-full bg-mtg-primary flex items-center justify-center shadow-glow-primary">
                          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                          </svg>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Card footer -->
                  <div class="px-3 py-2.5">
                    <p class="font-body text-xs font-semibold text-mtg-text truncate">{{ deck.name }}</p>
                    @if (deck.url) {
                      <a [href]="deck.url" target="_blank" rel="noopener noreferrer"
                         (click)="$event.stopPropagation()"
                         class="font-body text-[10px] text-mtg-secondary hover:text-mtg-text transition-colors duration-150">
                        Moxfield ↗
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- List view -->
          @if (!loading() && viewMode() === 'list' && availableDecks().length > 0) {
            <div class="space-y-2 mb-8" role="list">
              @for (deck of availableDecks(); track deck.id) {
                <div
                  (click)="toggleDeck(deck.id)"
                  (keydown.enter)="toggleDeck(deck.id)"
                  (keydown.space)="$event.preventDefault(); toggleDeck(deck.id)"
                  [attr.aria-checked]="isSelected(deck.id)"
                  role="checkbox"
                  tabindex="0"
                  [class]="isSelected(deck.id)
                    ? 'card border-mtg-border-bright shadow-glow-primary bg-mtg-primary/5'
                    : 'card hover:border-mtg-primary/50'"
                  class="flex items-center gap-4 p-3 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-mtg-primary"
                  [attr.aria-label]="deck.name + (isSelected(deck.id) ? ' — ausgewählt' : '')">

                  @if (deck.commander_image) {
                    <img [src]="deck.commander_image" [alt]="deck.name + ' Commander'"
                         class="w-12 rounded-lg shrink-0 object-cover" style="aspect-ratio:5/7" loading="lazy" />
                  } @else {
                    <div class="w-12 shrink-0 bg-mtg-border/40 rounded-lg flex items-center justify-center" style="aspect-ratio:5/7">
                      <svg class="w-5 h-5 text-mtg-muted/50" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>
                      </svg>
                    </div>
                  }

                  <div class="flex-1 min-w-0">
                    <p class="font-body text-sm font-semibold text-mtg-text truncate">{{ deck.name }}</p>
                    @if (deck.url) {
                      <a [href]="deck.url" target="_blank" rel="noopener noreferrer"
                         (click)="$event.stopPropagation()"
                         class="font-body text-xs text-mtg-secondary hover:text-mtg-text transition-colors duration-150">
                        Moxfield ↗
                      </a>
                    }
                  </div>

                  <div [class]="isSelected(deck.id) ? 'w-5 h-5 rounded bg-mtg-primary flex items-center justify-center' : 'w-5 h-5 rounded border border-mtg-border'" class="shrink-0 transition-all duration-150">
                    @if (isSelected(deck.id)) {
                      <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                      </svg>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Submit bar -->
          <div class="flex flex-wrap items-center gap-4">
            <button
              (click)="submit()"
              [disabled]="selectedDecks().length === 0 || selectedDecks().length > 2 || submitting()"
              class="btn-accent min-w-[160px] justify-center">
              @if (submitting()) {
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span>Wird gespeichert...</span>
              } @else {
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                <span>Wünsche abschicken</span>
              }
            </button>

            @if (selectedDecks().length > 0) {
              <span class="font-body text-xs text-mtg-muted">
                <span class="text-mtg-secondary font-semibold">{{ selectedDecks().length }}</span>/2 Decks ausgewählt
              </span>
            }
          </div>

          <!-- Feedback messages -->
          @if (message()) {
            <div class="mt-4 animate-fade-in" role="status" aria-live="polite">
              @if (messageType() === 'success') {
                <div class="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center gap-3">
                  <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                  <p class="font-body text-sm text-emerald-300">{{ message() }}</p>
                </div>
              } @else {
                <div class="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 flex items-center gap-3">
                  <svg class="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>
                  <p class="font-body text-sm text-red-300">{{ message() }}</p>
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class VotingComponent implements OnInit {
  private eventService = inject(EventService);
  private voteService = inject(VoteService);

  events = this.eventService.events;
  availableDecks = signal<Deck[]>([]);
  selectedDecks = signal<number[]>([]);
  viewMode = signal<'grid' | 'list'>('grid');
  loading = signal(false);
  submitting = signal(false);
  message = signal('');
  messageType = signal<'success' | 'error'>('success');

  userName = '';
  selectedEventId: number | null = null;

  ngOnInit() {
    this.eventService.load().subscribe();
  }

  onUserNameChange() {
    if (this.selectedEventId && this.userName.trim()) this.loadDecks();
  }

  onEventChange() {
    this.selectedDecks.set([]);
    if (this.selectedEventId && this.userName.trim()) this.loadDecks();
  }

  loadDecks() {
    this.loading.set(true);
    this.voteService.loadAvailableDecks(this.selectedEventId!, this.userName.trim()).subscribe({
      next: (decks) => { this.availableDecks.set(decks); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  isSelected(id: number) { return this.selectedDecks().includes(id); }

  toggleDeck(id: number) {
    const current = this.selectedDecks();
    if (current.includes(id)) {
      this.selectedDecks.set(current.filter(d => d !== id));
    } else if (current.length < 2) {
      this.selectedDecks.set([...current, id]);
    }
  }

  submit() {
    if (!this.userName.trim() || this.selectedDecks().length === 0) return;
    this.submitting.set(true);
    this.voteService.submit(this.selectedEventId!, this.selectedDecks(), this.userName.trim()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showMessage('Deine Wünsche wurden gespeichert!', 'success');
        this.selectedDecks.set([]);
        this.loadDecks();
      },
      error: () => {
        this.submitting.set(false);
        this.showMessage('Fehler beim Speichern. Bitte erneut versuchen.', 'error');
      },
    });
  }

  private showMessage(msg: string, type: 'success' | 'error') {
    this.message.set(msg);
    this.messageType.set(type);
    setTimeout(() => this.message.set(''), 5000);
  }
}
