export interface Candidate {
    name: string;
    email: string;
    phone: string;
    position?: string;
    status?: 'waiting' | 'interviewing' | 'hired'; // Expand this as needed
    experience?: number;
    skills?: string[];
  }