import json
import glob
import random
from discord import Message

from util import layout, memory

RESTRICTED = False

def exec(message: Message):
    files = glob.glob('data/layouts/*.json')
    file = random.choice(files)

    ll = memory.parse_file(file)
    return layout.to_string(ll, id=message.author.id)
