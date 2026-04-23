import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MeetingsApiService } from '../../../../core/services/meetings-api.service';
import type { MeetingDto } from '../../../../core/models/hr-me-realtime.models';

@Component({
  selector: 'app-meeting-lobby',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './meeting-lobby.component.html',
  styleUrl: './meeting-lobby.component.scss',
})
export class MeetingLobbyComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly meetingsApi = inject(MeetingsApiService);

  readonly meeting = signal<MeetingDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Identifiant manquant.');
      this.loading.set(false);
      return;
    }
    this.meetingsApi.get(id).subscribe({
      next: (r) => {
        this.meeting.set(r.meeting);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Entretien introuvable ou accès refusé.');
        this.loading.set(false);
      },
    });
  }
}
