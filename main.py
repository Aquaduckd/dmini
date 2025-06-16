#!/usr/bin/env python

import glob
import logging
import discord
from importlib import import_module

from src.consts import TRIGGERS
from src import authors
from src.admins import ADMINS

CMINI_CHANNEL = 1063291226243207268

commands = {}
for file in glob.glob("cmds/**/*.py", recursive=True):
    path = file.replace("/", ".").split(".")
    
    commands[path[-2]] = ".".join(path[1:-1])

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = discord.Client(intents=intents)

logger = logging.getLogger('discord')

#### MAINTENANCE MODE ####
maintenance_mode = False

def maintenance_check(mode, message):
    if mode and authors.get_name(message.author.id).lower() in ADMINS:
        return True
    elif not mode:
        return True
    return False


@bot.event
async def on_ready():
    logger.info(f'Logged in as {bot.user}')

@bot.event
async def on_message(message: discord.Message):
    args = message.content.split()

    # Is in a DM?
    is_dm = isinstance(message.channel, discord.channel.DMChannel)

    # Restricted command?
    restricted = message.channel.id != CMINI_CHANNEL and not is_dm

    # Ignore other bots
    if message.author.bot:
        return

    # Empty message
    if not args:
        return

    # Get command
    if is_dm:
        command = args[0].lower()
    else:
        # Check triggers
        if args[0] not in TRIGGERS:
            return

        # Get command if any
        if len(args) > 1:
            command = args[1].lower()
        else:
            command = None

    logger.info(f'{message.author.name}: {message.content}')

    global maintenance_mode

    # Make these commands DM-only regardless of channel
    if command in ["xkb"]:
        restricted = True

    # Trigger only
    if not command:
        reply = 'Try `!cmini help`'
    elif command in ["gh", "github"]:
        reply = "<https://github.com/Apsu/cmini>"
    elif command == "akl":
        mod = import_module('cmds.akl')
        reply = mod.exec(bot)
    elif command == "member":
        mod = import_module('cmds.member')
        reply = mod.exec(message, bot)
    elif command in ["maintenance", "1984"]:
        mod = import_module('cmds.maintenance')
        mode, reply = mod.exec(message, maintenance_mode)
        if mode != None:
            maintenance_mode = mode

    # Check commands
    elif command in commands and maintenance_check(maintenance_mode, message):
        mod = import_module(f'cmds.{commands[command]}')
        reply = mod.exec(message)

        if restricted and (mod.RESTRICTED if hasattr(mod, 'RESTRICTED') else True):
            channel = await bot.create_dm(message.author)
            await channel.send(reply)
            return
    # Command not found
    else:
        reply = f'Error: {command} is not an available command'

    await message.channel.send(reply, reference=message)


def main():
    with open('token.txt', 'r') as f:
        token = f.read()

    bot.run(token)

if __name__ == '__main__':
    main()