import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-client-header',
  imports: [CommonModule, RouterLink],
  templateUrl: './client-header.component.html',
  styleUrl: './client-header.component.css',
})
export class ClientHeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;

  logout(): void {
    this.auth.clearSession();
    void this.router.navigateByUrl('/login');
  }
}
