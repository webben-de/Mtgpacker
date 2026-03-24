import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { App } from '../../app';

@Component({
  selector: 'app-global-feedback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-feedback.component.html',
})
export class GlobalFeedbackComponent {
  @Input({ required: true }) vm!: App;
}
