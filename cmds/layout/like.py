import json
from discord import Message

from util import memory, parser

RESTRICTED = False

def exec(message: Message):
    name = parser.get_arg(message)
    id = message.author.id

    ll = memory.find(name)

    if ll.name == 'QWERTY':
        return 'You can\'t like Qwerty :yellow_circle:'

    with open('data/misc/likes.json', 'r') as f:
        likes = json.load(f)

    if not ll.name in likes:
        likes[ll.name] = []

    if id in likes[ll.name]:
        return 'You\'ve already liked this layout'

    likes[ll.name].append(id)

    with open('data/misc/likes.json', 'w') as f:
        f.write(json.dumps(likes, indent=4))

    return f'You liked {ll.name}. (Now at {len(likes[ll.name])} likes)'

def use():
    return 'like [layout name]'

def desc():
    return 'like a layout'
