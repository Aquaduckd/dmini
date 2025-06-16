from discord import Message

from src import memory, parser, authors
from src.admins import ADMINS

RESTRICTED = False

def exec(message: Message):
    arg = parser.get_arg(message)
    id = message.author.id

    if memory.remove(arg.lower(), id=id, admin=authors.get_name(message.author.id).lower() in ADMINS):
        return f'`{arg}` has been removed'
    else:
        return f'Error: you don\'t own any layout named `{arg}`'


def use():
    return 'remove [name]'

def desc():
    return 'delete one of your layouts'