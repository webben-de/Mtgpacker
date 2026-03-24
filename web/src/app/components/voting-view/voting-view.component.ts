import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, Input } from '@angular/core';
import type { App } from '../../app';

@Component({
  selector: 'app-voting-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voting-view.component.html',
})
export class VotingViewComponent {
  @Input({ required: true }) vm!: App;
}
