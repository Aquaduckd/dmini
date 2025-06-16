from discord import Message

from util import parser, authors
from util.admins import ADMINS

RESTRICTED = True

def exec(message: Message, mode):
    if authors.get_name(message.author.id).lower() not in ADMINS:
        return None, 'Unauthorized'

    args = parser.get_args(message)
    if args != []:
        match args[0].lower():
            case "on" | "enable" | "true":
                return True, 'Maintenance mode enabled'
            case "off" | "disable" | "false":
                return False, 'Maintenance mode disabled'
    return None, f'Maintenance mode: {mode}'