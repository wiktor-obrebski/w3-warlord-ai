declare module "@lib/warcraft3-api/group" {
  export function CreateGroup(): group | undefined;
  export function GroupEnumUnitsOfPlayer(whichGroup: group, whichPlayer: player, filter?: boolexpr): void;
  export function GroupEnumUnitsInRange(whichGroup: group, x: number, y: number, radius: number, filter?: boolexpr): void;
  export function FirstOfGroup(whichGroup: group): unit | undefined;
  export function GroupRemoveUnit(whichGroup: group, whichUnit: unit): boolean;
  export function DestroyGroup(whichGroup: group): void;
}
