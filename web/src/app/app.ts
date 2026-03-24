import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SidebarNavComponent } from './components/sidebar-nav/sidebar-nav.component';
import { GlobalFeedbackComponent } from './components/global-feedback/global-feedback.component';
import { VotingViewComponent } from './components/voting-view/voting-view.component';
import { OrderViewComponent } from './components/order-view/order-view.component';
import { AdminViewComponent } from './components/admin-view/admin-view.component';

interface Deck {
  id: number;
  name: string;
  url?: string;
  commander_image?: string;
}

interface GameEvent {
  id: number;
  title: string;
  date: string;
}

interface SummaryRow {
  title: string;
  name: string;
  stimmen: number;
}
interface DetailRow {
  event: string;
  deck: string;
  teilnehmer: string;
}

interface Order {
  id: number;
  user_name: string;
  github_login: string;
  github_avatar: string;
  moxfield_url: string;
  deck_name: string;
  card_count: number;
  total_price: number;
  notes: string;
  status: string;
  created_at: string;
}

interface MoxfieldPreview {
  deckName: string;
  commanderImage: string | null;
  cardCount: number;
  cardList: Array<{ name: string; quantity: number; set?: string }>;
}

interface GitHubUser {
  id: string;
  login: string;
  displayName: string;
  avatar: string;
  isAdmin: boolean;
}

type MenuView = 'Teilnehmer-Ansicht' | 'Verwalter-Bereich' | 'Bestellen';

const ORDER_STATUSES = [
  'offen',
  'in Bearbeitung',
  'abgeschlossen',
  'storniert',
] as const;
const PRICE_PER_CARD = 0.07;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    SidebarNavComponent,
    GlobalFeedbackComponent,
    VotingViewComponent,
    OrderViewComponent,
    AdminViewComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly vm = this;

  private http = inject(HttpClient);
  private readonly apiUrl = '/api';

  // ── Auth ─────────────────────────────────────────────────────────
  currentUser: GitHubUser | null = null;
  oauthEnabled = false;

  // ── Navigation ────────────────────────────────────────────────────
  menu: MenuView = 'Teilnehmer-Ansicht';
  adminTab: 'decks' | 'events' | 'results' | 'orders' = 'decks';
  viewMode: 'Raster' | 'Liste' = 'Raster';
  addMode: 'Moxfield-Import' | 'Manuell (Scryfall-Suche)' = 'Moxfield-Import';

  // ── Feedback ──────────────────────────────────────────────────────
  infoMessage = '';
  errorMessage = '';

  // ── Data ──────────────────────────────────────────────────────────
  decks: Deck[] = [];
  events: GameEvent[] = [];
  availableDecks: Deck[] = [];
  summaryRows: SummaryRow[] = [];
  detailRows: DetailRow[] = [];
  orders: Order[] = [];
  readonly orderStatuses = ORDER_STATUSES;

  // ── Voting state ──────────────────────────────────────────────────
  userName = '';
  selectedEventId: number | null = null;
  selectedDeckIds = new Set<number>();

  // ── Admin event form ──────────────────────────────────────────────
  eventTitle = '';
  eventDate = '';

  // ── Admin deck form ───────────────────────────────────────────────
  moxUrl = '';
  manualDeckName = '';
  commanderQuery = '';
  commanderSuggestions: string[] = [];
  selectedCommander = '';
  commanderPreviewImage = '';

  // ── Order form ────────────────────────────────────────────────────
  orderMoxUrl = '';
  orderNotes = '';
  orderPreview: MoxfieldPreview | null = null;
  orderLoading = false;
  orderSubmitting = false;
  readonly pricePerCard = PRICE_PER_CARD;

  get orderTotalPrice(): number {
    return (
      Math.round((this.orderPreview?.cardCount ?? 0) * PRICE_PER_CARD * 100) /
      100
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  ngOnInit() {
    this.loadAuth();
    this.loadDecks();
    this.loadEvents();
  }

  // ── Auth ──────────────────────────────────────────────────────────

  private loadAuth() {
    this.http
      .get<GitHubUser | null>(`${this.apiUrl}/auth/me`, {
        withCredentials: true,
      })
      .subscribe({
        next: (u) => {
          this.currentUser = u;
          if (u) this.userName = u.displayName || u.login;
        },
      });
    this.http
      .get<{ oauthEnabled: boolean }>(`${this.apiUrl}/health`)
      .subscribe({
        next: (h) => (this.oauthEnabled = h.oauthEnabled),
      });
  }

  login() {
    window.location.href = `${this.apiUrl}/auth/github`;
  }

  logout() {
    this.http
      .post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true })
      .subscribe({
        next: () => {
          this.currentUser = null;
          this.userName = '';
        },
      });
  }

  // ── Navigation ────────────────────────────────────────────────────

  onMenuChange() {
    this.clearMessages();
    if (this.menu === 'Verwalter-Bereich') this.loadResults();
    if (this.menu === 'Verwalter-Bereich' && this.adminTab === 'orders')
      this.loadOrders();
    if (this.menu === 'Bestellen') this.loadOrders();
  }

  onAdminTabChange() {
    if (this.adminTab === 'orders') this.loadOrders();
    if (this.adminTab === 'results') this.loadResults();
  }

  onUserNameChange() {
    this.selectedDeckIds.clear();
    if (this.selectedEventId && this.userName.trim()) this.loadAvailableDecks();
  }

  onEventChange() {
    this.selectedDeckIds.clear();
    if (this.selectedEventId && this.userName.trim()) this.loadAvailableDecks();
  }

  // ── Data loading ──────────────────────────────────────────────────

  private loadDecks() {
    this.http.get<Deck[]>(`${this.apiUrl}/decks`).subscribe({
      next: (d) => (this.decks = d),
      error: () => this.showError('Decks konnten nicht geladen werden.'),
    });
  }

  private loadEvents() {
    this.http.get<GameEvent[]>(`${this.apiUrl}/events`).subscribe({
      next: (e) => (this.events = e),
      error: () => this.showError('Events konnten nicht geladen werden.'),
    });
  }

  private loadAvailableDecks() {
    if (!this.selectedEventId || !this.userName.trim()) return;
    const params = `?userName=${encodeURIComponent(this.userName.trim())}`;
    this.http
      .get<
        Deck[]
      >(`${this.apiUrl}/events/${this.selectedEventId}/available-decks${params}`)
      .subscribe({
        next: (d) => (this.availableDecks = d),
        error: () =>
          this.showError('Verfügbare Decks konnten nicht geladen werden.'),
      });
  }

  private loadResults() {
    this.http
      .get<SummaryRow[]>(`${this.apiUrl}/results/summary`)
      .subscribe({ next: (r) => (this.summaryRows = r) });
    this.http
      .get<DetailRow[]>(`${this.apiUrl}/results/details`)
      .subscribe({ next: (r) => (this.detailRows = r) });
  }

  private loadOrders() {
    this.http
      .get<Order[]>(`${this.apiUrl}/orders`)
      .subscribe({ next: (o) => (this.orders = o) });
  }

  // ── Voting ────────────────────────────────────────────────────────

  toggleDeck(id: number) {
    if (this.selectedDeckIds.has(id)) {
      this.selectedDeckIds.delete(id);
    } else if (this.selectedDeckIds.size < 2) {
      this.selectedDeckIds.add(id);
    } else {
      this.showError('Maximal 2 Decks können ausgewählt werden.');
    }
  }

  submitVotes() {
    if (
      !this.selectedEventId ||
      !this.userName.trim() ||
      this.selectedDeckIds.size === 0
    )
      return;
    this.clearMessages();
    this.http
      .post(`${this.apiUrl}/votes`, {
        eventId: this.selectedEventId,
        userName: this.userName.trim(),
        deckIds: [...this.selectedDeckIds],
      })
      .subscribe({
        next: () => {
          this.showInfo('Deine Wünsche wurden gespeichert!');
          this.selectedDeckIds.clear();
          this.loadAvailableDecks();
        },
        error: () =>
          this.showError('Abstimmung konnte nicht gespeichert werden.'),
      });
  }

  // ── Admin: decks ──────────────────────────────────────────────────

  importDeckFromMoxfield() {
    if (!this.moxUrl.includes('moxfield.com')) return;
    this.clearMessages();
    this.http
      .post<Deck>(
        `${this.apiUrl}/decks/import-moxfield`,
        { url: this.moxUrl },
        { withCredentials: true },
      )
      .subscribe({
        next: (deck) => {
          this.showInfo(`"${deck.name}" erfolgreich importiert.`);
          this.moxUrl = '';
          this.loadDecks();
        },
        error: () => this.showError('Moxfield-Import fehlgeschlagen.'),
      });
  }

  addManualDeck() {
    if (!this.manualDeckName.trim()) return;
    this.clearMessages();
    this.http
      .post<Deck>(`${this.apiUrl}/decks`, {
        name: this.manualDeckName.trim(),
        commander_name: this.selectedCommander || null,
        commander_image: this.commanderPreviewImage || null,
      })
      .subscribe({
        next: (deck) => {
          this.showInfo(`"${deck.name}" wurde hinzugefügt.`);
          this.manualDeckName = '';
          this.selectedCommander = '';
          this.commanderPreviewImage = '';
          this.commanderQuery = '';
          this.loadDecks();
        },
        error: () => this.showError('Deck konnte nicht hinzugefügt werden.'),
      });
  }

  deleteDeck(id: number) {
    if (!confirm('Deck wirklich löschen?')) return;
    this.clearMessages();
    this.http.delete(`${this.apiUrl}/decks/${id}`).subscribe({
      next: () => {
        this.showInfo('Deck wurde gelöscht.');
        this.loadDecks();
      },
      error: () => this.showError('Deck konnte nicht gelöscht werden.'),
    });
  }

  // ── Admin: events ─────────────────────────────────────────────────

  createEvent() {
    if (!this.eventTitle.trim() || !this.eventDate) return;
    this.clearMessages();
    this.http
      .post<GameEvent>(`${this.apiUrl}/events`, {
        title: this.eventTitle.trim(),
        date: this.eventDate,
      })
      .subscribe({
        next: (ev) => {
          this.showInfo(`Event "${ev.title}" wurde angelegt.`);
          this.eventTitle = '';
          this.eventDate = '';
          this.loadEvents();
        },
        error: () => this.showError('Event konnte nicht erstellt werden.'),
      });
  }

  // ── Admin: orders ─────────────────────────────────────────────────

  updateOrderStatus(id: number, status: string) {
    this.http
      .patch(
        `${this.apiUrl}/orders/${id}`,
        { status },
        { withCredentials: true },
      )
      .subscribe({
        next: () => this.loadOrders(),
        error: () => this.showError('Status konnte nicht aktualisiert werden.'),
      });
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      offen: 'badge bg-amber-500/20 text-amber-300',
      'in Bearbeitung': 'badge bg-blue-500/20 text-blue-300',
      abgeschlossen: 'badge bg-emerald-500/20 text-emerald-300',
      storniert: 'badge bg-red-500/20 text-red-300',
    };
    return map[status] ?? 'badge';
  }

  // ── Order form ────────────────────────────────────────────────────

  previewOrder() {
    if (!this.orderMoxUrl.includes('moxfield.com')) return;
    this.orderLoading = true;
    this.orderPreview = null;
    this.clearMessages();
    this.http
      .post<MoxfieldPreview>(`${this.apiUrl}/decks/preview-moxfield`, {
        url: this.orderMoxUrl,
      })
      .subscribe({
        next: (p) => {
          this.orderPreview = p;
          this.orderLoading = false;
        },
        error: () => {
          this.showError('Deck konnte nicht geladen werden.');
          this.orderLoading = false;
        },
      });
  }

  submitOrder() {
    if (!this.orderPreview || !this.userName.trim()) return;
    this.orderSubmitting = true;
    this.clearMessages();
    this.http
      .post<Order>(
        `${this.apiUrl}/orders`,
        {
          moxfieldUrl: this.orderMoxUrl,
          userName: this.userName.trim(),
          notes: this.orderNotes,
        },
        { withCredentials: true },
      )
      .subscribe({
        next: (o) => {
          this.showInfo(
            `Bestellung für "${o.deck_name}" (${o.card_count} Karten, ${o.total_price.toFixed(2)} €) aufgegeben!`,
          );
          this.orderMoxUrl = '';
          this.orderNotes = '';
          this.orderPreview = null;
          this.orderSubmitting = false;
          this.loadOrders();
        },
        error: () => {
          this.showError('Bestellung konnte nicht aufgegeben werden.');
          this.orderSubmitting = false;
        },
      });
  }

  // ── Scryfall ──────────────────────────────────────────────────────

  searchCommanderAutocomplete() {
    if (this.commanderQuery.length < 2) {
      this.commanderSuggestions = [];
      return;
    }
    this.http
      .get<{
        data: string[];
      }>(
        `${this.apiUrl}/scryfall/autocomplete?q=${encodeURIComponent(this.commanderQuery)}`,
      )
      .subscribe({
        next: (res) =>
          (this.commanderSuggestions = res.data?.slice(0, 8) ?? []),
        error: () => (this.commanderSuggestions = []),
      });
  }

  updateCommanderSelection() {
    if (!this.selectedCommander) return;
    this.commanderQuery = this.selectedCommander;
    this.http
      .get<{
        imageUrl: string;
      }>(
        `${this.apiUrl}/scryfall/card-image?name=${encodeURIComponent(this.selectedCommander)}`,
      )
      .subscribe({
        next: (res) => (this.commanderPreviewImage = res.imageUrl ?? ''),
        error: () => (this.commanderPreviewImage = ''),
      });
  }

  // ── Utilities ─────────────────────────────────────────────────────

  private showInfo(msg: string) {
    this.infoMessage = msg;
    this.errorMessage = '';
    setTimeout(() => (this.infoMessage = ''), 5000);
  }

  private showError(msg: string) {
    this.errorMessage = msg;
    this.infoMessage = '';
    setTimeout(() => (this.errorMessage = ''), 7000);
  }

  private clearMessages() {
    this.infoMessage = '';
    this.errorMessage = '';
  }
}
