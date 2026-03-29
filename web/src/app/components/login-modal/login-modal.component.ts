import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login-modal.component.html',
})
export class LoginModalComponent {
  @Input() githubEnabled = true;
  @Input() googleEnabled = false;
  @Input() discordEnabled = false;
  @Output() loginWith = new EventEmitter<'github' | 'google' | 'discord'>();
  @Output() close = new EventEmitter<void>();
}
