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
      const espaceArea = path === '/espace' || path.startsWith('/espace/');
      const meetingRoom = /\/meetings\/[^/]+\/room$/.test(path);
      const interviewRoom = path.startsWith('/recruitment/interview/room');
      const scopedUser = this.scopedAreaUser();
      this.showPublicChrome =
        !admin && !meetingRoom && !interviewRoom && !clientArea && !espaceArea && !scopedUser;
    };
    const enforceClientScope = () => {
      this.auth.refreshFromStorage();
      const area = this.scopedAreaUser();
      if (!area) {
        return;
      }
      const path = this.router.url.split('?')[0];
      if (this.isAllowedScopedPath(area, path)) {
        return;
      }
      queueMicrotask(() => {
        this.auth.refreshFromStorage();
        const a = this.scopedAreaUser();
        if (!a) {
          return;
        }
        const p = this.router.url.split('?')[0];
        if (!this.isAllowedScopedPath(a, p)) {
          void this.router.navigateByUrl(a === 'client' ? '/espace/accueil' : '/client/overview', {
            replaceUrl: true,
          });
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

  /**
   * Espace dédié par rôle : `client` → `/espace` (compte public),
   * `candidate` → `/client` (dossier de placement). Retourne null pour les autres rôles.
   */
  private scopedAreaUser(): 'client' | 'candidate' | null {
    if (typeof localStorage === 'undefined' || !localStorage.getItem('authToken')) {
      return null;
    }
    if (!this.auth.isLoggedIn()) {
      return null;
    }
    const role = this.auth.user()?.role;
    return role === 'client' || role === 'candidate' ? role : null;
  }

  /** Routes autorisées en dehors de l'espace dédié (compte, vérification e-mail…). */
  private isAllowedScopedPath(area: 'client' | 'candidate', path: string): boolean {
    const home = area === 'client' ? '/espace' : '/client';
    if (path === home || path.startsWith(`${home}/`)) {
      return true;
    }
    const shared = ['/settings', '/logout', '/verify-email', '/confirm-email-change', '/resend-verification'];
    return shared.some((p) => path === p || path.startsWith(`${p}/`));
  }

  switchLanguage(language: string) {
    this.translate.use(language);
  }
}
