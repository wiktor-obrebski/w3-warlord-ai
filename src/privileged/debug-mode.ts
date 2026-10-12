import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3PrivilegedApi from '@lib/warcraft3-api/privileged';

export { type DebugMode, enableDebugMode, updateDebugMode };

const ResourcePanelWidth = 0.12;
// A minimized multiboard shows only its title and sizes itself to the title
// text; there is no width setting for it, so the title is padded instead.
// Not verified in-game that trailing spaces count towards the width.
const ResourcePanelTitle = 'Warlord AI' + ' '.repeat(20);
const GoldRow = 0;
const LumberRow = 1;

interface DebugMode {
  resourcePanel: W3PrivilegedApi.multiboard;
}

interface EnableDebugModeArgs {
  observer: W3PlayerApi.player;
}

/**
 * Reveals the whole map to the human observer and shows the bot's resources.
 * Must run after map initialization, where multiboards cannot be shown.
 */
function enableDebugMode({ observer }: EnableDebugModeArgs): DebugMode {
  revealMap({ observer });

  return { resourcePanel: createResourcePanel() };
}

interface UpdateDebugModeArgs {
  debugMode: DebugMode;
  bot: W3PlayerApi.player;
}

function updateDebugMode({ debugMode, bot }: UpdateDebugModeArgs) {
  const gold = W3PlayerApi.GetPlayerState(
    bot,
    W3PlayerApi.PLAYER_STATE_RESOURCE_GOLD
  );
  const lumber = W3PlayerApi.GetPlayerState(
    bot,
    W3PlayerApi.PLAYER_STATE_RESOURCE_LUMBER
  );

  setRowText({
    panel: debugMode.resourcePanel,
    row: GoldRow,
    text: `Gold: ${gold}`,
  });
  setRowText({
    panel: debugMode.resourcePanel,
    row: LumberRow,
    text: `Lumber: ${lumber}`,
  });
}

// Applies to the observer only, so the bot's own vision is unaffected.
function revealMap({ observer }: { observer: W3PlayerApi.player }) {
  const modifier = W3PrivilegedApi.CreateFogModifierRect(
    observer,
    W3PrivilegedApi.FOG_OF_WAR_VISIBLE,
    W3PrivilegedApi.GetWorldBounds(),
    false,
    false
  );

  W3PrivilegedApi.FogModifierStart(modifier);
}

function createResourcePanel(): W3PrivilegedApi.multiboard {
  const panel = W3PrivilegedApi.CreateMultiboard();

  W3PrivilegedApi.MultiboardSetTitleText(panel, ResourcePanelTitle);
  W3PrivilegedApi.MultiboardSetColumnCount(panel, 1);
  // Warcraft only handles row count changes of one at a time safely.
  W3PrivilegedApi.MultiboardSetRowCount(panel, 1);
  W3PrivilegedApi.MultiboardSetRowCount(panel, 2);
  W3PrivilegedApi.MultiboardSetItemsStyle(panel, true, false);
  W3PrivilegedApi.MultiboardSetItemsWidth(panel, ResourcePanelWidth);
  W3PrivilegedApi.MultiboardDisplay(panel, true);

  return panel;
}

interface SetRowTextArgs {
  panel: W3PrivilegedApi.multiboard;
  row: number;
  text: string;
}

function setRowText({ panel, row, text }: SetRowTextArgs) {
  const multiboardItem = W3PrivilegedApi.MultiboardGetItem(panel, row, 0);

  W3PrivilegedApi.MultiboardSetItemValue(multiboardItem, text);
  W3PrivilegedApi.MultiboardReleaseItem(multiboardItem);
}
