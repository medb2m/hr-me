export interface File {
    filename: string;
    filepath: string;
    uploadedAt: Date;
  }
  
  export interface Comment {
    comment: string;
    commentedBy: string; // User ID
    commentedAt: Date;
  }
  
  export interface History {
    status: string;
    changedAt: Date;
  }
  
  export interface Ticket {
    _id: string; 
    title: string;
    description: string;
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    type:
      | 'Document Request'
      | 'Missing Documents'
      | 'Missing Information'
      | 'Candidate Follow-Up'
      | 'Offer Revision'
      | 'Application Review'
      | 'Interview Scheduling'
      | 'Interview Feedback'
      | 'Onboarding Process'
      | 'Follow-Up'
      | 'Bug'
      | 'Feature Request'
      | 'Task';
    category: string;
    assignedTeam: 'IT' | 'Com'; 
    assignedTo?: string; 
    candidateId?: string; 
    offerId?: string; 
    deadline?: Date;
    files?: File[]; 
    comments?: Comment[]; 
    history?: History[]; 
    createdAt?: Date; 
    updatedAt?: Date; 
  }
  