declare module "@lib/warcraft3-api/location" {
  export function GetStartLocationLoc(whichStartLocation: number): location | undefined;

  export function GetLocationX(whichLocation: location): number;
  export function GetLocationY(whichLocation: location): number;
  export function GetLocationZ(whichLocation: location): number;

  export function RemoveLocation(whichLocation: location): void;

}
