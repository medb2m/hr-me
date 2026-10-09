import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';

@Component({
  selector: 'app-client-library-page',
  imports: [RouterLink, BackButtonComponent],
  templateUrl: './client-library-page.component.html',
  styleUrl: './client-library-page.component.css',
})
export class ClientLibraryPageComponent {}
