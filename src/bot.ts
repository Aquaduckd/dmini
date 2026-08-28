import {
  Client,
  ChannelType,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { config } from "./config.js";
import { isAdmin } from "./config/admins.js";
import { isPublicAccessBlocked } from "./config/access.js";
import {
  buildCminiDeprecationMessage,
  getCommand,
  matchDeprecatedCminiPrefix,
  parseMessage,
  PREFIX,
  registerCommands,
  userCanRunCommand,
} from "./command/index.js";
import { errorEmbed, infoEmbed, replyEmbed } from "./discord/embeds.js";
import { handlePaginationInteraction } from "./discord/paginationButtons.js";
import { replyLoggedError } from "./discord/errors.js";

const globalState = globalThis as typeof globalThis & {
  __dminiClient?: Client;
};

async function destroyClient(client: Client): Promise<void> {
  client.removeAllListeners();
  await client.destroy();
}

export async function startBot(): Promise<void> {
  const existing = globalState.__dminiClient;
  if (existing) {
    await destroyClient(existing);
    globalState.__dminiClient = undefined;
  }

  registerCommands();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  globalState.__dminiClient = client;

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      const handled = await handlePaginationInteraction(interaction);
      if (handled) return;
    } catch (error) {
      if (interaction.isRepliable()) {
        const content = "Something went wrong updating this page.";
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content, embeds: [], components: [] });
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      }

      console.error("Pagination interaction error:", error);
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const isDm = message.channel.type === ChannelType.DM;

    if (matchDeprecatedCminiPrefix(message.content)) {
      await replyEmbed(
        message,
        infoEmbed("cmini is deprecated", buildCminiDeprecationMessage(message.content)),
      );
      return;
    }

    const parsed = parseMessage(message.content, PREFIX, isDm);
    if (!parsed) return;

    if (
      (await isPublicAccessBlocked()) &&
      !(await isAdmin(message.author.id))
    ) {
      await replyEmbed(
        message,
        errorEmbed(
          "dmini is in maintenance mode. Only admins can use commands right now.",
        ),
      );
      return;
    }

    const command = getCommand(parsed.name);
    if (
      !command ||
      !(await userCanRunCommand(command, message.author.id))
    ) {
      const commandLabel = isDm
        ? parsed.name
        : `${PREFIX}${parsed.name}`.trimEnd();
      await replyEmbed(
        message,
        errorEmbed(
          `Unknown command: \`${commandLabel}\`. Use \`${PREFIX}help\` to see available commands.`,
        ),
      );
      return;
    }

    try {
      await command.execute({ message, args: parsed.args });
    } catch (error) {
      await replyLoggedError(
        message,
        `Error running command ${command.name}:`,
        error,
        "Something went wrong running that command",
      );
    }
  });

  await client.login(config.token);
}

if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    const client = globalState.__dminiClient;
    if (!client) return;

    await destroyClient(client);
    globalState.__dminiClient = undefined;
  });
}
