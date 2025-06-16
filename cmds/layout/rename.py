from discord import Message

from src import memory, parser
from src.consts import *

RESTRICTED = False

def exec(message: Message):
    args = parser.get_args(message)
    id = message.author.id

    old = args[0]
    new = args[1]


    if new[0] == '_':
        return 'Error: names cannot start with an underscore'

    if len(new) < 3:
        return 'Error: names must be at least 3 characters long'

    if not set(new).issubset(NAME_SET):
        disallowed = list(set(new).difference(NAME_SET))
        return f'Error: names cannot contain `{disallowed[0]}`'

    old_data = memory.get(old)
    new_data = memory.get(new)

    if not old_data:
        return f'Error: `{old}` does not exist'

    if new_data:
        return f'Error: `{new}` already exists'

    if not memory.remove(old, id=id):
        return f'Error: you don\'t own a layout named `{old}`'

    old_data.name = new
    memory.add(old_data)

    return f'`{old}` has been renamed to `{new}`'

def use():
    return 'rename [old_name] [new_name]'

def desc():
    return 'rename one of your layouts'