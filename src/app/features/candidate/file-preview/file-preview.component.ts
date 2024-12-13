import { CommonModule, isPlatformBrowser  } from '@angular/common';
import { Component, Input, Output, EventEmitter, ElementRef, Inject, ViewChild, PLATFORM_ID  } from '@angular/core';
import { NgxExtendedPdfViewerModule, VerbosityLevel } from 'ngx-extended-pdf-viewer';


@Component({
  selector: 'app-file-preview',
  standalone: true,
  imports: [CommonModule, NgxExtendedPdfViewerModule],
  templateUrl: './file-preview.component.html',
  styleUrl: './file-preview.component.css'
})
export class FilePreviewComponent {
  @Input() pdfSrc: string = '/assets/sample.pdf'; // Path to your PDF file
  // pdfSrc = '/assets/sample.pdf'; // Path to your PDF file
  isBrowser: boolean = false;

  // Set logLevel using the enum
  logLevel = VerbosityLevel.ERRORS;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    // Check if we're running in the browser
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
}
