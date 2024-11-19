import { Candidate } from './candidate';
import { Offer } from './offer';
import { Position } from './position';

export class Application {
  _id?: string;
  candidate!: Candidate;
  offer!: Offer;
  position!: Position;
  status!: 'applied' | 'interviewing' | 'rejected' | 'hired';
  appliedAt?: Date;
  notes?: string;
}