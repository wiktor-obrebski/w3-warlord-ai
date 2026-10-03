import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3PrivilegedApi from "@lib/warcraft3-api/privileged";

const RESOURCE_PANEL_WIDTH = 0.12;
// A minimized multiboard shows only its title and sizes itself to the title
// text; there is no width setting for it, so the title is padded instead.
// Not verified in-game that trailing spaces count towards the width.
const RESOURCE_PANEL_TITLE = "Warlord AI" + " ".repeat(20);
const GOLD_ROW = 0;
const LUMBER_ROW = 1;

export interface DebugMode {
  resourcePanel: W3PrivilegedApi.multiboard;
}

/**
 * Reveals the whole map to the human observer and shows the bot's resources.
 * Must run after map initialization, where multiboards cannot be shown.
 */
export function enableDebugMode(observer: W3PlayerApi.player): DebugMode {
  revealMap(observer);

  return { resourcePanel: createResourcePanel() };
}

export function updateDebugMode(debugMode: DebugMode, bot: W3PlayerApi.player) {
  const gold = W3PlayerApi.GetPlayerState(
    bot,
    W3PlayerApi.PLAYER_STATE_RESOURCE_GOLD,
  );
  const lumber = W3PlayerApi.GetPlayerState(
    bot,
    W3PlayerApi.PLAYER_STATE_RESOURCE_LUMBER,
  );

  setRowText(debugMode.resourcePanel, GOLD_ROW, `Gold: ${gold}`);
  setRowText(debugMode.resourcePanel, LUMBER_ROW, `Lumber: ${lumber}`);
}

// Applies to the observer only, so the bot's own vision is unaffected.
function revealMap(observer: W3PlayerApi.player) {
  const modifier = W3PrivilegedApi.CreateFogModifierRect(
    observer,
    W3PrivilegedApi.FOG_OF_WAR_VISIBLE,
    W3PrivilegedApi.GetWorldBounds(),
    false,
    false,
  );

  W3PrivilegedApi.FogModifierStart(modifier);
}

function createResourcePanel(): W3PrivilegedApi.multiboard {
  const panel = W3PrivilegedApi.CreateMultiboard();

  W3PrivilegedApi.MultiboardSetTitleText(panel, RESOURCE_PANEL_TITLE);
  W3PrivilegedApi.MultiboardSetColumnCount(panel, 1);
  // Warcraft only handles row count changes of one at a time safely.
  W3PrivilegedApi.MultiboardSetRowCount(panel, 1);
  W3PrivilegedApi.MultiboardSetRowCount(panel, 2);
  W3PrivilegedApi.MultiboardSetItemsStyle(panel, true, false);
  W3PrivilegedApi.MultiboardSetItemsWidth(panel, RESOURCE_PANEL_WIDTH);
  W3PrivilegedApi.MultiboardDisplay(panel, true);

  return panel;
}

function setRowText(
  panel: W3PrivilegedApi.multiboard,
  row: number,
  text: string,
) {
  const item = W3PrivilegedApi.MultiboardGetItem(panel, row, 0);

  W3PrivilegedApi.MultiboardSetItemValue(item, text);
  W3PrivilegedApi.MultiboardReleaseItem(item);
}
