import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'ordersByUser', standalone: true, pure: true })
export class OrdersByUserPipe implements PipeTransform {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(orders: any[], userName: string): any[] {
    if (!userName) return orders;
    return orders.filter(o => o.user_name === userName || o.github_login === userName);
  }
}
