import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';

@Component({
  selector: 'app-client-skills-page',
  imports: [RouterLink, BackButtonComponent],
  templateUrl: './client-skills-page.component.html',
  styleUrl: './client-skills-page.component.css',
})
export class ClientSkillsPageComponent {}
