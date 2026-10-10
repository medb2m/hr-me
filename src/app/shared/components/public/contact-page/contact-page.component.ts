import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import {
  LucideCheck,
  LucideClock,
  LucideHandshake,
  LucideMail,
  LucideMapPin,
  LucidePhone,
  LucideSend,
} from '@lucide/angular';
import { ContactApiService } from '../../../../core/services/contact-api.service';
import { BackButtonComponent } from '../../back-button/back-button.component';

@Component({
  selector: 'app-contact-page',
  imports: [
    CommonModule,
    FormsModule,
    BackButtonComponent,
    LucideCheck,
    LucideClock,
    LucideHandshake,
    LucideMail,
    LucideMapPin,
    LucidePhone,
    LucideSend,
  ],
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.css',
})
export class ContactPageComponent implements OnInit {
  private readonly api = inject(ContactApiService);
  private readonly route = inject(ActivatedRoute);

  readonly subjects = [
    'Question générale',
    'Candidature / placement',
    'Partenariat entreprise',
    'Recruteur / employeur',
    'Autre',
  ];

  name = '';
  email = '';
  phone = '';
  company = '';
  subject = 'Question générale';
  message = '';
  /** Honeypot — invisible pour les humains. */
  website = '';

  sending = false;
  sent = false;
  errorMsg = '';

  ngOnInit(): void {
    // ?sujet=partenariat (bouton « Devenir partenaire » des pages services/about)
    const pre = this.route.snapshot.queryParamMap.get('sujet');
    if (pre === 'partenariat') {
      this.subject = 'Partenariat entreprise';
    }
  }

  get canSubmit(): boolean {
    return (
      !this.sending &&
      this.name.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim()) &&
      this.message.trim().length >= 10
    );
  }

  submit(): void {
    if (!this.canSubmit) {
      return;
    }
    this.sending = true;
    this.errorMsg = '';
    this.api
      .submitContact({
        name: this.name.trim(),
        email: this.email.trim(),
        phone: this.phone.trim(),
        company: this.company.trim(),
        subject: this.subject,
        message: this.message.trim(),
        website: this.website,
      })
      .pipe(finalize(() => (this.sending = false)))
      .subscribe({
        next: () => {
          this.sent = true;
        },
        error: (err: { error?: { message?: string } }) => {
          this.errorMsg = err.error?.message || "Envoi impossible — réessayez plus tard.";
        },
      });
  }
}
