import { aboutCommand } from "../commands/about.js";
import { addmagicCommand } from "../commands/addmagic.js";
import { addCommand } from "../commands/add.js";
import { analyzeCommand } from "../commands/analyze.js";
import { clearmagicCommand } from "../commands/clearmagic.js";
import { configCommand } from "../commands/config.js";
import { copyCommand } from "../commands/copy.js";
import { debugCommand } from "../commands/debug.js";
import { examplesCommand } from "../commands/examples.js";
import { findCommand } from "../commands/find.js";
import { giftCommand } from "../commands/gift.js";
import { helpCommand } from "../commands/help.js";
import { layoutsCommand } from "../commands/layouts.js";
import { layoutCommand } from "../commands/layout.js";
import { likeCommand, unlikeCommand } from "../commands/like.js";
import { magicCommand } from "../commands/magic.js";
import { percentilesCommand } from "../commands/percentiles.js";
import { removeCommand } from "../commands/remove.js";
import { renameCommand } from "../commands/rename.js";
import { setboardCommand } from "../commands/setboard.js";
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
  registerCommand(setboardCommand);
  registerCommand(clearmagicCommand);
  registerCommand(swapCommand);
  registerCommand(layoutCommand);
  registerCommand(likeCommand);
  registerCommand(unlikeCommand);
  registerCommand(giftCommand);
  registerCommand(magicCommand);
  registerCommand(layoutsCommand);
  registerCommand(analyzeCommand);
  registerCommand(findCommand);
  registerCommand(percentilesCommand);
  registerCommand(examplesCommand);
  registerCommand(configCommand);
  registerCommand(debugCommand);
}

export function parseMessage(
  content: string,
  prefix: string,
): { name: string; args: string } | null {
  if (!content.startsWith(prefix)) return null;

  const body = content.slice(prefix.length).trim();
  if (!body) return null;

  const space = body.indexOf(" ");
  if (space === -1) {
    return { name: body.toLowerCase(), args: "" };
  }

  return {
    name: body.slice(0, space).toLowerCase(),
    args: body.slice(space + 1).trim(),
  };
}
