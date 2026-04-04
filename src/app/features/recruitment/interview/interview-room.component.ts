import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InterviewMessage, InterviewSession } from '../../../models/interview-session';
import { InterviewService } from '../../../services/interview.service';
import { environment } from '../../../../environments/environment';

const SPEECH_SILENCE_MS = 1800;

/** Minimal typing for browser Speech Recognition API (dom libs vary in strict setups). */
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
};

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

@Component({
  selector: 'app-interview-room',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './interview-room.component.html',
  styleUrl: './interview-room.component.css',
})
export class InterviewRoomComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoEl') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('transcriptBox') transcriptBox?: ElementRef<HTMLDivElement>;

  session: InterviewSession | null = null;
  sessionId = '';
  loadError: string | null = null;
  cameraError: string | null = null;
  cameraActive = false;
  apiError: string | null = null;

  aiSubtitle = '';
  aiSpeaking = false;
  isListening = false;
  liveTranscript = '';
  sttSupported = true;

  /** Live AI reply while SSE chunks arrive */
  streamingAiText = '';

  /** Text of the utterance currently playing via TTS (for live captions). */
  currentSpeakingText = '';

  typedAnswer = '';
  sending = false;
  completing = false;

  private stream: MediaStream | null = null;
  private recognition: BrowserSpeechRecognition | null = null;
  private speechCommitted = '';
  private speechInterim = '';
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Best-effort “human” TTS voice for this browser (neural/online voices scored higher). */
  private preferredVoice: SpeechSynthesisVoice | null = null;
  /** Neural TTS playback (MP3 from backend); browser fallback uses speechSynthesis only. */
  private ttsAudio: HTMLAudioElement | null = null;
  private ttsObjectUrl: string | null = null;

  private readonly onVoicesChanged = (): void => {
    this.refreshPreferredVoice();
    this.cdr.markForCheck();
  };

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly interviewService: InterviewService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
    if (!isPlatformBrowser(this.platformId) || !this.sessionId) {
      return;
    }
    this.initSpeechRecognition();
    this.initSpeechSynthesisVoices();
    this.fetchSession();
  }

  private initSpeechSynthesisVoices(): void {
    if (!isPlatformBrowser(this.platformId) || !('speechSynthesis' in window)) {
      return;
    }
    this.refreshPreferredVoice();
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      this.onVoicesChanged
    );
  }

  private refreshPreferredVoice(): void {
    if (!('speechSynthesis' in window)) {
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      this.preferredVoice = null;
      return;
    }
    const docLang = (document.documentElement.lang || 'en-US').replace(
      /_/g,
      '-'
    );
    const short = docLang.split('-')[0]?.toLowerCase() || 'en';

    const score = (v: SpeechSynthesisVoice): number => {
      let s = 0;
      const lang = v.lang?.toLowerCase() ?? '';
      if (lang === docLang.toLowerCase()) {
        s += 120;
      } else if (lang.startsWith(short)) {
        s += 70;
      }
      const n = v.name.toLowerCase();
      if (
        /neural|natural\s|google|microsoft|online|premium|enhanced/i.test(n)
      ) {
        s += 100;
      }
      if (/zira|aria|jenny|guy|davis|sonia|libby|ryan|christopher/i.test(n)) {
        s += 25;
      }
      if (v.default) {
        s += 8;
      }
      return s;
    };

    this.preferredVoice = [...voices].sort((a, b) => score(b) - score(a))[0];
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      void this.startCamera();
    }
  }

  ngOnDestroy(): void {
    this.clearSilenceTimer();
    this.isListening = false;
    try {
      this.recognition?.abort();
    } catch {
      /* noop */
    }
    if (isPlatformBrowser(this.platformId) && 'speechSynthesis' in window) {
      window.speechSynthesis.removeEventListener(
        'voiceschanged',
        this.onVoicesChanged
      );
    }
    this.stopAiSpeech();
    this.stopCamera();
  }

  get visibleMessages(): InterviewMessage[] {
    return this.session?.messages?.filter((m) => m.role !== 'system') ?? [];
  }

  /** Live captions: streamed reply and/or what the AI voice is currently saying. */
  get liveAiCaptionsText(): string {
    if (this.streamingAiText.trim()) {
      return this.streamingAiText;
    }
    if (this.aiSpeaking && this.currentSpeakingText.trim()) {
      return this.currentSpeakingText;
    }
    return '';
  }

  /**
   * Question / instruction for the candidate: last completed assistant turn,
   * or the previous one while a new reply is still generating or speaking.
   */
  get lastQuestionText(): string {
    const assistants =
      this.session?.messages?.filter((m) => m.role === 'assistant') ?? [];
    if (!assistants.length) {
      return '';
    }
    const busy =
      this.sending ||
      !!this.streamingAiText.trim() ||
      this.aiSpeaking;
    if (busy && assistants.length >= 2) {
      return assistants[assistants.length - 2].content;
    }
    return assistants[assistants.length - 1].content;
  }

  /** Pulse the mic when it is your turn to answer (AI idle). */
  get micInvitationActive(): boolean {
    return (
      this.sttSupported &&
      !this.isComplete &&
      !this.aiSpeaking &&
      !this.sending &&
      !this.streamingAiText.trim() &&
      !this.isListening &&
      !this.completing
    );
  }

  get isComplete(): boolean {
    return this.session?.status === 'completed';
  }

  get canUseMic(): boolean {
    return (
      this.sttSupported &&
      !this.isComplete &&
      !this.aiSpeaking &&
      !this.sending &&
      !this.completing
    );
  }

  trackByMsg(index: number, m: InterviewMessage): string {
    const ts = m.createdAt ?? '';
    return `${index}_${m.role}_${m.content.length}_${ts}`;
  }

  msgTimeSuffix(m: InterviewMessage): string {
    const t = this.formatMsgTime(m);
    return t ? ` · ${t}` : '';
  }

  formatMsgTime(m: InterviewMessage): string {
    if (!m.createdAt) {
      return '';
    }
    try {
      const d = new Date(m.createdAt);
      if (Number.isNaN(d.getTime())) {
        return '';
      }
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  onComposerKeydown(ev: KeyboardEvent): void {
    if (ev.key !== 'Enter' || ev.shiftKey) {
      return;
    }
    ev.preventDefault();
    this.submitTyped();
  }

  private scrollTranscript(instant: boolean): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    requestAnimationFrame(() => {
      const el = this.transcriptBox?.nativeElement;
      if (!el) {
        return;
      }
      el.scrollTo({
        top: el.scrollHeight,
        behavior: instant ? 'auto' : 'smooth',
      });
    });
  }

  private fetchSession(): void {
    this.loadError = null;
    this.interviewService.getSession(this.sessionId).subscribe({
      next: (res) => {
        if (!res.data) {
          this.loadError = 'Session not found.';
          return;
        }
        this.applySession(res.data, true);
        this.cdr.markForCheck();
        this.scrollTranscript(false);
      },
      error: () => {
        this.loadError = 'Could not load this interview session.';
      },
    });
  }

  private applySession(data: InterviewSession, speakLatestAi: boolean): void {
    this.session = data;
    const assistants = data.messages.filter((m) => m.role === 'assistant');
    const last = assistants[assistants.length - 1]?.content ?? '';
    this.aiSubtitle = last;
    if (speakLatestAi && last && !this.isComplete) {
      void this.speak(last);
    }
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer != null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private scheduleSilenceSubmit(): void {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      this.flushSpeechAnswerFromSilence();
    }, SPEECH_SILENCE_MS);
  }

  /** Auto-send after pause (user finished speaking). */
  private flushSpeechAnswerFromSilence(): void {
    const t = (this.speechCommitted + ' ' + this.speechInterim).trim();
    if (!t || this.sending || !this.isListening) {
      return;
    }
    this.clearSilenceTimer();
    this.isListening = false;
    try {
      this.recognition?.stop();
    } catch {
      /* noop */
    }
    this.speechCommitted = '';
    this.speechInterim = '';
    this.liveTranscript = '';
    void this.submitUserText(t);
    this.cdr.markForCheck();
  }

  /** User explicitly sends current spoken text without waiting. */
  flushSpeechNow(): void {
    if (!this.isListening) {
      return;
    }
    const t = (this.speechCommitted + ' ' + this.speechInterim).trim();
    this.clearSilenceTimer();
    this.isListening = false;
    try {
      this.recognition?.stop();
    } catch {
      /* noop */
    }
    this.speechCommitted = '';
    this.speechInterim = '';
    this.liveTranscript = '';
    if (t) {
      void this.submitUserText(t);
    }
    this.cdr.markForCheck();
  }

  private initSpeechRecognition(): void {
    const g = globalThis as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SR = g.SpeechRecognition || g.webkitSpeechRecognition;
    if (!SR) {
      this.sttSupported = false;
      return;
    }
    const r = new SR();
    r.lang = document.documentElement.lang || 'en-US';
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (event: BrowserSpeechRecognitionEvent) => {
      if (!this.isListening || this.sending) {
        return;
      }
      let gotFinal = false;
      let interimPiece = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? '';
        if (res.isFinal && text.trim()) {
          this.speechCommitted = (
            this.speechCommitted +
            ' ' +
            text.trim()
          ).trim();
          gotFinal = true;
        } else {
          interimPiece += text;
        }
      }
      this.speechInterim = interimPiece.trim();
      this.liveTranscript = (
        this.speechCommitted +
        (this.speechInterim ? ' ' + this.speechInterim : '')
      ).trim();
      if (gotFinal) {
        this.scheduleSilenceSubmit();
      }
      this.cdr.markForCheck();
      this.scrollTranscript(true);
    };

    r.onerror = () => {
      this.isListening = false;
      this.clearSilenceTimer();
      this.liveTranscript = '';
      this.cdr.markForCheck();
    };

    r.onend = () => {
      if (this.isListening && this.recognition) {
        queueMicrotask(() => {
          if (!this.isListening || !this.recognition) {
            return;
          }
          try {
            this.recognition.start();
          } catch {
            /* already started — ignore */
          }
        });
      }
    };

    this.recognition = r;
  }

  toggleListen(): void {
    if (!this.canUseMic || !this.recognition) {
      return;
    }
    if (this.isListening) {
      this.clearSilenceTimer();
      this.isListening = false;
      try {
        this.recognition.abort();
      } catch {
        /* noop */
      }
      this.speechCommitted = '';
      this.speechInterim = '';
      this.liveTranscript = '';
      this.cdr.markForCheck();
      return;
    }
    this.speechCommitted = '';
    this.speechInterim = '';
    this.liveTranscript = '';
    this.clearSilenceTimer();
    try {
      this.recognition.start();
      this.isListening = true;
    } catch {
      this.isListening = false;
    }
    this.cdr.markForCheck();
  }

  submitTyped(): void {
    const t = this.typedAnswer.trim();
    if (!t) {
      return;
    }
    this.typedAnswer = '';
    void this.submitUserText(t);
  }

  async submitUserText(text: string): Promise<void> {
    if (
      !isPlatformBrowser(this.platformId) ||
      !this.sessionId ||
      this.sending ||
      this.isComplete ||
      !this.session
    ) {
      return;
    }

    this.clearSilenceTimer();
    this.isListening = false;
    try {
      this.recognition?.abort();
    } catch {
      /* noop */
    }
    this.speechCommitted = '';
    this.speechInterim = '';
    this.liveTranscript = '';

    this.stopAiSpeech();

    const userMsg: InterviewMessage = {
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    this.session = {
      ...this.session,
      messages: [...this.session.messages, userMsg],
    };
    this.cdr.markForCheck();
    this.scrollTranscript(true);

    this.sending = true;
    this.streamingAiText = '';
    this.aiSubtitle = '';
    this.apiError = null;

    await this.interviewService.sendCandidateMessageStream(
      this.sessionId,
      text,
      {
        onDelta: (d) => {
          this.streamingAiText += d;
          this.aiSubtitle = this.streamingAiText;
          this.cdr.markForCheck();
          this.scrollTranscript(true);
        },
        onDone: () => {
          this.streamingAiText = '';
          this.sending = false;
          this.cdr.markForCheck();
          this.interviewService.getSession(this.sessionId).subscribe({
            next: (res) => {
              if (res.data) {
                this.applySession(res.data, true);
              }
              this.scrollTranscript(false);
              this.cdr.markForCheck();
            },
            error: () => {
              this.apiError = 'Could not refresh transcript.';
            },
          });
        },
        onError: (m) => {
          this.streamingAiText = '';
          this.sending = false;
          this.apiError = m;
          this.cdr.markForCheck();
          this.interviewService.getSession(this.sessionId).subscribe({
            next: (res) => {
              if (res.data) {
                this.applySession(res.data, false);
              }
              this.cdr.markForCheck();
            },
          });
        },
      }
    );
  }

  endInterview(): void {
    if (!this.sessionId || this.completing || this.isComplete) {
      return;
    }
    this.completing = true;
    this.apiError = null;
    this.clearSilenceTimer();
    this.isListening = false;
    try {
      this.recognition?.abort();
    } catch {
      /* noop */
    }
    this.stopAiSpeech();
    this.interviewService.completeSession(this.sessionId).subscribe({
      next: (res) => {
        this.completing = false;
        if (res.data) {
          this.session = res.data;
        }
        void this.router.navigate([
          '/recruitment/interview/sessions',
          this.sessionId,
        ]);
      },
      error: (err) => {
        this.completing = false;
        this.apiError =
          err.error?.message || 'Could not finalize the interview.';
      },
    });
  }

  private async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError = 'Camera is not available in this environment.';
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      const video = this.videoRef?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
      }
      this.cameraActive = true;
      this.cameraError = null;
    } catch (e) {
      this.cameraError =
        'Could not access the camera. Allow permission (HTTPS may be required).';
      console.error(e);
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    const video = this.videoRef?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
    this.cameraActive = false;
  }

  /**
   * Neural TTS (free Microsoft voice via backend) when possible; else browser speechSynthesis.
   */
  private async speak(text: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !text?.trim()) {
      this.aiSpeaking = false;
      this.currentSpeakingText = '';
      return;
    }
    const trimmed = text.trim();
    this.stopAiSpeech();
    this.currentSpeakingText = trimmed;
    this.aiSpeaking = true;
    this.cdr.markForCheck();

    const neuralOk = await this.trySpeakNeural(trimmed);
    if (!neuralOk) {
      this.speakBrowserFallback(trimmed);
    }
  }

  /** POST /api/tts/speak → MP3; returns false if fetch/play fails. */
  private async trySpeakNeural(text: string): Promise<boolean> {
    try {
      const res = await fetch(`${environment.apiUrl}/tts/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        return false;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.ttsAudio = audio;
      this.ttsObjectUrl = url;
      audio.onended = () => {
        audio.onerror = null;
        this.releaseTtsPlayback();
        this.aiSpeaking = false;
        this.currentSpeakingText = '';
        this.cdr.markForCheck();
      };
      // Do not call speakBrowserFallback here: clearing src after onended can fire a
      // spurious error and would play the same line twice (neural then robot).
      audio.onerror = () => {
        audio.onended = null;
        this.releaseTtsPlayback();
        this.aiSpeaking = false;
        this.currentSpeakingText = '';
        this.cdr.markForCheck();
      };
      await audio.play();
      return true;
    } catch {
      this.releaseTtsPlayback();
      this.aiSpeaking = false;
      this.currentSpeakingText = '';
      return false;
    }
  }

  private releaseTtsPlayback(): void {
    if (this.ttsAudio) {
      const a = this.ttsAudio;
      a.onended = null;
      a.onerror = null;
      a.pause();
      a.removeAttribute('src');
      this.ttsAudio = null;
    }
    if (this.ttsObjectUrl) {
      URL.revokeObjectURL(this.ttsObjectUrl);
      this.ttsObjectUrl = null;
    }
  }

  private speakBrowserFallback(text: string): void {
    if (!isPlatformBrowser(this.platformId) || !('speechSynthesis' in window)) {
      this.aiSpeaking = false;
      this.currentSpeakingText = '';
      this.cdr.markForCheck();
      return;
    }
    if (!this.preferredVoice || !window.speechSynthesis.getVoices().length) {
      this.refreshPreferredVoice();
    }
    this.currentSpeakingText = text;
    this.aiSpeaking = true;
    const u = new SpeechSynthesisUtterance(text);
    if (this.preferredVoice) {
      u.voice = this.preferredVoice;
      if (this.preferredVoice.lang) {
        u.lang = this.preferredVoice.lang;
      }
    } else if (document.documentElement.lang) {
      u.lang = document.documentElement.lang.replace(/_/g, '-');
    }
    u.rate = 0.92;
    u.pitch = 1;
    u.volume = 1;
    u.onend = () => {
      this.aiSpeaking = false;
      this.currentSpeakingText = '';
      this.cdr.markForCheck();
    };
    u.onerror = () => {
      this.aiSpeaking = false;
      this.currentSpeakingText = '';
      this.cdr.markForCheck();
    };
    window.speechSynthesis.speak(u);
  }

  private stopAiSpeech(): void {
    this.releaseTtsPlayback();
    if (isPlatformBrowser(this.platformId) && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.aiSpeaking = false;
    this.currentSpeakingText = '';
  }
}
