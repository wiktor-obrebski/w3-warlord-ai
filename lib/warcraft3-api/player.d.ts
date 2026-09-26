declare module "@lib/warcraft3-api/player" {
  export interface player extends agent {
    __player: never;
  }

  export function Player(number: number): player | undefined;
  export function GetPlayerId(whichPlayer: player): number;
}
