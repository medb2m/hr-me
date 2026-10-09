import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowLeft } from '@lucide/angular';

@Component({
  selector: 'app-back-button',
  imports: [RouterLink, LucideArrowLeft],
  templateUrl: './back-button.component.html',
  styleUrl: './back-button.component.css',
})
export class BackButtonComponent {
  @Input() link: string | unknown[] = '/home';
  @Input() label = 'Retour';
  @Input() variant: 'light' | 'dark' = 'light';
}
