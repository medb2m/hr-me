import { Component } from '@angular/core';
import { RouterLink, RouterModule, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from "./shared/components/navbar/navbar.component";
import { TestComponent } from "./shared/components/test/test.component";
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, TranslateModule, RouterModule, NavbarComponent, TestComponent, FormsModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'hr-me';
  isSidebarOpen = false;

  dropdowns: { [key: string]: boolean } = {};

  constructor(private translate: TranslateService) {
    this.translate.setDefaultLang('en'); // Set default language
  }

  switchLanguage(language: string) {
    this.translate.use(language);
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;

    // Add or remove body class to control scrolling
    if (this.isSidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
    document.body.classList.remove('sidebar-open');
  }

  toggleDropdown(group: string): void {
    this.dropdowns[group] = !this.dropdowns[group];
  }
}
