# dmini

A Discord bot built with TypeScript and Vite.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example env file and add your bot token:

   ```bash
   cp .env.example .env
   ```

3. Create a bot in the [Discord Developer Portal](https://discord.com/developers/applications) and enable the **Message Content Intent** under Bot settings.

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Commands

Use `!dmini help` to list all commands, or `!dmini help <command>` for details on a specific one.

| Command | Description |
|---------|-------------|
| `!dmini help [command]` | Show available commands or help for one command |
| `!dmini layout <name>` | Show a keyboard layout |
| `!dmini analyze <name>` | Analyze a keyboard layout |
| `!dmini debug layout <name>` | Fetch raw JSON for a layout (debug) |
| `!dmini debug analyze <name>` | Run mana2 analysis and return raw JSON stats (debug) |

Adding a new command: define it in `src/commands/` with `name`, `description`, `usage`, and optional `aliases`/`examples`, then register it in `src/command/router.ts`.
