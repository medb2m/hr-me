import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  LucideMic,
  LucideMicOff,
  LucideVideo,
  LucideVideoOff,
  LucideLogOut,
  LucideMaximize2,
  LucideMessageSquare,
  LucideUsers,
  LucideMonitor,
} from '@lucide/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { MeetingsApiService } from '../../../../core/services/meetings-api.service';
import { SocketService } from '../../../../core/services/socket.service';
import type { MeetingDto, MeetingParticipantDto } from '../../../../core/models/hr-me-realtime.models';

type RightTab = 'chat' | 'room';

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideMic,
    LucideMicOff,
    LucideVideo,
    LucideVideoOff,
    LucideLogOut,
    LucideMaximize2,
    LucideMessageSquare,
    LucideUsers,
    LucideMonitor,
  ],
  templateUrl: './meeting-room.component.html',
  styleUrl: './meeting-room.component.scss',
})
export class MeetingRoomComponent implements OnDestroy, AfterViewInit {
  @ViewChild('localV') localV!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteV') remoteV!: ElementRef<HTMLVideoElement>;
  @ViewChild('roomShell') roomShell?: ElementRef<HTMLElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly meetingsApi = inject(MeetingsApiService);
  private readonly socketSvc = inject(SocketService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly status = signal<string>('Initialisation…');
  readonly error = signal<string | null>(null);
  readonly chatMessages = signal<{ senderId?: string; content: string; sentAt: string }[]>([]);
  readonly micOn = signal(true);
  readonly camOn = signal(true);
  readonly meetingTitle = signal('');
  readonly rightTab = signal<RightTab>('chat');
  readonly participants = signal<MeetingParticipantDto[]>([]);
  readonly hostId = signal('');
  readonly screenSharing = signal(false);
  readonly addParticipantBusy = signal(false);
  readonly addParticipantErr = signal<string | null>(null);

  readonly isHost = computed(() => {
    const uid = this.auth.user()?.id || '';
    return Boolean(uid && uid === this.hostId());
  });

  chatDraft = '';
  addInviteEmail = '';
  addInviteName = '';
  addInviteRole: 'recruiter' | 'candidate' = 'recruiter';
  addInviteUserId = '';

  private meetingId = '';
  private roomId = '';
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private sentOffer = false;
  private videoSender: RTCRtpSender | null = null;
  private cameraVideoTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Réunion introuvable.');
      return;
    }
    this.meetingId = id;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : '';
    if (!token) {
      this.error.set('Connexion requise.');
      return;
    }
    this.socketSvc.connect(token);
    forkJoin({
      meet: this.meetingsApi.get(id),
      join: this.meetingsApi.getJoinToken(id),
    }).subscribe({
      next: async ({ meet, join }) => {
        this.applyMeetingDto(meet.meeting);
        this.roomId = join.roomId;
        await this.startMedia();
        this.joinSocketRoom();
        this.cdr.markForCheck();
      },
      error: () => this.error.set('Impossible de rejoindre la réunion.'),
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.syncLocalVideo());
  }

  ngOnDestroy(): void {
    this.detachMeetingSocketListeners();
    this.leaveMediaAndPc(false);
  }

  setRightTab(tab: RightTab): void {
    this.rightTab.set(tab);
  }

  isSelfParticipant(p: MeetingParticipantDto): boolean {
    const myId = this.auth.user()?.id || '';
    const myEmail = (this.auth.user()?.email || '').trim().toLowerCase();
    if (myId && p.userId && p.userId === myId) {
      return true;
    }
    if (myEmail && (p.email || '').trim().toLowerCase() === myEmail) {
      return true;
    }
    return false;
  }

  canModerateParticipant(p: MeetingParticipantDto): boolean {
    if (!this.isHost() || this.isSelfParticipant(p)) {
      return false;
    }
    return Boolean(p.userId);
  }

  submitAddParticipant(): void {
    const email = this.addInviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.addParticipantErr.set('E-mail invalide.');
      return;
    }
    this.addParticipantErr.set(null);
    this.addParticipantBusy.set(true);
    const body: { email: string; name?: string; role?: string; userId?: string } = {
      email,
      name: this.addInviteName.trim() || undefined,
      role: this.addInviteRole,
    };
    const uid = this.addInviteUserId.trim();
    if (/^[a-f\d]{24}$/i.test(uid)) {
      body.userId = uid;
    }
    this.meetingsApi.addParticipant(this.meetingId, body).subscribe({
      next: (r) => {
        this.applyMeetingDto(r.meeting);
        this.addInviteEmail = '';
        this.addInviteName = '';
        this.addInviteUserId = '';
        this.addInviteRole = 'recruiter';
        this.addParticipantBusy.set(false);
        this.cdr.markForCheck();
      },
      error: (err: { error?: { message?: string } }) => {
        this.addParticipantErr.set(err.error?.message || 'Ajout impossible.');
        this.addParticipantBusy.set(false);
      },
    });
  }

  moderateParticipant(p: MeetingParticipantDto, action: 'mute_audio' | 'mute_video'): void {
    if (!p.userId) {
      return;
    }
    this.sendModeration(p.userId, action);
  }

  sendModeration(targetUserId: string, action: 'mute_audio' | 'mute_video'): void {
    const s = this.socketSvc.getSocket();
    s?.emit(
      'meeting:moderation',
      { roomId: this.roomId, action, targetUserId },
      (ack: { ok?: boolean; message?: string }) => {
        if (!ack?.ok) {
          this.status.set(ack?.message || 'Action refusée.');
        }
      }
    );
  }

  async toggleScreenShare(): Promise<void> {
    if (this.screenSharing()) {
      await this.stopScreenShare();
      return;
    }
    if (!this.pc || !this.videoSender) {
      this.status.set('Connexion pair requise avant le partage écran.');
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });
      this.screenStream = display;
      const vt = display.getVideoTracks()[0];
      vt.onended = () => {
        void this.stopScreenShare();
      };
      await this.videoSender.replaceTrack(vt);
      this.screenSharing.set(true);
      this.camOn.set(vt.enabled);
      this.syncLocalVideo();
    } catch {
      this.status.set('Partage d’écran annulé ou refusé.');
    }
  }

  toggleMic(): void {
    const on = !this.micOn();
    this.micOn.set(on);
    const t = this.localStream?.getAudioTracks()[0];
    if (t) {
      t.enabled = on;
    }
  }

  toggleCam(): void {
    const vt = this.videoSender?.track;
    if (vt && vt.kind === 'video') {
      vt.enabled = !vt.enabled;
      this.camOn.set(vt.enabled);
      if (!this.screenSharing()) {
        const cam = this.cameraVideoTrack;
        if (cam) {
          cam.enabled = vt.enabled;
        }
      }
    }
  }

  async toggleFullscreen(): Promise<void> {
    const el = this.roomShell?.nativeElement;
    if (!el) {
      return;
    }
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* */
    }
  }

  leaveRoom(): void {
    this.detachMeetingSocketListeners();
    this.leaveMediaAndPc(false);
    void this.router.navigate(['/meetings', this.meetingId, 'lobby']);
  }

  sendChat(): void {
    const text = this.chatDraft.trim();
    if (!text) {
      return;
    }
    this.socketSvc.getSocket()?.emit('chat:message', { roomId: this.roomId, content: text });
    this.chatDraft = '';
  }

  onChatKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') {
      this.sendChat();
    }
  }

  private applyMeetingDto(m: MeetingDto): void {
    this.meetingTitle.set(m.title);
    this.hostId.set(m.createdByAgentId);
    this.participants.set(m.participants || []);
  }

  private async startMedia(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      this.cameraVideoTrack = this.localStream.getVideoTracks()[0] || null;
      this.syncLocalVideo();
      this.status.set('Connecté — en attente du pair…');
    } catch {
      this.error.set('Caméra ou micro refusé par le navigateur.');
    }
  }

  private syncLocalVideo(): void {
    const el = this.localV?.nativeElement;
    if (!el) {
      return;
    }
    el.muted = true;
    if (this.screenSharing() && this.screenStream) {
      el.srcObject = this.screenStream;
      return;
    }
    if (this.localStream) {
      el.srcObject = this.localStream;
    }
  }

  private joinSocketRoom(): void {
    const s = this.socketSvc.getSocket();
    if (!s) {
      this.error.set('Socket indisponible.');
      return;
    }
    s.emit('meeting:join-room', { roomId: this.roomId }, (ack: { ok?: boolean; message?: string }) => {
      if (!ack?.ok) {
        this.error.set(ack?.message || 'Accès à la salle refusé.');
        return;
      }
      this.wireSocket(s);
    });
  }

  private wireSocket(s: import('socket.io-client').Socket): void {
    this.detachMeetingSocketListeners();

    s.on('meeting:peer-present', async ({ userId: otherId }: { userId?: string }) => {
      const myId = this.auth.user()?.id || '';
      if (!otherId || otherId === myId) {
        return;
      }
      await this.ensurePc();
      const iAmOfferer = myId.localeCompare(otherId) < 0;
      if (iAmOfferer && !this.sentOffer) {
        this.sentOffer = true;
        await this.createOffer();
      }
    });

    s.on(
      'meeting:signal',
      async (msg: { from?: string; type?: string; sdp?: string; candidate?: RTCIceCandidateInit }) => {
        const myId = this.auth.user()?.id || '';
        if (!msg.from || msg.from === myId) {
          return;
        }
        await this.ensurePc();
        if (!this.pc) {
          return;
        }
        if (msg.type === 'offer' && msg.sdp) {
          await this.pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          s.emit('meeting:signal', { roomId: this.roomId, type: 'answer', sdp: answer.sdp });
          this.status.set('En appel');
        } else if (msg.type === 'answer' && msg.sdp) {
          await this.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
          this.status.set('En appel');
        } else if (msg.type === 'ice' && msg.candidate) {
          try {
            await this.pc.addIceCandidate(msg.candidate);
          } catch {
            /* */
          }
        }
      }
    );

    s.on('chat:message', (msg: { senderId?: string; content: string; sentAt: string }) => {
      this.chatMessages.update((list) => [...list, msg].slice(-200));
    });

    s.on('meeting:participants_updated', (payload: { participants?: MeetingParticipantDto[] }) => {
      if (Array.isArray(payload?.participants)) {
        this.participants.set(payload.participants);
        this.cdr.markForCheck();
      }
    });

    s.on('meeting:moderation', async (msg: { action?: string; targetUserId?: string }) => {
      const myId = this.auth.user()?.id || '';
      if (!msg.targetUserId || msg.targetUserId !== myId) {
        return;
      }
      if (msg.action === 'mute_audio') {
        this.micOn.set(false);
        const a = this.localStream?.getAudioTracks()[0];
        if (a) {
          a.enabled = false;
        }
        this.status.set('Micro coupé par l’animateur');
      } else if (msg.action === 'mute_video') {
        await this.stopScreenShare();
        this.camOn.set(false);
        const cam = this.cameraVideoTrack;
        if (cam) {
          cam.enabled = false;
        }
        const vt = this.videoSender?.track;
        if (vt?.kind === 'video') {
          vt.enabled = false;
        }
        this.status.set('Caméra coupée par l’animateur');
      }
    });
  }

  private detachMeetingSocketListeners(): void {
    const s = this.socketSvc.getSocket();
    if (!s) {
      return;
    }
    s.off('meeting:peer-present');
    s.off('meeting:signal');
    s.off('chat:message');
    s.off('meeting:participants_updated');
    s.off('meeting:moderation');
  }

  private async ensurePc(): Promise<void> {
    if (this.pc) {
      return;
    }
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    const s = this.socketSvc.getSocket();
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate && s) {
        s.emit('meeting:signal', {
          roomId: this.roomId,
          type: 'ice',
          candidate: ev.candidate.toJSON(),
        });
      }
    };
    this.pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (stream && this.remoteV?.nativeElement) {
        this.remoteV.nativeElement.srcObject = stream;
      }
    };
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }
    }
    this.videoSender = this.pc.getSenders().find((x) => x.track?.kind === 'video') ?? null;
    if (!this.cameraVideoTrack) {
      this.cameraVideoTrack = this.localStream?.getVideoTracks()[0] ?? null;
    }
  }

  private async createOffer(): Promise<void> {
    const s = this.socketSvc.getSocket();
    if (!this.pc || !s) {
      return;
    }
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    s.emit('meeting:signal', { roomId: this.roomId, type: 'offer', sdp: offer.sdp });
  }

  private async stopScreenShare(): Promise<void> {
    if (!this.screenSharing()) {
      return;
    }
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    if (this.videoSender && this.cameraVideoTrack) {
      try {
        await this.videoSender.replaceTrack(this.cameraVideoTrack);
      } catch {
        /* */
      }
    }
    this.screenSharing.set(false);
    this.camOn.set(this.cameraVideoTrack?.enabled ?? true);
    queueMicrotask(() => this.syncLocalVideo());
  }

  private leaveMediaAndPc(navigate: boolean): void {
    if (this.screenSharing()) {
      this.screenStream?.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
      if (this.pc && this.videoSender && this.cameraVideoTrack) {
        void this.videoSender.replaceTrack(this.cameraVideoTrack);
      }
      this.screenSharing.set(false);
    }
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.cameraVideoTrack = null;
    this.videoSender = null;
    if (this.localV?.nativeElement) {
      this.localV.nativeElement.srcObject = null;
    }
    if (this.remoteV?.nativeElement) {
      this.remoteV.nativeElement.srcObject = null;
    }
    this.pc?.close();
    this.pc = null;
    if (navigate) {
      void this.router.navigate(['/meetings', this.meetingId, 'lobby']);
    }
  }
}
