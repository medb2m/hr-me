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
  LucidePlus,
  LucideSearch,
  LucideUsers,
  LucideMonitor,
} from '@lucide/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { MeetingsApiService } from '../../../../core/services/meetings-api.service';
import { CalendarApiService } from '../../../../core/services/calendar-api.service';
import { SocketService } from '../../../../core/services/socket.service';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import type { MeetingDto, MeetingParticipantDto } from '../../../../core/models/hr-me-realtime.models';

type RightTab = 'chat' | 'room';

interface AttendeeItem {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
}

/** Rôles proposés selon le type de réunion (comme la page de création). */
const ROLE_OPTIONS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  general: [
    { value: 'recruiter', label: 'Participant' },
    { value: 'candidate', label: 'Invité' },
    { value: 'observer', label: 'Observateur' },
  ],
  team: [
    { value: 'recruiter', label: 'Membre' },
    { value: 'candidate', label: 'Invité' },
    { value: 'observer', label: 'Observateur' },
  ],
  partner: [
    { value: 'recruiter', label: 'Partenaire' },
    { value: 'candidate', label: 'Invité' },
    { value: 'observer', label: 'Observateur' },
  ],
  client: [
    { value: 'recruiter', label: 'Client' },
    { value: 'candidate', label: 'Invité' },
    { value: 'observer', label: 'Observateur' },
  ],
  screening: [
    { value: 'recruiter', label: 'Recruteur' },
    { value: 'candidate', label: 'Candidat' },
    { value: 'observer', label: 'Évaluateur' },
  ],
  technical: [
    { value: 'recruiter', label: 'Recruteur' },
    { value: 'candidate', label: 'Candidat' },
    { value: 'observer', label: 'Évaluateur' },
  ],
  final: [
    { value: 'recruiter', label: 'Recruteur' },
    { value: 'candidate', label: 'Candidat' },
    { value: 'observer', label: 'Évaluateur' },
  ],
  ai_automated: [
    { value: 'candidate', label: 'Candidat' },
    { value: 'recruiter', label: 'Superviseur' },
    { value: 'observer', label: 'Observateur' },
  ],
};

/** Couleurs de tuiles (hash userId → hex stable, style Meet). */
const TILE_COLORS = [
  '#7c3aed',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#db2777',
  '#65a30d',
  '#0d9488',
  '#4f46e5',
];

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
    LucidePlus,
    LucideSearch,
    LucideUsers,
    LucideMonitor,
    SelectComponent,
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
  private readonly calendarApi = inject(CalendarApiService);
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
  /** Présence en salle (userIds / emails connectés). */
  readonly presentIds = signal<Set<string>>(new Set());
  readonly presentEmails = signal<Set<string>>(new Set());
  /** Pair distant connecté (négociation établie). */
  readonly remoteActive = signal(false);
  readonly remoteCamOn = signal(true);
  readonly remoteMicOn = signal(true);
  readonly remoteSpeaking = signal(false);
  readonly selfSpeaking = signal(false);
  readonly remoteSharing = signal(false);
  readonly meetingType = signal('general');
  /** Panneau « Ajouter » (style page de création). */
  readonly inviteQuery = signal('');
  readonly inviteResults = signal<AttendeeItem[]>([]);
  readonly recentPeople = signal<AttendeeItem[]>([]);
  readonly inviteBusy = signal(false);

  /** Id du pair actuellement en appel (signal : pilote la tuile distante). */
  readonly remoteUserId = signal('');
  private inviteTimer: ReturnType<typeof setTimeout> | null = null;
  private remoteStream: MediaStream | null = null;

  /** Mode présentation : partage d'écran actif (local ou distant). */
  readonly presenting = computed(() => this.screenSharing() || this.remoteSharing());
  readonly presenterName = computed(() =>
    this.screenSharing() ? 'Vous' : this.remoteName()
  );

  readonly inviteRoleOptions = computed(
    () => ROLE_OPTIONS_BY_TYPE[this.meetingType()] ?? ROLE_OPTIONS_BY_TYPE['general']
  );

  readonly isHost = computed(() => {
    const uid = this.auth.user()?.id || '';
    return Boolean(uid && uid === this.hostId());
  });

  chatDraft = '';
  addInviteEmail = '';
  addInviteName = '';
  addInviteRole = 'recruiter';
  addInviteUserId = '';

  /** Couleur de tuile stable par utilisateur (comme les avatars Meet). */
  tileColor(key: string): string {
    let h = 0;
    const s = key || 'x';
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return TILE_COLORS[h % TILE_COLORS.length];
  }

  onInviteQuery(q: string): void {
    this.inviteQuery.set(q);
    if (this.inviteTimer) {
      clearTimeout(this.inviteTimer);
    }
    this.inviteTimer = setTimeout(() => {
      const query = this.inviteQuery().trim();
      this.inviteBusy.set(true);
      this.calendarApi.attendees(query).subscribe({
        next: (r) => {
          this.inviteResults.set(this.filterInvitees(r.attendees || []));
          this.inviteBusy.set(false);
          this.cdr.markForCheck();
        },
        error: () => this.inviteBusy.set(false),
      });
    }, 250);
  }

  private filterInvitees(list: AttendeeItem[]): AttendeeItem[] {
    const existing = new Set(
      this.participants().map((p) => (p.email || '').trim().toLowerCase())
    );
    const myEmail = (this.auth.user()?.email || '').trim().toLowerCase();
    return list.filter(
      (a) => a.email && !existing.has(a.email.trim().toLowerCase()) && a.email.trim().toLowerCase() !== myEmail
    );
  }

  inviteAttendee(a: AttendeeItem): void {
    this.addParticipantBusy.set(true);
    this.meetingsApi
      .addParticipant(this.meetingId, {
        email: a.email,
        name: a.name,
        role: this.addInviteRole,
        userId: a.id,
      })
      .subscribe({
        next: (r) => {
          this.applyMeetingDto(r.meeting);
          this.inviteResults.update((list) => list.filter((x) => x.id !== a.id));
          this.recentPeople.update((list) => list.filter((x) => x.id !== a.id));
          this.addParticipantBusy.set(false);
          this.cdr.markForCheck();
        },
        error: (err: { error?: { message?: string } }) => {
          this.addParticipantErr.set(err.error?.message || 'Ajout impossible.');
          this.addParticipantBusy.set(false);
        },
      });
  }

  private loadRecentPeople(): void {
    this.meetingsApi.recentParticipants().subscribe({
      next: (r) => {
        this.recentPeople.set(
          this.filterInvitees(
            (r.items || []).map((x) => ({
              id: x.id || '',
              name: x.name,
              email: x.email,
              role: x.role,
              avatarUrl: x.avatarUrl || '',
            }))
          )
        );
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  private meetingId = '';
  private roomId = '';
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private videoSender: RTCRtpSender | null = null;
  private cameraVideoTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;
  private onSocketReconnect: (() => void) | null = null;
  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteAnalyser: AnalyserNode | null = null;
  private speakTimer: ReturnType<typeof setInterval> | null = null;

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
        this.loadRecentPeople();
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

  /** Participant actuellement connecté en salle (indicateur vert). */
  isPresent(p: MeetingParticipantDto): boolean {
    if (this.isSelfParticipant(p)) {
      return true;
    }
    if (p.userId && this.presentIds().has(String(p.userId))) {
      return true;
    }
    return this.presentEmails().has((p.email || '').trim().toLowerCase());
  }

  initials(name: string): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  private findParticipantByUserId(uid: string): MeetingParticipantDto | undefined {
    return this.participants().find((x) => String(x.userId) === uid);
  }

  remoteName = computed(() => {
    const p = this.findParticipantByUserId(this.remoteUserId());
    return p?.name || p?.email || 'Participant';
  });

  remoteAvatar = computed(() => this.findParticipantByUserId(this.remoteUserId())?.avatarUrl || '');

  remoteInitials = computed(() => this.initials(this.remoteName()));

  selfName = computed(() => this.auth.user()?.name || this.auth.user()?.email || 'Vous');

  selfAvatar = computed(() => {
    const me = this.auth.user();
    if (me?.avatarUrl) {
      return me.avatarUrl;
    }
    const self = this.participants().find((x) => this.isSelfParticipant(x));
    return self?.avatarUrl || '';
  });

  selfInitials = computed(() => this.initials(this.selfName()));

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
      this.emitMediaState();
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
    this.emitMediaState();
  }

  toggleCam(): void {
    const on = !this.camOn();
    this.camOn.set(on);
    if (this.cameraVideoTrack) {
      this.cameraVideoTrack.enabled = on;
    }
    // Ne pas couper la piste d'écran pendant un partage
    if (!this.screenSharing()) {
      const vt = this.videoSender?.track;
      if (vt && vt.kind === 'video') {
        vt.enabled = on;
      }
    }
    this.syncLocalVideo();
    this.emitMediaState();
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
    this.meetingType.set(m.type || 'general');
    this.hostId.set(m.createdByAgentId);
    this.participants.set(m.participants || []);
  }

  private async startMedia(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.cameraVideoTrack = this.localStream.getVideoTracks()[0] || null;
      this.camOn.set(Boolean(this.cameraVideoTrack));
      this.micOn.set(Boolean(this.localStream.getAudioTracks()[0]));
      this.syncLocalVideo();
      this.status.set('Connecté — en attente du pair…');
    } catch {
      this.camOn.set(false);
      this.micOn.set(false);
      this.status.set('Caméra/micro indisponible — vous rejoignez en écoute.');
    }
  }

  private emitMediaState(): void {
    this.socketSvc.getSocket()?.emit('meeting:media-state', {
      roomId: this.roomId,
      micOn: this.micOn(),
      camOn: this.camOn(),
      sharing: this.screenSharing(),
      name: this.selfName(),
    });
  }

  private levelOf(analyser: AnalyserNode | null | undefined): number {
    if (!analyser) {
      return 0;
    }
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buf);
    let sum = 0;
    for (const v of buf) {
      sum += v;
    }
    return sum / buf.length / 255;
  }

  private startSpeakingDetection(): void {
    try {
      this.audioCtx = this.audioCtx ?? new AudioContext();
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
      if (this.localStream && !this.localAnalyser) {
        const src = this.audioCtx.createMediaStreamSource(this.localStream);
        this.localAnalyser = this.audioCtx.createAnalyser();
        this.localAnalyser.fftSize = 512;
        src.connect(this.localAnalyser);
      }
      if (!this.speakTimer) {
        this.speakTimer = setInterval(() => {
          this.selfSpeaking.set(this.levelOf(this.localAnalyser) > 0.045);
          this.remoteSpeaking.set(this.levelOf(this.remoteAnalyser) > 0.045);
        }, 200);
      }
    } catch {
      /* WebAudio indisponible */
    }
  }

  private attachRemoteAnalyser(stream: MediaStream): void {
    try {
      if (!this.audioCtx || this.remoteAnalyser) {
        return;
      }
      const src = this.audioCtx.createMediaStreamSource(stream);
      this.remoteAnalyser = this.audioCtx.createAnalyser();
      this.remoteAnalyser.fftSize = 512;
      src.connect(this.remoteAnalyser);
    } catch {
      /* */
    }
  }

  private stopSpeakingDetection(): void {
    if (this.speakTimer) {
      clearInterval(this.speakTimer);
      this.speakTimer = null;
    }
    this.localAnalyser = null;
    this.remoteAnalyser = null;
    void this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
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
    // Attacher les listeners AVANT le join pour ne manquer aucune signalisation.
    this.wireSocket(s);
    s.emit(
      'meeting:join-room',
      { roomId: this.roomId },
      (ack: {
        ok?: boolean;
        message?: string;
        members?: { userId?: string; email?: string }[];
      }) => {
        if (!ack?.ok) {
          this.error.set(ack?.message || 'Accès à la salle refusé.');
          return;
        }
        // Présence initiale depuis l'ack
        const ids = new Set<string>();
        const emails = new Set<string>();
        for (const m of ack.members || []) {
          if (m.userId) {
            ids.add(String(m.userId));
          }
          if (m.email) {
            emails.add(m.email.trim().toLowerCase());
          }
        }
        this.presentIds.set(ids);
        this.presentEmails.set(emails);
        // Un autre membre déjà en salle = le pair à afficher
        const myId = this.auth.user()?.id || '';
        const other = [...ids].find((id) => id !== myId);
        if (other) {
          this.remoteUserId.set(other);
        }
        this.emitMediaState();
        this.startSpeakingDetection();
        this.status.set('Connecté — en attente des participants…');
      }
    );
  }

  private wireSocket(s: import('socket.io-client').Socket): void {
    this.detachMeetingSocketListeners();

    // Reconnexion socket : rejoindre la salle à nouveau
    this.onSocketReconnect = () => {
      if (this.roomId) {
        s.emit('meeting:join-room', { roomId: this.roomId });
      }
    };
    s.on('connect', this.onSocketReconnect);

    // Le membre DÉJÀ présent reçoit l'événement du nouvel arrivant → c'est lui qui offre
    // (le nouvel arrivant ne sait pas qui est en salle : il ne peut pas offrir).
    s.on(
      'meeting:peer-present',
      async ({ userId: otherId, email }: { userId?: string; email?: string }) => {
      const myId = this.auth.user()?.id || '';
      if (!otherId || otherId === myId) {
        return;
      }
      this.remoteUserId.set(otherId);
      this.presentIds.update((set) => new Set(set).add(otherId));
      const part = this.findParticipantByUserId(otherId);
      const em = (email || part?.email || '').trim().toLowerCase();
      if (em) {
        this.presentEmails.update((set) => new Set(set).add(em));
      }
      // Informer le nouvel arrivant de notre état cam/mic
      this.emitMediaState();
      await this.ensurePc();
      if (this.pc && !this.pc.remoteDescription) {
        await this.createOffer();
      }
      this.cdr.markForCheck();
    });

    s.on(
      'meeting:signal',
      async (msg: { from?: string; type?: string; sdp?: string; candidate?: RTCIceCandidateInit }) => {
        const myId = this.auth.user()?.id || '';
        if (!msg.from || msg.from === myId) {
          return;
        }
        this.remoteUserId.set(msg.from);
        await this.ensurePc();
        if (!this.pc) {
          return;
        }
        if (msg.type === 'offer' && msg.sdp) {
          // Glare (double offre si join simultané) : le plus petit id cède (« polite peer »)
          if (this.pc.signalingState !== 'stable') {
            if (myId.localeCompare(msg.from) > 0) {
              return; // impoli : notre offre gagne
            }
            await this.pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
          }
          await this.pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          s.emit('meeting:signal', { roomId: this.roomId, type: 'answer', sdp: answer.sdp });
          this.remoteActive.set(true);
          this.status.set('En appel');
          this.cdr.markForCheck();
        } else if (msg.type === 'answer' && msg.sdp) {
          if (this.pc.signalingState === 'have-local-offer') {
            await this.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
          }
          this.remoteActive.set(true);
          this.status.set('En appel');
          this.cdr.markForCheck();
        } else if (msg.type === 'ice' && msg.candidate) {
          try {
            await this.pc.addIceCandidate(msg.candidate);
          } catch {
            /* */
          }
        }
      }
    );

    // L'autre participant a quitté : fermer le pc pour que son retour re-négocie proprement
    s.on('meeting:peer-left', ({ userId: otherId, email }: { userId?: string; email?: string }) => {
      const myId = this.auth.user()?.id || '';
      if (!otherId || otherId === myId) {
        return;
      }
      this.presentIds.update((set) => {
        const next = new Set(set);
        next.delete(otherId);
        return next;
      });
      // Nettoyer aussi l'email (jeton meeting_join : pas toujours socket.data.email)
      const part = this.findParticipantByUserId(otherId);
      const em = (email || part?.email || '').trim().toLowerCase();
      if (em) {
        this.presentEmails.update((set) => {
          const next = new Set(set);
          next.delete(em);
          return next;
        });
      }
      this.remoteActive.set(false);
      this.remoteSpeaking.set(false);
      this.remoteSharing.set(false);
      this.remoteAnalyser = null;
      this.remoteUserId.set('');
      this.closePc();
      this.status.set('Participant parti — en attente…');
      this.cdr.markForCheck();
    });

    // État micro/caméra du pair (avatar + indicateurs)
    s.on(
      'meeting:media-state',
      (msg: { userId?: string; email?: string; micOn?: boolean; camOn?: boolean; sharing?: boolean }) => {
        const myId = this.auth.user()?.id || '';
        if (!msg.userId || msg.userId === myId) {
          return;
        }
        this.remoteUserId.set(msg.userId);
        this.remoteCamOn.set(msg.camOn !== false);
        this.remoteMicOn.set(msg.micOn !== false);
        this.remoteSharing.set(msg.sharing === true);
        this.cdr.markForCheck();
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
    s.off('meeting:peer-left');
    s.off('meeting:media-state');
    s.off('meeting:signal');
    if (this.onSocketReconnect) {
      s.off('connect', this.onSocketReconnect);
      this.onSocketReconnect = null;
    }
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
      if (!stream) {
        return;
      }
      this.remoteStream = stream;
      // La tuile distante est dans un @if : forcer le rendu pour monter l'élément <video>
      this.cdr.detectChanges();
      this.attachRemoteVideo();
      this.cdr.markForCheck();
    };
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }
    }
    this.videoSender = this.pc.getSenders().find((x) => x.track?.kind === 'video') ?? null;
    // Qualité HD : ~2,5 Mbps, pas de réduction de résolution
    if (this.videoSender) {
      const params = this.videoSender.getParameters();
      params.encodings = [{ maxBitrate: 2_500_000, scaleResolutionDownBy: 1 }];
      void this.videoSender.setParameters(params).catch(() => {});
    }
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
    this.emitMediaState();
  }

  /** Attache le flux distant à sa tuile (peut arriver avant que la tuile existe). */
  private attachRemoteVideo(): void {
    const el = this.remoteV?.nativeElement;
    if (!el || !this.remoteStream) {
      return;
    }
    if (el.srcObject !== this.remoteStream) {
      el.srcObject = this.remoteStream;
    }
    this.attachRemoteAnalyser(this.remoteStream);
    this.remoteActive.set(true);
  }

  /** Ferme la connexion pair et nettoie la vidéo distante (le flux local reste actif). */
  private closePc(): void {
    this.pc?.close();
    this.pc = null;
    this.videoSender = null;
    this.remoteStream = null;
    if (this.remoteV?.nativeElement) {
      this.remoteV.nativeElement.srcObject = null;
    }
  }

  private leaveMediaAndPc(navigate: boolean): void {
    this.stopSpeakingDetection();
    this.remoteActive.set(false);
    this.remoteSpeaking.set(false);
    // Prévenir les autres que l'on quitte la salle
    if (this.roomId) {
      this.socketSvc.getSocket()?.emit('meeting:leave-room', { roomId: this.roomId });
    }
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
    this.closePc();
    if (navigate) {
      void this.router.navigate(['/meetings', this.meetingId, 'lobby']);
    }
  }
}
