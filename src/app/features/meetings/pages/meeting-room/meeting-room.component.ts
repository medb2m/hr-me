import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
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
  LucideMonitorOff,
  LucideSend,
  LucidePaperclip,
  LucideX,
  LucideZoomIn,
  LucideZoomOut,
  LucideDownload,
} from '@lucide/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { MeetingsApiService } from '../../../../core/services/meetings-api.service';
import { CalendarApiService } from '../../../../core/services/calendar-api.service';
import { SocketService } from '../../../../core/services/socket.service';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import type { MeetingDto, MeetingParticipantDto } from '../../../../core/models/hr-me-realtime.models';

type RightTab = 'chat' | 'room';

/** Message de chat enrichi par le serveur (profil + image éventuelle). */
interface ChatMsg {
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  imageUrl?: string;
  sentAt: string;
}

interface AttendeeItem {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
}

/** État WebRTC d'un pair distant (mesh : une connexion par participant). */
interface PeerState {
  userId: string;
  pc: RTCPeerConnection;
  videoSender: RTCRtpSender | null;
  /** Sender de la piste écran (partage simultané cam+écran). */
  screenSender: RTCRtpSender | null;
  stream: MediaStream | null;
  /** Flux d'écran reçu de ce pair (2ᵉ flux vidéo). */
  screenRemote: MediaStream | null;
  analyser: AnalyserNode | null;
  offeredOnce: boolean;
}

/** État affiché d'une tuile distante. */
interface RemoteTileState {
  userId: string;
  active: boolean;
  camOn: boolean;
  micOn: boolean;
  micLocked: boolean;
  camLocked: boolean;
  speaking: boolean;
  sharing: boolean;
  name: string;
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
/** Palette d'avatars aux couleurs Al Wassit : bordeaux, or, tons sourds. */
const TILE_COLORS = [
  '#7b1c2e',
  '#a63d52',
  '#b8860b',
  '#8a5a2b',
  '#0f766e',
  '#33415c',
  '#6d3b8e',
  '#4d7c0f',
  '#93512f',
  '#3e6b8f',
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
    LucideMonitorOff,
    LucideSend,
    LucidePaperclip,
    LucideX,
    LucideZoomIn,
    LucideZoomOut,
    LucideDownload,
    SelectComponent,
  ],
  templateUrl: './meeting-room.component.html',
  styleUrl: './meeting-room.component.scss',
})
export class MeetingRoomComponent implements OnDestroy, AfterViewInit {
  @ViewChild('localV') localV!: ElementRef<HTMLVideoElement>;
  @ViewChildren('rv') remoteVs!: QueryList<ElementRef<HTMLVideoElement>>;
  @ViewChild('pv') presentV?: ElementRef<HTMLVideoElement>;
  @ViewChild('chatScroll') chatScroll?: ElementRef<HTMLElement>;
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
  readonly chatMessages = signal<ChatMsg[]>([]);
  /** Image en attente d'envoi (collée depuis le presse-papiers ou jointe). */
  readonly chatImage = signal<{ dataUrl: string; name: string } | null>(null);
  /** Visionneuse d'image du chat (lightbox). */
  readonly lightbox = signal<{ src: string; sender: string; sentAt: string } | null>(null);
  readonly lightboxZoom = signal(1);
  readonly micOn = signal(true);
  readonly camOn = signal(true);
  /** Verrou posé par l'animateur : impossible de rallumer soi-même. */
  readonly micLocked = signal(false);
  readonly camLocked = signal(false);
  /** Menu de modération ouvert (uid-mic / uid-cam). */
  readonly modMenu = signal('');
  /** Bannière visible quand l'animateur agit sur nos périphériques. */
  readonly modNotice = signal('');
  private modNoticeTimer: ReturnType<typeof setTimeout> | null = null;
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
  /** Tuiles des pairs distants (mesh : une tuile par participant connecté). */
  readonly remoteTiles = signal<RemoteTileState[]>([]);
  readonly selfSpeaking = signal(false);
  readonly meetingType = signal('general');
  /** Panneau « Ajouter » (style page de création). */
  readonly inviteQuery = signal('');
  readonly inviteResults = signal<AttendeeItem[]>([]);
  readonly recentPeople = signal<AttendeeItem[]>([]);
  readonly inviteBusy = signal(false);

  private inviteTimer: ReturnType<typeof setTimeout> | null = null;
  /** Connexions WebRTC par pair (userId → état). */
  private readonly peers = new Map<string, PeerState>();

  /** Mode présentation : un seul présentateur à la fois (moi prioritaire). */
  readonly presenterUid = computed(() => {
    if (this.screenSharing()) {
      return 'me';
    }
    return this.remoteTiles().find((t) => t.sharing)?.userId || '';
  });
  readonly presenting = computed(() => Boolean(this.presenterUid()));
  readonly presenterName = computed(() => {
    const uid = this.presenterUid();
    if (uid === 'me') {
      return 'Vous';
    }
    return uid ? this.peerName(uid) : '';
  });

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
  private localStream: MediaStream | null = null;
  private cameraVideoTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;
  private onSocketReconnect: (() => void) | null = null;
  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private speakTimer: ReturnType<typeof setInterval> | null = null;

  /** Crée/met à jour une tuile distante. */
  private patchTile(uid: string, patch: Partial<RemoteTileState>): void {
    this.remoteTiles.update((list) => {
      const i = list.findIndex((t) => t.userId === uid);
      if (i === -1) {
        return [
          ...list,
          {
            userId: uid,
            active: false,
            camOn: true,
            micOn: true,
            micLocked: false,
            camLocked: false,
            speaking: false,
            sharing: false,
            name: '',
            ...patch,
          },
        ];
      }
      const next = [...list];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

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
    if (this.modNoticeTimer) {
      clearTimeout(this.modNoticeTimer);
    }
    if (this.inviteTimer) {
      clearTimeout(this.inviteTimer);
    }
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

  /** Nom d'un pair distant : participant déclaré, sinon nom relayé par media-state. */
  peerName(uid: string): string {
    const p = this.findParticipantByUserId(uid);
    if (p) {
      return p.name || p.email || 'Participant';
    }
    return this.remoteTiles().find((t) => t.userId === uid)?.name || 'Participant';
  }

  peerAvatar(uid: string): string {
    return this.findParticipantByUserId(uid)?.avatarUrl || '';
  }

  peerInitials(uid: string): string {
    return this.initials(this.peerName(uid));
  }

  /** Participants actuellement en salle (panneau « Dans la salle »). */
  readonly inRoomList = computed(() => {
    const mine = this.participants().filter((p) => this.isSelfParticipant(p));
    const others = this.participants().filter(
      (p) => !this.isSelfParticipant(p) && this.isPresent(p)
    );
    const seen = new Set(others.map((p) => String(p.userId || p.email)));
    // Pairs en salle non déclarés dans la liste des participants
    const extra = this.remoteTiles()
      .filter((t) => !seen.has(t.userId))
      .map(
        (t): MeetingParticipantDto => ({
          userId: t.userId,
          email: '',
          name: t.name || 'Participant',
          role: 'observer',
          avatarUrl: '',
        })
      );
    return [...mine, ...others, ...extra];
  });

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

  /** Vrai si l'animateur a verrouillé le micro ou la caméra de ce pair. */
  peerLock(uid: string, device: 'mic' | 'cam'): boolean {
    const t = this.remoteTiles().find((x) => x.userId === uid);
    return device === 'mic' ? Boolean(t?.micLocked) : Boolean(t?.camLocked);
  }

  /** Périphérique du pair actuellement allumé (sinon coupé ou verrouillé). */
  peerDeviceOn(uid: string, device: 'mic' | 'cam'): boolean {
    const t = this.remoteTiles().find((x) => x.userId === uid);
    if (!t) {
      return true; // pas en salle : on considère allumé
    }
    return device === 'mic' ? t.micOn && !t.micLocked : t.camOn && !t.camLocked;
  }

  /** Ce pair partage-t-il actuellement son écran ? */
  peerSharing(uid: string): boolean {
    return this.remoteTiles().find((x) => x.userId === uid)?.sharing === true;
  }

  /** L'animateur coupe le partage d'écran du présentateur distant. */
  stopRemotePresentation(): void {
    const uid = this.presenterUid();
    if (uid && uid !== 'me') {
      this.sendModeration(uid, 'stop_share');
    }
  }

  toggleModMenu(key: string): void {
    this.modMenu.set(this.modMenu() === key ? '' : key);
  }

  moderateParticipant(p: MeetingParticipantDto, action: string): void {
    if (!p.userId) {
      return;
    }
    this.modMenu.set('');
    this.sendModeration(p.userId, action);
  }

  sendModeration(targetUserId: string, action: string): void {
    const s = this.socketSvc.getSocket();
    s?.emit(
      'meeting:moderation',
      { roomId: this.roomId, action, targetUserId },
      (ack: { ok?: boolean; message?: string }) => {
        if (!ack?.ok) {
          this.status.set(ack?.message || 'Action refusée.');
          return;
        }
        // Patch optimiste : la tuile bascule tout de suite (avatar, verrou)
        // — la media-state de la victime confirmera
        const patch: Partial<RemoteTileState> = {};
        if (action === 'mute_audio') {
          patch.micOn = false;
        } else if (action === 'disable_audio') {
          patch.micOn = false;
          patch.micLocked = true;
        } else if (action === 'unmute_audio') {
          patch.micOn = true;
          patch.micLocked = false;
        } else if (action === 'mute_video') {
          patch.camOn = false;
        } else if (action === 'disable_video') {
          patch.camOn = false;
          patch.camLocked = true;
        } else if (action === 'unmute_video') {
          patch.camOn = true;
          patch.camLocked = false;
        } else if (action === 'stop_share') {
          patch.sharing = false;
        }
        this.patchTile(targetUserId, patch);
        this.cdr.markForCheck();
      }
    );
  }

  async toggleScreenShare(): Promise<void> {
    if (this.screenSharing()) {
      await this.stopScreenShare();
      return;
    }
    // Partage autorisé même seul : aperçu local + envoyé aux pairs qui rejoindront
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
      // Écran envoyé EN PLUS de la caméra : piste séparée vers chaque pair (mesh)
      for (const st of this.peers.values()) {
        try {
          st.screenSender = st.pc.addTrack(vt, display);
        } catch {
          /* */
        }
      }
      this.screenSharing.set(true);
      this.cdr.detectChanges();
      this.attachPresentVideo();
      this.emitMediaState();
    } catch {
      this.status.set('Partage d’écran annulé ou refusé.');
    }
  }

  private showModNotice(text: string): void {
    this.modNotice.set(text);
    if (this.modNoticeTimer) {
      clearTimeout(this.modNoticeTimer);
    }
    this.modNoticeTimer = setTimeout(() => {
      this.modNotice.set('');
      this.cdr.markForCheck();
    }, 6000);
  }

  toggleMic(): void {
    if (this.micLocked()) {
      this.status.set('Micro désactivé par l’animateur — impossible de le rallumer.');
      this.showModNotice('Votre micro est désactivé par l’animateur.');
      return;
    }
    const on = !this.micOn();
    this.micOn.set(on);
    const t = this.localStream?.getAudioTracks()[0];
    if (t) {
      t.enabled = on;
    }
    this.emitMediaState();
  }

  toggleCam(): void {
    if (this.camLocked()) {
      this.status.set('Caméra désactivée par l’animateur — impossible de la rallumer.');
      this.showModNotice('Votre caméra est désactivée par l’animateur.');
      return;
    }
    const on = !this.camOn();
    this.camOn.set(on);
    if (this.cameraVideoTrack) {
      this.cameraVideoTrack.enabled = on;
    }
    // La piste caméra est partagée par tous les senders : pas besoin de boucler
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
    const img = this.chatImage();
    if (!text && !img) {
      return;
    }
    this.socketSvc.getSocket()?.emit('chat:message', {
      roomId: this.roomId,
      content: text,
      image: img?.dataUrl || undefined,
    });
    this.chatDraft = '';
    this.chatImage.set(null);
  }

  onChatKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') {
      this.sendChat();
    }
  }

  /** Coller une image depuis le presse-papiers dans le champ message. */
  onChatPaste(ev: ClipboardEvent): void {
    const items = ev.clipboardData?.items;
    if (!items) {
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) {
          ev.preventDefault();
          this.readChatImage(file);
          return;
        }
      }
    }
  }

  /** Bouton trombone : sélection d'une image depuis le disque. */
  onChatFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.readChatImage(file);
    }
    input.value = '';
  }

  removeChatImage(): void {
    this.chatImage.set(null);
  }

  private readChatImage(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      void this.compressChatImage(String(reader.result || '')).then((dataUrl) => {
        this.chatImage.set({ dataUrl, name: file.name || 'image.png' });
        this.cdr.markForCheck();
      });
    };
    reader.readAsDataURL(file);
  }

  /** Réduit l'image (max 1280px, JPEG 82%) pour rester sous la limite socket. */
  private compressChatImage(dataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        let w = img.width;
        let h = img.height;
        if (Math.max(w, h) > max) {
          const r = max / Math.max(w, h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        cv.getContext('2d')?.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  isSelfMsg(c: ChatMsg): boolean {
    return Boolean(c.senderId && c.senderId === this.auth.user()?.id);
  }

  chatInitials(c: ChatMsg): string {
    return this.initials(c.senderName || 'P');
  }

  /** Ouvre la visionneuse plein écran sur l'image du message. */
  openChatImage(c: ChatMsg): void {
    if (!c.imageUrl) {
      return;
    }
    this.lightboxZoom.set(1);
    this.lightbox.set({
      src: c.imageUrl,
      sender: this.isSelfMsg(c) ? 'Vous' : c.senderName || 'Participant',
      sentAt: c.sentAt,
    });
  }

  closeLightbox(): void {
    this.lightbox.set(null);
  }

  /** Zoom molette ou boutons, borné 0.5×–4×. */
  zoomLightbox(delta: number): void {
    const z = Math.min(4, Math.max(0.5, this.lightboxZoom() + delta));
    this.lightboxZoom.set(Math.round(z * 100) / 100);
  }

  onLightboxWheel(ev: WheelEvent): void {
    ev.preventDefault();
    this.zoomLightbox(ev.deltaY < 0 ? 0.25 : -0.25);
  }

  lightboxZoomPct(): string {
    return `${Math.round(this.lightboxZoom() * 100)} %`;
  }

  downloadLightbox(): void {
    const lb = this.lightbox();
    if (!lb) {
      return;
    }
    const a = document.createElement('a');
    a.href = lb.src;
    a.download = `alwassit-${Date.now()}.jpg`;
    a.click();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.lightbox()) {
      this.closeLightbox();
      return;
    }
    if (this.modMenu()) {
      this.modMenu.set('');
    }
  }

  private scrollChatToBottom(): void {
    const el = this.chatScroll?.nativeElement;
    if (el) {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 30);
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
      micLocked: this.micLocked(),
      camLocked: this.camLocked(),
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
          let changed = false;
          for (const st of this.peers.values()) {
            const speaking = this.levelOf(st.analyser) > 0.045;
            const tile = this.remoteTiles().find((t) => t.userId === st.userId);
            if (tile && tile.speaking !== speaking) {
              this.patchTile(st.userId, { speaking });
              changed = true;
            }
          }
          if (changed) {
            this.cdr.markForCheck();
          }
        }, 200);
      }
    } catch {
      /* WebAudio indisponible */
    }
  }

  private attachRemoteAnalyser(uid: string, stream: MediaStream): void {
    const st = this.peers.get(uid);
    try {
      if (!this.audioCtx || !st || st.analyser) {
        return;
      }
      const src = this.audioCtx.createMediaStreamSource(stream);
      st.analyser = this.audioCtx.createAnalyser();
      st.analyser.fftSize = 512;
      src.connect(st.analyser);
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
    for (const st of this.peers.values()) {
      st.analyser = null;
    }
    void this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
  }

  private syncLocalVideo(): void {
    const el = this.localV?.nativeElement;
    if (!el) {
      return;
    }
    el.muted = true;
    if (this.localStream) {
      el.srcObject = this.localStream;
    }
  }

  /** Attache le flux d'écran à la tuile de présentation (local ou distant). */
  private attachPresentVideo(): void {
    const el = this.presentV?.nativeElement;
    if (!el) {
      return;
    }
    const uid = this.presenterUid();
    const stream =
      uid === 'me' ? this.screenStream : this.peers.get(uid)?.screenRemote || null;
    if (stream && el.srcObject !== stream) {
      el.srcObject = stream;
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
        messages?: ChatMsg[];
      }) => {
        if (!ack?.ok) {
          this.error.set(ack?.message || 'Accès à la salle refusé.');
          return;
        }
        // Historique persistant du chat (survit aux départs/retours)
        if (Array.isArray(ack.messages) && ack.messages.length) {
          this.chatMessages.set(ack.messages.slice(-200));
          this.scrollChatToBottom();
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
        // Une tuile par membre déjà présent — ils nous enverront chacun une offre
        const myId = this.auth.user()?.id || '';
        for (const id of ids) {
          if (id !== myId) {
            this.patchTile(id, {});
          }
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

    // Mesh : le membre DÉJÀ présent reçoit l'événement du nouvel arrivant → c'est lui qui offre.
    // Chaque membre existant crée sa propre connexion vers l'arrivant.
    s.on(
      'meeting:peer-present',
      async ({ userId: otherId, email }: { userId?: string; email?: string }) => {
      const myId = this.auth.user()?.id || '';
      if (!otherId || otherId === myId) {
        return;
      }
      this.presentIds.update((set) => new Set(set).add(otherId));
      const part = this.findParticipantByUserId(otherId);
      const em = (email || part?.email || '').trim().toLowerCase();
      if (em) {
        this.presentEmails.update((set) => new Set(set).add(em));
      }
      this.patchTile(otherId, {});
      // Informer le nouvel arrivant de notre état cam/mic
      this.emitMediaState();
      const st = await this.ensurePc(otherId);
      if (st && !st.pc.remoteDescription) {
        await this.createOffer(otherId);
      }
      this.cdr.markForCheck();
    });

    s.on(
      'meeting:signal',
      async (msg: {
        from?: string;
        to?: string;
        type?: string;
        sdp?: string;
        candidate?: RTCIceCandidateInit;
      }) => {
        const myId = this.auth.user()?.id || '';
        if (!msg.from || msg.from === myId) {
          return;
        }
        // Signaux adressés à un autre pair (mesh) : ignorer
        if (msg.to && msg.to !== myId) {
          return;
        }
        this.patchTile(msg.from, {});
        const st = await this.ensurePc(msg.from);
        if (!st) {
          return;
        }
        const pc = st.pc;
        if (msg.type === 'offer' && msg.sdp) {
          // Glare (double offre si join simultané) : le plus petit id cède (« polite peer »)
          if (pc.signalingState !== 'stable') {
            if (pc.signalingState === 'have-local-offer' && myId.localeCompare(msg.from) > 0) {
              return; // impoli : notre offre gagne
            }
            await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
          }
          await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          st.offeredOnce = true;
          s.emit('meeting:signal', { roomId: this.roomId, to: msg.from, type: 'answer', sdp: answer.sdp });
          this.status.set('En appel');
          this.cdr.markForCheck();
        } else if (msg.type === 'answer' && msg.sdp) {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
          }
          this.status.set('En appel');
          this.cdr.markForCheck();
        } else if (msg.type === 'ice' && msg.candidate) {
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch {
            /* */
          }
        }
      }
    );

    // Un participant a quitté : fermer UNIQUEMENT sa connexion, les autres restent
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
      const who = this.peerName(otherId);
      this.closePeer(otherId);
      this.status.set(`${who} a quitté la salle.`);
      this.cdr.markForCheck();
    });

    // État micro/caméra/partage de chaque pair (avatar + indicateurs)
    s.on(
      'meeting:media-state',
      (msg: {
        userId?: string;
        email?: string;
        micOn?: boolean;
        camOn?: boolean;
        micLocked?: boolean;
        camLocked?: boolean;
        sharing?: boolean;
        name?: string;
      }) => {
        const myId = this.auth.user()?.id || '';
        if (!msg.userId || msg.userId === myId) {
          return;
        }
        this.patchTile(msg.userId, {
          camOn: msg.camOn !== false,
          micOn: msg.micOn !== false,
          micLocked: msg.micLocked === true,
          camLocked: msg.camLocked === true,
          sharing: msg.sharing === true,
          ...(msg.name ? { name: msg.name } : {}),
        });
        this.cdr.markForCheck();
      }
    );

    s.on('chat:message', (msg: ChatMsg) => {
      this.chatMessages.update((list) => [...list, msg].slice(-200));
      this.scrollChatToBottom();
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
      const audio = this.localStream?.getAudioTracks()[0];
      const cam = this.cameraVideoTrack;
      switch (msg.action) {
        // Couper : simple extinction, l'utilisateur peut rallumer
        case 'mute_audio':
          this.micOn.set(false);
          if (audio) {
            audio.enabled = false;
          }
          this.status.set('Micro coupé par l’animateur');
          break;
        case 'mute_video':
          this.camOn.set(false);
          if (cam) {
            cam.enabled = false;
          }
          this.status.set('Caméra coupée par l’animateur');
          break;
        // Désactiver : extinction + verrou (l'utilisateur ne peut PAS rallumer)
        case 'disable_audio':
          this.micLocked.set(true);
          this.micOn.set(false);
          if (audio) {
            audio.enabled = false;
          }
          this.status.set('Micro désactivé par l’animateur');
          this.showModNotice('L’animateur a désactivé votre micro — vous ne pouvez plus le rallumer.');
          break;
        case 'disable_video':
          this.camLocked.set(true);
          await this.stopScreenShare();
          this.camOn.set(false);
          if (cam) {
            cam.enabled = false;
          }
          this.status.set('Caméra désactivée par l’animateur');
          this.showModNotice('L’animateur a désactivé votre caméra — vous ne pouvez plus la rallumer.');
          break;
        // Réactiver : lever le verrou et rallumer
        case 'unmute_audio':
          this.micLocked.set(false);
          this.micOn.set(true);
          if (audio) {
            audio.enabled = true;
          }
          this.status.set('Micro réactivé par l’animateur');
          this.showModNotice('L’animateur a réactivé votre micro.');
          break;
        case 'unmute_video':
          this.camLocked.set(false);
          this.camOn.set(Boolean(this.cameraVideoTrack));
          if (cam) {
            cam.enabled = true;
          }
          this.status.set('Caméra réactivée par l’animateur');
          this.showModNotice('L’animateur a réactivé votre caméra.');
          break;
        // L'animateur coupe notre partage d'écran
        case 'stop_share':
          await this.stopScreenShare();
          this.status.set('Partage d’écran arrêté par l’animateur');
          this.showModNotice('L’animateur a arrêté votre partage d’écran.');
          break;
        default:
          return;
      }
      this.syncLocalVideo();
      // Propager l'état : les autres voient l'avatar/l'icône mis à jour
      this.emitMediaState();
      this.cdr.markForCheck();
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

  /** Connexion mesh : une RTCPeerConnection par pair distant. */
  private async ensurePc(uid: string): Promise<PeerState | null> {
    const existing = this.peers.get(uid);
    if (existing && existing.pc.signalingState !== 'closed') {
      return existing;
    }
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    const st: PeerState = {
      userId: uid,
      pc,
      videoSender: null,
      screenSender: null,
      stream: null,
      screenRemote: null,
      analyser: null,
      offeredOnce: false,
    };
    this.peers.set(uid, st);
    const s = this.socketSvc.getSocket();
    pc.onicecandidate = (ev) => {
      if (ev.candidate && s) {
        s.emit('meeting:signal', {
          roomId: this.roomId,
          to: uid,
          type: 'ice',
          candidate: ev.candidate.toJSON(),
        });
      }
    };
    // Renégociation automatique (ajout/retrait de la piste d'écran)
    pc.onnegotiationneeded = async () => {
      if (!st.offeredOnce || pc.signalingState !== 'stable' || !s) {
        return;
      }
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit('meeting:signal', {
          roomId: this.roomId,
          to: uid,
          type: 'offer',
          sdp: offer.sdp,
        });
      } catch {
        /* */
      }
    };
    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (!stream) {
        return;
      }
      // 2ᵉ flux vidéo = partage d'écran du pair (la caméra continue en parallèle)
      if (ev.track.kind === 'video' && st.stream && stream.id !== st.stream.id) {
        st.screenRemote = stream;
        this.patchTile(uid, { sharing: true });
        ev.track.onended = () => {
          st.screenRemote = null;
          this.patchTile(uid, { sharing: false });
          this.cdr.markForCheck();
        };
        this.cdr.detectChanges();
        this.attachPresentVideo();
        this.cdr.markForCheck();
        return;
      }
      st.stream = stream;
      this.patchTile(uid, { active: true });
      // Forcer le rendu pour monter l'élément <video> de la tuile
      this.cdr.detectChanges();
      this.attachPeerVideo(uid);
      this.cdr.markForCheck();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this.patchTile(uid, { active: false });
        this.cdr.markForCheck();
      }
    };
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }
    st.videoSender = pc.getSenders().find((x) => x.track?.kind === 'video') ?? null;
    // Qualité HD : ~2,5 Mbps, pas de réduction de résolution
    if (st.videoSender) {
      const params = st.videoSender.getParameters();
      params.encodings = [{ maxBitrate: 2_500_000, scaleResolutionDownBy: 1 }];
      void st.videoSender.setParameters(params).catch(() => {});
    }
    // Si on partage déjà l'écran, ce pair reçoit la piste écran EN PLUS de la caméra
    if (this.screenSharing() && this.screenStream) {
      const vt = this.screenStream.getVideoTracks()[0];
      if (vt) {
        st.screenSender = pc.addTrack(vt, this.screenStream);
      }
    }
    if (!this.cameraVideoTrack) {
      this.cameraVideoTrack = this.localStream?.getVideoTracks()[0] ?? null;
    }
    return st;
  }

  private async createOffer(uid: string): Promise<void> {
    const s = this.socketSvc.getSocket();
    const st = this.peers.get(uid);
    if (!st || !s) {
      return;
    }
    const offer = await st.pc.createOffer();
    await st.pc.setLocalDescription(offer);
    st.offeredOnce = true;
    s.emit('meeting:signal', { roomId: this.roomId, to: uid, type: 'offer', sdp: offer.sdp });
  }

  private async stopScreenShare(): Promise<void> {
    if (!this.screenSharing()) {
      return;
    }
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    for (const st of this.peers.values()) {
      if (st.screenSender) {
        try {
          st.pc.removeTrack(st.screenSender);
        } catch {
          /* */
        }
        st.screenSender = null;
      }
    }
    this.screenSharing.set(false);
    this.emitMediaState();
  }

  /** Attache le flux d'un pair à sa tuile (peut arriver avant que la tuile existe). */
  private attachPeerVideo(uid: string): void {
    const st = this.peers.get(uid);
    if (!st?.stream) {
      return;
    }
    const ref = this.remoteVs?.find(
      (v) => v.nativeElement.dataset['uid'] === uid
    );
    const el = ref?.nativeElement;
    if (!el) {
      return;
    }
    if (el.srcObject !== st.stream) {
      el.srcObject = st.stream;
    }
    this.attachRemoteAnalyser(uid, st.stream);
  }

  /** Ferme la connexion d'un pair et retire sa tuile (les autres restent). */
  private closePeer(uid: string): void {
    const st = this.peers.get(uid);
    if (st) {
      st.analyser = null;
      try {
        st.pc.close();
      } catch {
        /* */
      }
      this.peers.delete(uid);
    }
    const ref = this.remoteVs?.find(
      (v) => v.nativeElement.dataset['uid'] === uid
    );
    if (ref?.nativeElement) {
      ref.nativeElement.srcObject = null;
    }
    this.remoteTiles.update((list) => list.filter((t) => t.userId !== uid));
  }

  private closeAllPeers(): void {
    for (const uid of [...this.peers.keys()]) {
      this.closePeer(uid);
    }
  }

  private leaveMediaAndPc(navigate: boolean): void {
    this.stopSpeakingDetection();
    // Prévenir les autres que l'on quitte la salle
    if (this.roomId) {
      this.socketSvc.getSocket()?.emit('meeting:leave-room', { roomId: this.roomId });
    }
    if (this.screenSharing()) {
      this.screenStream?.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
      this.screenSharing.set(false);
    }
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.cameraVideoTrack = null;
    if (this.localV?.nativeElement) {
      this.localV.nativeElement.srcObject = null;
    }
    this.closeAllPeers();
    if (navigate) {
      void this.router.navigate(['/meetings', this.meetingId, 'lobby']);
    }
  }
}
