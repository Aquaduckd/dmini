import packageJson from "../../package.json" with { type: "json" };
import { fetchLayoutApiMeta } from "../api/meta.js";
import { PREFIX } from "../command/constants.js";
import type { Command } from "../command/types.js";
import { infoEmbed, replyEmbed } from "../discord/embeds.js";
import {
  getDminiSourceVersion,
  getLayoutApiSourceVersion,
  getMana2SourceVersion,
  sourceFieldLabel,
} from "../git/commitDate.js";

const SOURCE_URL = "https://github.com/Aquaduckd/dmini";
const LAYOUTAPI_SOURCE_URL = "https://github.com/Aquaduckd/layoutapi";
const MANA2_SOURCE_URL = "https://codeberg.org/Zakkkk/mana2";
const startedAt = Date.now();

function formatUptime(): string {
  const totalSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

function formatCount(count: number | null): string {
  return count === null ? "—" : count.toLocaleString();
}

export const aboutCommand: Command = {
  name: "about",
  description: "Show bot info, links, and credits",
  usage: `${PREFIX}about`,
  aliases: ["source"],
  examples: [`${PREFIX}about`],
  async execute({ message }) {
    let layoutCount: number | null = null;

    try {
      const meta = await fetchLayoutApiMeta();
      layoutCount = meta.layout_count;
    } catch (error) {
      console.error("Failed to fetch layout API meta:", error);
    }

    const [dminiVersion, layoutApiVersion, mana2Version] = await Promise.all([
      getDminiSourceVersion(),
      getLayoutApiSourceVersion(),
      getMana2SourceVersion(),
    ]);

    const embed = infoEmbed(
      "dmini",
      "Browse, edit, and analyze keyboard layouts from layoutapi.",
    )
      .addFields(
        { name: "Version", value: packageJson.version, inline: true },
        { name: "Uptime", value: formatUptime(), inline: true },
        { name: "Layouts", value: formatCount(layoutCount), inline: true },
        {
          name: sourceFieldLabel("Source", dminiVersion),
          value: `[github.com/Aquaduckd/dmini](${SOURCE_URL})`,
          inline: false,
        },
        {
          name: sourceFieldLabel("layoutapi", layoutApiVersion),
          value: `[github.com/Aquaduckd/layoutapi](${LAYOUTAPI_SOURCE_URL})`,
          inline: false,
        },
        {
          name: sourceFieldLabel("mana2", mana2Version),
          value: `[codeberg.org/Zakkkk/mana2](${MANA2_SOURCE_URL})`,
          inline: false,
        },
      );

    await replyEmbed(message, embed);
  },
};
