import random
from discord import Message

RESTRICTED = False

def exec(message: Message):
    if not message.guild:
        return "No dofs in here :("

    dofs = [emoji for emoji in message.guild.emojis
            if emoji.available
            and 'dof' in emoji.name.lower()]

    if not dofs:
        return "No dofs in here :("

    dof = random.choice(dofs)

    prefix = 'a' if dof.animated else ''

    return f'<{prefix}:{dof.name}:{dof.id}>'
