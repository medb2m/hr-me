import { Position } from "./position";

export interface Offer {
    _id?: string;
    name: string;
    partner: string;
    description?: string;
    positions?: {
        positionId: Position;
        candidatesNeeded: number;
        candidatesAchieved: number;
    }[];
    isAchieved?: boolean;
}