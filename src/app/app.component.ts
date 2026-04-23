import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterModule, TranslateModule, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'hr-me';
  /** Hide public navbar/footer inside `/admin` (admin module has its own chrome). */
  showPublicChrome = true;

  constructor(
    private translate: TranslateService,
    private router: Router,
  ) {
    this.translate.setDefaultLang('en');
    const syncChrome = () => {
      const path = this.router.url.split('?')[0];
      const admin = path === '/admin' || path.startsWith('/admin/');
      const meetingRoom = /\/meetings\/[^/]+\/room$/.test(path);
      this.showPublicChrome = !admin && !meetingRoom;
    };
    syncChrome();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(syncChrome);
  }

  switchLanguage(language: string) {
    this.translate.use(language);
  }
}
