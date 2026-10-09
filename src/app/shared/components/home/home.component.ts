import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideGlobe,
  LucideCircleArrowRight,
  LucideCirclePlay,
  LucideMapPin,
  LucideLayoutGrid,
  LucideUsers,
  LucideShieldCheck,
  LucideBadgeCheck,
  LucideVideo,
  LucideContact,
  LucideFileText,
  LucideBriefcase,
  LucideMessageSquareText,
  LucideUserPlus,
  LucideSearch,
  LucideSparkles,
  LucideArrowRight,
} from '@lucide/angular';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    LucideGlobe,
    LucideCircleArrowRight,
    LucideCirclePlay,
    LucideMapPin,
    LucideLayoutGrid,
    LucideUsers,
    LucideShieldCheck,
    LucideBadgeCheck,
    LucideVideo,
    LucideContact,
    LucideFileText,
    LucideBriefcase,
    LucideMessageSquareText,
    LucideUserPlus,
    LucideSearch,
    LucideSparkles,
    LucideArrowRight,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {}
