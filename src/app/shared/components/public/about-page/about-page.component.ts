import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAward,
  LucideBuilding2,
  LucideClipboardList,
  LucideGlobe,
  LucideGraduationCap,
  LucideHandshake,
  LucideMapPin,
  LucidePlane,
  LucideRocket,
  LucideShieldCheck,
  LucideUsers,
} from '@lucide/angular';
import { BackButtonComponent } from '../../back-button/back-button.component';

@Component({
  selector: 'app-about-page',
  imports: [
    RouterLink,
    LucideAward,
    LucideBuilding2,
    LucideClipboardList,
    LucideGlobe,
    LucideGraduationCap,
    LucideHandshake,
    LucideMapPin,
    LucidePlane,
    LucideRocket,
    LucideShieldCheck,
    LucideUsers,
    BackButtonComponent,
  ],
  templateUrl: './about-page.component.html',
  styleUrl: './about-page.component.css',
})
export class AboutPageComponent {}
