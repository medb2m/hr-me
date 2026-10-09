import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';

@Component({
  selector: 'app-client-explore-page',
  imports: [RouterLink, BackButtonComponent],
  templateUrl: './client-explore-page.component.html',
  styleUrl: './client-explore-page.component.css',
})
export class ClientExplorePageComponent {}
