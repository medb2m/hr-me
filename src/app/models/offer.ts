import { Application } from "./application";
import { Position } from "./position";

export interface Offer {
    _id: string;
    name: string;
    partner: string;
    description?: string;
    price: number;
    positions: {
        positionId: Position;
        candidatesNeeded: number;
        candidatesAchieved: number;
    }[];
    applications?: Application[];
    isAchieved?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}