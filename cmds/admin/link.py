import json

from discord import Message

from util import parser, authors, links
from util.admins import ADMINS

RESTRICTED = True

def exec(message: Message):
    name, query = parser.get_args(message)[:2]
    id = message.author.id

    if authors.get_name(id).lower() not in ADMINS:
        return 'Unauthorized'

    if name not in links.__LINKS:
        links.__LINKS[name] = query
        with open('data/misc/links.json', 'w') as f:
            json.dump(links.__LINKS, f, indent=4)
        return f'Link added for {name}.'
    else:
        return f'{name} already has a link'