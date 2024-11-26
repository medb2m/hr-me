import { Ticket } from "./ticket";

export interface TicketResponse {
    data: Ticket[];
    pagination: {
      limit: number;
      page: number;
      total: number;
    };
    success: boolean;
  }