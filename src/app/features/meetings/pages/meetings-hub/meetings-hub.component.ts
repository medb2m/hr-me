import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MeetingsApiService } from '../../../../core/services/meetings-api.service';
import type { MeetingDto } from '../../../../core/models/hr-me-realtime.models';

@Component({
  selector: 'app-meetings-hub',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './meetings-hub.component.html',
  styleUrl: './meetings-hub.component.scss',
})
export class MeetingsHubComponent {
  private readonly meetingsApi = inject(MeetingsApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<MeetingDto[]>([]);

  constructor() {
    const from = new Date();
    const to = new Date(from.getTime() + 45 * 86400000);
    this.meetingsApi.list(from, to).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les entretiens.');
        this.loading.set(false);
      },
    });
  }
}
