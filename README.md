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

- `!dmini help [command]` — Show available commands or detailed help for one command (aliases: `commands`, `h`)

- `!dmini layout <name> [--heatmap|--fingermap]` — Show a keyboard layout (alias: `view`)
- `!dmini layouts [author] [--search QUERY] [--sort name|likes] [--limit N] [--page N]` — List layouts, optionally filtered by author or name
- `!dmini magic <name> [--limit N] [--page N]` — Show magic rules for a layout (alias: `magicrules`)

- `!dmini add <name> [--board <type>]` — Add a new keyboard layout to the catalog
- `!dmini addmagic <layout> [--append]` — Set or append magic rules on one of your layouts
- `!dmini clearmagic <layout>` — Remove all magic rules from one of your layouts
- `!dmini copy <layout> <copy-name>` — Copy a layout under a new name
- `!dmini remove <name>` — Delete one of your layouts from the catalog
- `!dmini rename <old-name> <new-name>` — Rename one of your layouts
- `!dmini setboard <name> [--board <type>]` — Set a layout's board type and finger assignments
- `!dmini swap <layout> <swap1> [swap2] ...` — Swap key positions on one of your layouts

- `!dmini gift <username> <layout>` — Offer one of your layouts to another author
- `!dmini gift accept <username> [layout]` — Accept a layout offered to you
- `!dmini like <layout>` — Like a layout
- `!dmini unlike <layout>` — Remove your like from a layout

- `!dmini analyze <name> [--corpus <name>] [--heatmap|--fingermap]` — Analyze a keyboard layout
- `!dmini examples <stat> <layout> [--limit N] [--page N] [--corpus NAME]` — Show corpus examples for a layout stat (alias: `ex`)
- `!dmini find <pattern> [--limit N] [--corpus NAME]` — Find corpus words matching a pattern
- `!dmini percentiles <name> [--corpus <name>]` — Show layout stat percentiles against the corpus

- `!dmini config [corpus|render|palette [value]]` — View or change your analysis settings

- `!dmini debug <subcommand> [args]` — Debug utilities for development (admin only)

`debug` takes the subcommands `layout <name>`, `analyze <name>`, `corpus [get <name>|get all]`, `cache [status|warm [corpus]|clear [layout]]` and `percentiles [corpus]`. Admins are listed in `.dmini/admins.jsonc`.

### Adding a command

Define it in `src/commands/` as a `Command` — `name`, `description`, `usage`, `group`, and optional `notes`/`aliases`/`examples`/`adminOnly` — then add it to the `COMMANDS` array in `src/command/router.ts`.

`group` is one of the sections in `COMMAND_GROUPS` (`src/command/types.ts`) and decides where the command appears in `!dmini help`. It is required, so a new command can't silently go unlisted.
