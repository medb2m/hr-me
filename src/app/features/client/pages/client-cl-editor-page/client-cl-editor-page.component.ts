import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';

@Component({
  selector: 'app-client-cl-editor-page',
  imports: [RouterLink, BackButtonComponent],
  templateUrl: './client-cl-editor-page.component.html',
  styleUrl: './client-cl-editor-page.component.css',
})
export class ClientClEditorPageComponent {}
