import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3UiApi from '@lib/warcraft3-api/ui';
import * as W3UnitApi from '@lib/warcraft3-api/unit';
import * as W3GroupApi from '@lib/warcraft3-api/group';
import * as W3LocationApi from '@lib/warcraft3-api/location';
import * as W3MathApi from '@lib/warcraft3-api/math';
import * as W3OrcApi from '@lib/warcraft3-api/orc';
import { Point, Vector } from '@lib/math';

declare const warlord_bot_player: W3PlayerApi.player;

main({ bot: warlord_bot_player });

function main({ bot }: { bot: W3PlayerApi.player }) {
  debug({ message: `Bot player id: ${W3PlayerApi.GetPlayerId(bot)}` });

  buildAltar({ bot });
}

function debug({ message }: { message: string }) {
  const humanPlayer = W3PlayerApi.Player(0);

  W3UiApi.DisplayTextToPlayer(humanPlayer, 0, 0, `[Warlord] ${message}`);
}

function buildAltar({ bot }: { bot: W3PlayerApi.player }) {
  debug({ message: 'Looking for worker...' });

  const peon = findPeon({ bot });

  if (!peon) {
    debug({ message: 'Peon not found!' });
    return;
  }

  debug({
    message: `Peon found, type id: ${W3UnitApi.GetUnitTypeId(peon)}`,
  });

  const startLocationIndex = W3PlayerApi.GetPlayerStartLocation(bot);

  debug({ message: `Start location: ${startLocationIndex}` });

  const startLocation = W3LocationApi.GetStartLocationLoc(startLocationIndex);

  const base = new Point({
    x: W3LocationApi.GetLocationX(startLocation),
    y: W3LocationApi.GetLocationY(startLocation),
  });

  debug({ message: `Base: ${base.x}, ${base.y}` });

  W3LocationApi.RemoveLocation(startLocation);

  for (let attempt = 0; attempt < 20; attempt++) {
    const angle = W3MathApi.GetRandomReal(0, Math.PI * 2);

    const distance = W3MathApi.GetRandomReal(500, 900);

    const site = base.translate({
      vector: new Vector({ x: distance, y: 0 }).rotate({ angle }),
    });

    const accepted = W3UnitApi.IssueBuildOrderById(
      peon,
      W3OrcApi.Building.ALTAR,
      site.x,
      site.y
    );

    if (accepted) {
      debug({ message: 'Altar build order accepted.' });
      return;
    }

    debug({ message: 'Build order rejected.' });
  }

  debug({ message: 'All altar locations rejected.' });
}

function findPeon({
  bot,
}: {
  bot: W3PlayerApi.player;
}): W3UnitApi.unit | undefined {
  const units = W3GroupApi.CreateGroup();

  debug({ message: 'Enumerating bot units...' });

  W3GroupApi.GroupEnumUnitsOfPlayer(units, bot, null);

  let unitCount = 0;
  let result: W3UnitApi.unit | undefined;

  while (true) {
    const unit = W3GroupApi.FirstOfGroup(units);

    if (!unit) {
      break;
    }

    W3GroupApi.GroupRemoveUnit(units, unit);

    unitCount++;

    const typeId = W3UnitApi.GetUnitTypeId(unit);
    const isPeon = W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_PEON);

    debug({ message: `Unit ${unitCount}: type=${typeId}, peon=${isPeon}` });

    if (isPeon) {
      result = unit;
      break;
    }
  }

  W3GroupApi.DestroyGroup(units);

  debug({ message: `Units enumerated: ${unitCount}` });

  return result;
}
