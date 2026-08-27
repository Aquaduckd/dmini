# dmini

A Discord bot for browsing, editing, and analyzing keyboard layouts from the [clemenpine](https://clemenpine.com) layout catalog. It renders layouts as images, runs [mana2](https://codeberg.org/zakkkk/mana2) analysis (SFB, rolls, finger usage, and more), and supports catalog edits when write access is configured.

Commands use the prefix `!dmini `.

## Prerequisites

- **Node.js 20+**
- **Go** — used to run mana2 for analysis (see `MANA2_ROOT` below)
- A **Discord bot** with the **Message Content Intent** enabled
- **`LAYOUTAPI_TOKEN`** — required for commands that create or edit layouts (`add`, `swap`, `gift`, etc.)

The mana2 checkout should live next to this repo (default: `../mana2`). Set `MANA2_ROOT` in `.env` if yours is elsewhere.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example env file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `DISCORD_TOKEN` | Yes | Discord bot token |
   | `LAYOUTAPI_TOKEN` | For writes | Bearer token for the layout API |
   | `LAYOUTAPI_URL` | No | API base URL (default: `https://clemenpine.com`) |
   | `MANA2_ROOT` | No | Path to mana2 (default: `../mana2`) |
   | `MANA2_CORPUS` | No | Default analysis corpus (default: `monkeyracer`) |

3. Create a bot in the [Discord Developer Portal](https://discord.com/developers/applications) and enable **Message Content Intent** under Bot settings.

## Running

Development (auto-restart on changes):

```bash
npm run dev
```

Production:

```bash
npm run build
npm start
```

## Using the bot

### Browse layouts

```text
!dmini layouts
!dmini layouts galileotime
!dmini layouts --search opal --sort likes
!dmini layout gallium
!dmini magic opal
```

`layout` shows a fingermap or heatmap image. `magic` lists a layout's magic rules.

### Analyze layouts

```text
!dmini analyze gallium
!dmini analyze opal --corpus reddit
!dmini analyze gallium --heatmap
!dmini percentiles gallium
!dmini examples sfb qwerty
!dmini examples stats
!dmini find ^the
```

`analyze` returns mana2 stats (bigrams, trigrams, finger usage) with percentile coloring when available. `percentiles` focuses on how a layout ranks against the corpus. `examples` shows real corpus n-grams behind a stat. `find` searches corpus words by regex.

Override the corpus per command with `--corpus <name>`, or set a default with `!dmini config corpus <name>`.

### Your settings

```text
!dmini config
!dmini config corpus monkeyracer
!dmini config render heatmap
!dmini config palette neon
!dmini config reset
```

Per-user settings are stored in `.dmini/user-config.json`. Render mode can also be overridden per command with `--fingermap` or `--heatmap` on `layout` and `analyze`.

### Edit layouts

Write commands need `LAYOUTAPI_TOKEN` and only work on layouts you own.

```text
!dmini add mylayout --board ortho
!dmini copy sturdy my-sturdy
!dmini swap mylayout sc ae
!dmini setboard mylayout --board stagger
!dmini addmagic mylayout
!dmini clearmagic mylayout
!dmini rename mylayout mylayout-v2
!dmini remove mylayout
```

`add` and `setboard` / `addmagic` take a key grid or rule list in a fenced code block in the same message. Board types: `ortho`, `stagger`, `angle`, `mini`.

### Social

```text
!dmini like gallium
!dmini unlike gallium
!dmini gift galileotime opal
!dmini gift accept galileotime
```

`gift` lets you offer a layout you own to another author; they accept with `gift accept`.

### Help

```text
!dmini help
!dmini help analyze
```

`help` lists all commands grouped by category. `help <command>` shows usage, notes, and examples for one command.

## Commands overview

| Group | Commands |
|-------|----------|
| General | `help` |
| Layouts | `layout`, `layouts`, `magic` |
| Analysis | `analyze`, `find`, `percentiles`, `examples` |
| Editing | `add`, `addmagic`, `copy`, `remove`, `rename`, `setboard`, `clearmagic`, `swap` |
| Social | `like`, `unlike`, `gift` |
| Settings | `config` |
| Admin | `debug` (bot admins only) |

## Admin

Admins are listed in `.dmini/admins.jsonc` (Discord user IDs). They can run `!dmini debug` subcommands for cache management, corpus downloads, and raw layout/analysis output.

## Adding a command

Define a command in `src/commands/` with `name`, `description`, `usage`, and optional `aliases`, `notes`, and `examples`. Register it in `src/command/router.ts`.
