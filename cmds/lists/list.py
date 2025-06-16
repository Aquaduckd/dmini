import json
import glob
from discord import Message

from util import authors, parser, memory

def exec(message: Message):
    arg = parser.get_arg(message)
    
    if arg:
        id = authors.get_id(arg)
        name = authors.get_name(id)
    else:
        id = message.author.id
        name = message.author.name

    if not id:
        return f'Error: user `{arg}` does not exist'

    lines = [f'{name}\'s layouts:']
    lines.append('```')

    layouts = []
    for file in glob.glob('layouts/*.json'):
        ll = memory.parse_file(file)

        if ll.user == id:
            layouts.append(ll.name)

    lines += list(sorted(layouts))
    lines.append('```')

    return '\n'.join(lines)


def use():
    return 'list [username]'

def desc():
    return 'see a list of a user\'s layouts'