import { MeterName } from "./meters";

export interface WorldEvent {
  id: string;
  name: string;
  description: string;
  effects: { meter: MeterName; change: number }[];
}
