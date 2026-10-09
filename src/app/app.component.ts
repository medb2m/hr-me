import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterModule, TranslateModule, NavbarComponent, FooterComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'al-wassit';
  /** Hide public navbar/footer inside `/admin` (admin module has its own chrome). */
  showPublicChrome = true;

  constructor(
    private translate: TranslateService,
    private router: Router,
    private auth: AuthService,
  ) {
    this.translate.setDefaultLang('en');
    const syncChrome = () => {
      this.auth.refreshFromStorage();
      const path = this.router.url.split('?')[0];
      const admin = path === '/adminlog' || path === '/admin/auth';
      const clientArea = path === '/client' || path.startsWith('/client/');
      const meetingRoom = /\/meetings\/[^/]+\/room$/.test(path);
      const interviewRoom = path.startsWith('/recruitment/interview/room');
      const clientLoggedIn = this.isClientUserInSession();
      this.showPublicChrome = !admin && !meetingRoom && !interviewRoom && !clientArea && !clientLoggedIn;
    };
    const enforceClientScope = () => {
      this.auth.refreshFromStorage();
      if (!this.isClientUserInSession()) {
        return;
      }
      const path = this.router.url.split('?')[0];
      if (path === '/client' || path.startsWith('/client/')) {
        return;
      }
      queueMicrotask(() => {
        this.auth.refreshFromStorage();
        if (!this.isClientUserInSession()) {
          return;
        }
        const p = this.router.url.split('?')[0];
        if (p !== '/client' && !p.startsWith('/client/')) {
          void this.router.navigateByUrl('/client/overview', { replaceUrl: true });
        }
      });
    };
    syncChrome();
    enforceClientScope();
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      syncChrome();
      enforceClientScope();
    });
  }

  /** Compte candidat connecté (JWT + rôle `client`). */
  private isClientUserInSession(): boolean {
    if (typeof localStorage === 'undefined' || !localStorage.getItem('authToken')) {
      return false;
    }
    return this.auth.isLoggedIn() && this.auth.user()?.role === 'client';
  }

  switchLanguage(language: string) {
    this.translate.use(language);
  }
}
