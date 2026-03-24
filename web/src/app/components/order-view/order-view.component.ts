import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, Input } from '@angular/core';
import type { App } from '../../app';
import { OrdersByUserPipe } from '../../orders-by-user.pipe';

@Component({
  selector: 'app-order-view',
  standalone: true,
  imports: [CommonModule, FormsModule, OrdersByUserPipe],
  templateUrl: './order-view.component.html',
})
export class OrderViewComponent {
  @Input({ required: true }) vm!: App;
}
