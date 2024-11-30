import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule,RouterOutlet,RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  // Sidebar toggle state
  isSidebarOpen = false;

  // Dropdown states
  dropdowns: { [key: string]: boolean } = {
    candidate: false,
    offer: false,
    ticket: false,
  };

  // Simulate user connection state
  isUserConnected = false;

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleDropdown(group: string): void {
    this.dropdowns[group] = !this.dropdowns[group];
  }

  login(): void {
    this.isUserConnected = true;
  }

  logout(): void {
    this.isUserConnected = false;
  }
  
}
