declare module "@lib/warcraft3-api/unit" {
  export const UNIT_TYPE_PEON: unittype;

  export interface unit extends widget { __unit: never; }

  export function IssueBuildOrderById(whichPeon: unit, unitId: number, x: number, y: number): boolean;
  export function IssueImmediateOrder(whichUnit: unit, order: string): boolean;
  export function IssueImmediateOrderById(whichUnit: unit, order: number): boolean;
  export function IssuePointOrder(whichUnit: unit, order: string, x: number, y: number): boolean;
  export function IssueTargetOrder(whichUnit: unit, order: string, targetWidget: widget): boolean;

  export function GetUnitTypeId(whichUnit: unit): number;
  export function IsUnitType(whichUnit: unit, whichUnitType: unittype): boolean;
  export function GetUnitX(whichUnit: unit): number;
  export function GetUnitY(whichUnit: unit): number;
}
