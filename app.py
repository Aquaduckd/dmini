import glob
import discord
from discord import Message
from importlib import import_module

class Command:
    def __init__(self, func: any, use: str, desc: str):
        self.func = func
        self.use = use
        self.desc = desc

    def run(self, message: Message):
        return self.func(message)

class App:
    def __init__(self):
        self.reload_commands()
    
    async def run(self, command: str, message: Message):
        await message.channel.send(self.commands[command].run(message), reference=message)

    def reload_commands(self):
        self.commands: dict[str, Command] = {}
        for file in glob.glob(f"cmds/**/*.py", recursive=True):
            path = file.replace("/", ".").split(".")
            
            command_name = path[-2]
            mod = import_module(".".join(path[:-1]))

            if hasattr(mod, "exec"):
                self.commands[command_name] = Command(
                    mod.exec,
                    mod.use() if hasattr(mod, "use") else None,
                    mod.desc() if hasattr(mod, "desc") else None,
                )

def main():
    app = App()
    
    intents = discord.Intents.default()
    intents.message_content = True
    intents.members = True
    bot = discord.Client(intents=intents)

    @bot.event
    async def on_message(message: Message):
        if message.author.bot or not message.content:
            return
        
        args = message.content.split()
        if isinstance(message.channel, discord.channel.DMChannel):
            command = args[0].lower()
        elif args[0] in "!amini !bmini !cmini !dvormini !cnini".split():
            command = args[1].lower() if len(args) > 1 else None
        else:
            return
        
        if command in app.commands:
            await app.run(command, message)
        elif command:
            await message.channel.send(f"Error: {command} is not an available command", reference=message)
        else:
            await message.channel.send("Try `!cmini help`", reference=message)
    
    bot.run(open("token.txt", "r").read())

if __name__ == "__main__":
    main()