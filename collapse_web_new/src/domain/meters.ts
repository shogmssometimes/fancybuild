export type MeterName =
  | "trust"
  | "distrust"
  | "surveillance"
  | "carteBlanche"
  | "influence"
  | "record"
  | "collapse";

export interface Meters {
  trust: number;
  distrust: number;
  surveillance: number;
  carteBlanche: number;
  influence: number;
  record: number;
  collapse: number;
}
