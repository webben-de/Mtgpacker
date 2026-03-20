import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-dvh bg-mtg-bg">

      <!-- Sidebar -->
      <aside class="w-60 bg-mtg-card border-r border-mtg-border flex flex-col shrink-0">

        <!-- Brand -->
        <div class="px-5 py-6 border-b border-mtg-border">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-mtg-primary/20 border border-mtg-primary/40 flex items-center justify-center shadow-glow-primary">
              <svg class="w-5 h-5 text-mtg-secondary" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
              </svg>
            </div>
            <div>
              <p class="font-display text-base text-mtg-gold leading-none">MtG Packer</p>
              <p class="font-body text-xs text-mtg-muted mt-0.5">Koffer-Optimierer</p>
            </div>
          </div>
        </div>

        <!-- Nav -->
        <nav class="flex-1 p-3 space-y-1" aria-label="Hauptnavigation">
          <a routerLink="/vote" routerLinkActive="bg-mtg-primary/15 text-mtg-text border-mtg-primary/40"
             ariaCurrentWhenActive="page"
             class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-mtg-muted border border-transparent hover:bg-mtg-card-hover hover:text-mtg-text hover:border-mtg-border transition-all duration-200 cursor-pointer font-body text-sm">
            <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/>
            </svg>
            <span>Abstimmung</span>
          </a>

          <a routerLink="/admin" routerLinkActive="bg-mtg-primary/15 text-mtg-text border-mtg-primary/40"
             ariaCurrentWhenActive="page"
             class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-mtg-muted border border-transparent hover:bg-mtg-card-hover hover:text-mtg-text hover:border-mtg-border transition-all duration-200 cursor-pointer font-body text-sm">
            <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
            </svg>
            <span>Admin</span>
          </a>
        </nav>

        <!-- Footer -->
        <div class="px-4 py-4 border-t border-mtg-border">
          <p class="font-body text-xs text-mtg-muted mb-1.5">Powered by</p>
          <div class="flex gap-3">
            <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer"
               class="font-body text-xs text-mtg-secondary hover:text-mtg-text transition-colors duration-150">Scryfall</a>
            <span class="text-mtg-border">\u00B7</span>
            <a href="https://moxfield.com" target="_blank" rel="noopener noreferrer"
               class="font-body text-xs text-mtg-secondary hover:text-mtg-text transition-colors duration-150">Moxfield</a>
          </div>
        </div>
      </aside>

      <!-- Main -->
      <main class="flex-1 overflow-auto min-w-0">
        <router-outlet />
      </main>

    </div>
  `,
})
export class App {}
