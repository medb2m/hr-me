import { Component } from '@angular/core';
import {
  LucideCircleCheckBig,
  LucideLock,
  LucideShieldCheck,
  LucideGlobe,
  LucideGauge,
} from '@lucide/angular';
import { BackButtonComponent } from '../../back-button/back-button.component';

@Component({
  selector: 'app-about-page',
  imports: [
    LucideCircleCheckBig,
    LucideLock,
    LucideShieldCheck,
    LucideGlobe,
    LucideGauge,
    BackButtonComponent,
  ],
  templateUrl: './about-page.component.html',
  styleUrl: './about-page.component.css',
})
export class AboutPageComponent {}
