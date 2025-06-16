import json

from discord import Message

from src import parser, authors
from src.admins import ADMINS

RESTRICTED = True

def exec(message: Message):
    if authors.get_name(message.author.id).lower() not in ADMINS:
        return 'Unauthorized'

    args = parser.get_args(message)
    if args != []:
        match args:
            case ['add', name]:
                name = name.lower()
                if name in ADMINS:
                    return f'{name} is already an admin'
                ADMINS.append(name)
                with open('admins.py', 'w') as f:
                    f.write(f'ADMINS = {ADMINS}')

                return f'Added {name} to admins'
            case ['remove', name]:
                name = name.lower()
                if name not in ADMINS:
                    return f'{name} is not an admin'
                
                ADMINS.remove(name)
                with open('admins.py', 'w') as f:
                    f.write(f'ADMINS = {ADMINS}')
                return f'Removed {name} from admins'
            case ['add' | 'remove']:
                return 'Missing username'
            case _:
                return f'Unsupported command: {args}'
    return f'Admins: {", ".join(ADMINS)}'