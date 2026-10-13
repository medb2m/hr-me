import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  LucideDoorOpen,
  LucideLoaderCircle,
  LucideLogIn,
  LucidePin,
  LucideUser,
  LucideVideo,
  LucideXCircle,
} from '@lucide/angular';
import { MeetingsApiService } from '../../../../core/services/meetings-api.service';
import { SocketService } from '../../../../core/services/socket.service';
import { AuthService } from '../../../../core/services/auth.service';

type GuestStep = 'form' | 'waiting' | 'denied';

export interface GuestSession {
  guestId: string;
  name: string;
  token?: string;
  roomId: string;
  meeting: { id: string; title: string; type: string; scheduledAt: string; durationMin: number; timezone: string };
}

/** Session invité persistée pour la salle (survit à la navigation). */
export function guestSessionKey(meetingId: string): string {
  return `aw_guest_${meetingId}`;
}

export function readGuestSession(meetingId: string): GuestSession | null {
  try {
    const raw = sessionStorage.getItem(guestSessionKey(meetingId));
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-meeting-guest',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideDoorOpen,
    LucideLoaderCircle,
    LucideLogIn,
    LucidePin,
    LucideUser,
    LucideVideo,
    LucideXCircle,
  ],
  templateUrl: './meeting-guest.component.html',
  styleUrl: './meeting-guest.component.scss',
})
export class MeetingGuestComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly meetingsApi = inject(MeetingsApiService);
  private readonly socketSvc = inject(SocketService);
  private readonly auth = inject(AuthService);

  readonly meetingId = this.route.snapshot.paramMap.get('id') || '';
  readonly step = signal<GuestStep>('form');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly meetingTitle = signal('');
  readonly waitingName = signal('');

  name = '';
  pin = '';

  readonly isLoggedIn = this.auth.isLoggedIn();

  ngOnDestroy(): void {
    const s = this.socketSvc.getSocket();
    s?.off('meeting:guest-approved');
    s?.off('meeting:guest-denied');
  }

  submit(): void {
    const name = this.name.trim();
    if (name.length < 2) {
      this.error.set('Indiquez votre nom pour rejoindre la réunion.');
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    this.meetingsApi
      .guestAccess(this.meetingId, { name, pin: this.pin.trim() || undefined })
      .subscribe({
        next: (r) => {
          this.busy.set(false);
          this.meetingTitle.set(r.meeting?.title || 'Réunion');
          const session: GuestSession = {
            guestId: r.guestId,
            name: r.name,
            roomId: r.roomId,
            meeting: r.meeting,
          };
          if (r.mode === 'join' && r.token) {
            // PIN valide → entrée directe dans la salle
            session.token = r.token;
            sessionStorage.setItem(guestSessionKey(this.meetingId), JSON.stringify(session));
            void this.router.navigate(['/meetings', this.meetingId, 'room']);
            return;
          }
          // Pas de PIN → salle d'attente + approbation de l'animateur
          sessionStorage.setItem(guestSessionKey(this.meetingId), JSON.stringify(session));
          this.waitingName.set(r.name);
          this.step.set('waiting');
          this.waitInLobby(r.waitToken!, r.roomId, r.guestId);
        },
        error: (err: { status?: number; error?: { message?: string } }) => {
          this.busy.set(false);
          this.error.set(err.error?.message || 'Impossible de rejoindre la réunion.');
        },
      });
  }

  /** Connexion socket en mode attente jusqu'à la décision de l'animateur. */
  private waitInLobby(waitToken: string, roomId: string, guestId: string): void {
    const s = this.socketSvc.connect(waitToken);
    const requestJoin = () => {
      s.emit('meeting:request-join', { roomId });
    };
    if (s.connected) {
      requestJoin();
    } else {
      s.once('connect', requestJoin);
    }
    s.on('meeting:guest-approved', (msg: { token?: string }) => {
      if (!msg?.token) {
        return;
      }
      const session = readGuestSession(this.meetingId);
      if (session) {
        session.token = msg.token;
        sessionStorage.setItem(guestSessionKey(this.meetingId), JSON.stringify(session));
      }
      void this.router.navigate(['/meetings', this.meetingId, 'room']);
    });
    s.on('meeting:guest-denied', () => {
      this.step.set('denied');
    });
    void guestId;
  }

  cancelWaiting(): void {
    const s = this.socketSvc.getSocket();
    const session = readGuestSession(this.meetingId);
    if (s && session) {
      s.emit('meeting:withdraw', { roomId: session.roomId });
    }
    s?.off('meeting:guest-approved');
    s?.off('meeting:guest-denied');
    this.socketSvc.disconnect();
    sessionStorage.removeItem(guestSessionKey(this.meetingId));
    this.step.set('form');
  }
}
