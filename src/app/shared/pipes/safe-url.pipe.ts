import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({ name: 'safeUrl' })
export class SafeUrlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(url: string): SafeResourceUrl {
    //return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    console.log('Sanitized URL:', safeUrl);
    return safeUrl;
  }
}