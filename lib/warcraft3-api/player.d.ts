declare module "@lib/warcraft3-api/player" {
  export interface player extends agent {
    __player: never;
  }

  export const bj_MAX_PLAYERS: number;
  export const PLAYER_SLOT_STATE_PLAYING: playerslotstate;

  export function Player(number: number): player | undefined;
  export function GetPlayerId(whichPlayer: player): number;
  export function GetPlayerStartLocation(whichPlayer: player): number;
  export function GetPlayerSlotState(whichPlayer: player): playerslotstate;
  export function IsPlayerEnemy(whichPlayer: player, otherPlayer: player): boolean;
}
