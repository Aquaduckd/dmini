import json

from discord import Message

from src import parser, authors, links
from src.admins import ADMINS

RESTRICTED = True

def exec(message: Message):
    name = parser.get_arg(message)
    id = message.author.id

    if authors.get_name(id).lower() not in ADMINS:
        return 'Unauthorized'

    if name in links.__LINKS:
        del links.__LINKS[name]
        with open('data/misc/links.json', 'w') as f:
            json.dump(links.__LINKS, f, indent=4)
        return f"Link removed for {name}."
    else:
        return f'{name} does not have a link'
