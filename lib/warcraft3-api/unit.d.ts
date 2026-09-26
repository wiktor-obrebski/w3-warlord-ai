declare module "@lib/warcraft3-api/unit" {
  export const UNIT_TYPE_PEON: unittype;

  export interface unit extends widget { __unit: never; }

  export function IssueBuildOrderById(whichPeon: unit, unitId: number, x: number, y: number): boolean;

  export function GetUnitTypeId(whichUnit: unit): number;
  export function IsUnitType(whichUnit: unit, whichUnitType: unittype): boolean;
}
