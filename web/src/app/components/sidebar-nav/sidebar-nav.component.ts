import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { App } from '../../app';

@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar-nav.component.html',
})
export class SidebarNavComponent {
  @Input({ required: true }) vm!: App;
}
