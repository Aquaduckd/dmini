import json
from discord import Message

def exec(message: Message):

    with open('data/misc/authors.json', 'r') as f:
        authors = json.load(f)

    lines = ['Layout Creators:']
    lines.append('```')
    lines += list(sorted(authors.keys(), key=lambda x: x.lower()))
    lines.append('```')

    return '\n'.join(lines)