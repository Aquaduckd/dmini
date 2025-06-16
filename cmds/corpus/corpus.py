import glob
import json
from discord import Message

from util import parser

def exec(message: Message):
    arg = parser.get_arg(message).lower()

    corpora = [x[13:-1] for x in glob.glob('data/corpora/*/')]

    if not arg:
        return '\n'.join(['```', 'List of Corpora:'] + [f'- {x}' for x in list(sorted(corpora))] + ['```'])

    if not arg in corpora:
        return f'The corpus `{arg}` doesn\'t exist.'

    with open('data/misc/corpora.json', 'r') as f:
        prefs = json.load(f)

    prefs[str(message.author.id)] = arg

    with open('data/misc/corpora.json', 'w') as f:
        f.write(json.dumps(prefs, indent=4))

    return f'Your corpus preference has been changed to `{arg}`.'    

def use():
    return 'corpus [corpus_name]'

def desc():
    return 'set your preferred corpus'