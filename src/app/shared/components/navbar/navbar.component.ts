import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {

  isSidebarOpen     = false;
  isUserDropdownOpen = false;
  isUserConnected   = false;

  dropdowns: { [key: string]: boolean } = {
    candidate:   false,
    offer:       false,
    ticket:      false,
    recruitment: false,
  };

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    if (this.isSidebarOpen) {
      document.body.classList.add('sidebar-open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.body.classList.remove('sidebar-open');
    }
  }

  navigateAndCloseSidebar(): void {
    this.isSidebarOpen = false;
    document.body.classList.remove('sidebar-open');
  }

  toggleDropdown(group: string): void {
    this.dropdowns[group] = !this.dropdowns[group];
  }

  toggleUserDropdown(): void {
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
  }

  login(): void {
    this.isUserConnected    = true;
    this.isUserDropdownOpen = false;
  }

  logout(): void {
    this.isUserConnected    = false;
    this.isUserDropdownOpen = false;
  }

  /** Close profile dropdown when clicking outside of it */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-wrap')) {
      this.isUserDropdownOpen = false;
    }
  }
}
