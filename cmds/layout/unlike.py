import json
from discord import Message

from util import memory, parser

RESTRICTED = False

def exec(message: Message):
    name = parser.get_arg(message)
    id = message.author.id

    ll = memory.find(name)

    with open('data/likes.json', 'r') as f:
        likes = json.load(f)

    if not ll.name in likes:
        likes[ll.name] = []

    if not id in likes[ll.name]:
        return 'You\'ve already unliked this layout'

    likes[ll.name].remove(id)

    with open('data/likes.json', 'w') as f:
        f.write(json.dumps(likes, indent=4))
        
    return f'You unliked {ll.name}. (Now at {len(likes[ll.name])} likes)'

def use():
    return 'unlike [layout name]'

def desc():
    return 'unlike a layout'