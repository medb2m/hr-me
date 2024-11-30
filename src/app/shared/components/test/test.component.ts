import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test.component.html',
  styleUrl: './test.component.css'
})
export class TestComponent {
  

  //////////////////////// hello
  isUserConnected = false;

  isDarkTheme = true; // Default theme

  constructor(private translate: TranslateService) {}

  login() : void{
    this.isUserConnected = true;
    console.log('User logged in');
  }

  logout(): void {
    this.isUserConnected = false;
    console.log('User logged out');
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    document.body.classList.toggle('bg-dark', this.isDarkTheme); // Change website background
    document.body.classList.toggle('bg-light', !this.isDarkTheme);
  }

  switchLanguage(language: string): void {
    this.translate.use(language);
  }
}
