import {
  Client,
  Events,
  GatewayIntentBits,
} from "discord.js";
import { config } from "./config.js";
import {
  getCommand,
  parseMessage,
  PREFIX,
  registerCommands,
  userCanRunCommand,
} from "./command/index.js";
import { errorEmbed, replyEmbed } from "./discord/embeds.js";
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
      GatewayIntentBits.MessageContent,
    ],
  });

  globalState.__dminiClient = client;

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const parsed = parseMessage(message.content, PREFIX);
    if (!parsed) return;

    const command = getCommand(parsed.name);
    if (
      !command ||
      !(await userCanRunCommand(command, message.author.id))
    ) {
      await replyEmbed(
        message,
        errorEmbed(
          `Unknown command: \`${PREFIX}${parsed.name}\`. Use \`${PREFIX}help\` to see available commands.`,
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
