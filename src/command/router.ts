import { aboutCommand } from "../commands/about.js";
import { addmagicCommand } from "../commands/addmagic.js";
import { addCommand } from "../commands/add.js";
import { analyzeCommand } from "../commands/analyze.js";
import { clearmagicCommand } from "../commands/clearmagic.js";
import { compareCommand } from "../commands/compare.js";
import { combosCommand } from "../commands/combos.js";
import { configCommand } from "../commands/config.js";
import { copyCommand } from "../commands/copy.js";
import { debugCommand } from "../commands/debug.js";
import { distCommand } from "../commands/dist.js";
import { examplesCommand } from "../commands/examples.js";
import { findCommand } from "../commands/find.js";
import { freqCommand, freqsCommand, columnCommand } from "../commands/freq.js";
import { giftCommand } from "../commands/gift.js";
import { inspectCommand } from "../commands/inspect.js";
import { helpCommand } from "../commands/help.js";
import { layoutsCommand } from "../commands/layouts.js";
import { layoutCommand } from "../commands/layout.js";
import { randomCommand } from "../commands/random.js";
import { leaderboardCommand } from "../commands/leaderboard.js";
import { likesCommand } from "../commands/likes.js";
import { likeCommand, unlikeCommand } from "../commands/like.js";
import { magicCommand } from "../commands/magic.js";
import { percentilesCommand } from "../commands/percentiles.js";
import { removeCommand } from "../commands/remove.js";
import { renameCommand } from "../commands/rename.js";
import { clearlinkCommand, setlinkCommand } from "../commands/setlink.js";
import { setboardCommand } from "../commands/setboard.js";
import { setcombosCommand } from "../commands/setcombos.js";
import { suggestCommand } from "../commands/suggest.js";
import { swapCommand } from "../commands/swap.js";
import { clearCommands, registerCommand } from "./registry.js";

export function registerCommands(): void {
  clearCommands();
  registerCommand(helpCommand);
  registerCommand(aboutCommand);
  registerCommand(addCommand);
  registerCommand(addmagicCommand);
  registerCommand(copyCommand);
  registerCommand(removeCommand);
  registerCommand(renameCommand);
  registerCommand(setlinkCommand);
  registerCommand(clearlinkCommand);
  registerCommand(setboardCommand);
  registerCommand(clearmagicCommand);
  registerCommand(combosCommand);
  registerCommand(setcombosCommand);
  registerCommand(swapCommand);
  registerCommand(layoutCommand);
  registerCommand(inspectCommand);
  registerCommand(randomCommand);
  registerCommand(likeCommand);
  registerCommand(likesCommand);
  registerCommand(unlikeCommand);
  registerCommand(giftCommand);
  registerCommand(magicCommand);
  registerCommand(layoutsCommand);
  registerCommand(analyzeCommand);
  registerCommand(compareCommand);
  registerCommand(findCommand);
  registerCommand(freqCommand);
  registerCommand(freqsCommand);
  registerCommand(columnCommand);
  registerCommand(percentilesCommand);
  registerCommand(distCommand);
  registerCommand(leaderboardCommand);
  registerCommand(examplesCommand);
  registerCommand(suggestCommand);
  registerCommand(configCommand);
  registerCommand(debugCommand);
}

import { PREFIX, stripIncomingPrefix } from "./constants.js";

function parseCommandBody(body: string): { name: string; args: string } | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const space = trimmed.indexOf(" ");
  if (space === -1) {
    return { name: trimmed.toLowerCase(), args: "" };
  }

  return {
    name: trimmed.slice(0, space).toLowerCase(),
    args: trimmed.slice(space + 1).trim(),
  };
}

export function parseMessage(
  content: string,
  prefix: string,
  dm = false,
): { name: string; args: string } | null {
  void prefix;
  const body = stripIncomingPrefix(content, dm);
  if (body === null) return null;
  return parseCommandBody(body);
}
