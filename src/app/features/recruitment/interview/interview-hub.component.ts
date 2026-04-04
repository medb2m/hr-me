import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InterviewService } from '../../../services/interview.service';

@Component({
  selector: 'app-interview-hub',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './interview-hub.component.html',
  styleUrl: './interview-hub.component.css',
})
export class InterviewHubComponent {
  readonly form;
  submitting = false;
  apiError: string | null = null;

  constructor(
    private readonly router: Router,
    private readonly interviewService: InterviewService,
    fb: FormBuilder
  ) {
    this.form = fb.nonNullable.group({
      title: [
        'Technical screening',
        [Validators.required, Validators.maxLength(120)],
      ],
      candidateName: ['', [Validators.maxLength(80)]],
    });
  }

  createMeeting(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.apiError = null;
    const title = this.form.controls.title.getRawValue().trim();
    const candidateName =
      this.form.controls.candidateName.getRawValue().trim();
    this.interviewService.createSession({ title, candidateName }).subscribe({
      next: (res) => {
        this.submitting = false;
        const id = res.data?._id;
        if (!id) {
          this.apiError = 'Invalid response from server.';
          return;
        }
        void this.router.navigate(['/recruitment/interview/room', id]);
      },
      error: (err) => {
        this.submitting = false;
        this.apiError =
          err.error?.message ||
          err.message ||
          'Could not start the interview. Check the API key on the server and try again.';
      },
    });
  }
}
