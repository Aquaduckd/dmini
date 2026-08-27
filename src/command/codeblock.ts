import { stripPrefix } from "./constants.js";

export function parseCommandWithOptionalCodeBlock(
  content: string,
  commandName: string,
): { args: string; codeBlock?: string } | null {
  const fenceIndex = content.indexOf("```");
  const header =
    fenceIndex === -1 ? content.trimEnd() : content.slice(0, fenceIndex).trimEnd();

  const rest = stripPrefix(header);
  if (rest === null) {
    return null;
  }

  const body = rest.trim();
  const space = body.indexOf(" ");
  if (space === -1 || body.slice(0, space).toLowerCase() !== commandName) {
    return null;
  }

  if (fenceIndex === -1) {
    return { args: body.slice(space + 1).trim() };
  }

  const afterFence = content.slice(fenceIndex + 3);
  const closingIndex = afterFence.indexOf("```");
  if (closingIndex === -1) {
    return null;
  }

  return {
    args: body.slice(space + 1).trim(),
    codeBlock: afterFence.slice(0, closingIndex).trim(),
  };
}
