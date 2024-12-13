import { Offer } from "./offer";
import { Position } from "./position";
import { Skill } from "./skill";

export class Candidate {
    _id!: string;
    name!: string;
    email!: string;
    phone!: string;
    passportNumber!: string;
    cin!: string;
    offers!: Offer[];
    position?: Position;
    status?: 'waiting' | 'interviewing' | 'hired' | 'assigned'; // Expand this as needed
    experience?: number;
    skills?: Skill[];
    image?: string;
    selectedPositionId ?: string;
    createdAt?: Date;
    updatedAt?: Date;
    dossier?: {
      fileType: string;
      filename: string;
      filepath: string;
      uploadedAt: Date;
      status: 'uploaded' | 'missing';
    }[];
  }