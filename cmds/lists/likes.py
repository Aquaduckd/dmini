import json
from discord import Message

def exec(message: Message):
    id = message.author.id
    name = message.author.name

    with open('data/likes.json', 'r') as f:
        likes: dict[str, list[int]] = json.load(f)

    lines = []
    for layout, ids in sorted(likes.items(), key=lambda l: l[0].lower()):
        if id in ids:
            lines.append(f' - {layout}')

    return '\n'.join(['```', f'{name}\'s liked layouts:'] + lines + ['```'])



def use():
    return 'likes'

def desc():
    return 'see a list of your liked layouts'
