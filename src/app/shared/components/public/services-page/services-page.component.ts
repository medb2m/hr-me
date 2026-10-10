import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideGlobe,
  LucideBadgeCheck,
  LucideBuilding2,
  LucideHandshake,
  LucidePlane,
  LucideVideo,
  LucideFileText,
  LucideIdCard,
  LucideKanban,
} from '@lucide/angular';
import { BackButtonComponent } from '../../back-button/back-button.component';

@Component({
  selector: 'app-services-page',
  imports: [
    RouterLink,
    LucideGlobe,
    LucideBadgeCheck,
    LucideBuilding2,
    LucideHandshake,
    LucidePlane,
    LucideVideo,
    LucideFileText,
    LucideIdCard,
    LucideKanban,
    BackButtonComponent,
  ],
  templateUrl: './services-page.component.html',
  styleUrl: './services-page.component.css',
})
export class ServicesPageComponent {}
