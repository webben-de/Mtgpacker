import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, Input } from '@angular/core';
import type { App } from '../../app';

@Component({
  selector: 'app-admin-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-view.component.html',
})
export class AdminViewComponent {
  @Input({ required: true }) vm!: App;
}
