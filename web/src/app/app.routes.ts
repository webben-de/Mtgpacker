import { Route } from '@angular/router';
import { VotingComponent } from './features/voting/voting.component';
import { AdminComponent } from './features/admin/admin.component';

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'vote', pathMatch: 'full' },
  { path: 'vote', component: VotingComponent },
  { path: 'admin', component: AdminComponent },
];
