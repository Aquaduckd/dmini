import random
from discord import Message

RESTRICTED = False

def exec(message: Message):
    if not message.guild:
        return "No cats in here :("

    cats = [emoji for emoji in message.guild.emojis
            if emoji.available
            and 'cat' in emoji.name.lower()]

    if not cats:
        return "No cats in here :("

    cat = random.choice(cats)

    prefix = 'a' if cat.animated else ''

    return f'<{prefix}:{cat.name}:{cat.id}>'
