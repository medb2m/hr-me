import { Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-auth-visual',
  imports: [CommonModule],
  templateUrl: './auth-visual.component.html',
  styleUrl: './auth-visual.component.css',
})
export class AuthVisualComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private phraseIndex = 0;
  private charIndex = 0;
  private deleting = false;

  readonly phrases = [
    'GLOBAL REACH, LOCAL IMPACT',
    'UNIFYING WORLD MARKETS',
    'YOUR BRIDGE TO NEW HORIZONS',
    'POWERING INTERNATIONAL GROWTH',
  ];

  displayed = '';

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.displayed = this.phrases[0];
      return;
    }
    this.tick();
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  private tick(): void {
    const phrase = this.phrases[this.phraseIndex];
    let delay: number;
    if (!this.deleting) {
      this.charIndex += 1;
      this.displayed = phrase.slice(0, this.charIndex);
      delay = 55;
      if (this.charIndex === phrase.length) {
        this.deleting = true;
        delay = 2200;
      }
    } else {
      this.charIndex -= 1;
      this.displayed = phrase.slice(0, this.charIndex);
      delay = 30;
      if (this.charIndex === 0) {
        this.deleting = false;
        this.phraseIndex = (this.phraseIndex + 1) % this.phrases.length;
        delay = 350;
      }
    }
    this.timer = setTimeout(() => this.tick(), delay);
  }
}
