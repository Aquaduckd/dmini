import os
import json
import random
from itertools import islice, permutations
from discord import Message

from src import corpora, parser

RESTRICTED = False

LETTERS = 'abcdefghijklmnopqrstuvwxyz'
DIR = 'minigames/guess'

def exec(message: Message):
    path = f'{DIR}/{message.channel.id}.json'

    if not os.path.exists(path):
        data = {
            'guess': '',
            'tries': 0
        }

    else:
        with open(path, 'r') as f:
            data = json.load(f)

    if data['guess']:
        arg = parser.get_arg(message)

        if not arg:
            return f'You need to make a guess! The column is `{data["guess"]}`'

        if arg[-1] == '%':
            arg = arg[:-1]

        attempt = float(arg) / 100
        data['tries'] += 1

        if abs(attempt - data['amount']) < .0001:
            reply = f'You got it in {data["tries"]} tries! `{data["guess"]}` has `{data["amount"]:.2%}` SFBs!'
            data['guess'] = ''

        elif data['amount'] > attempt:
            reply = 'higher'

        else:
            reply = 'lower'

    else:
        guess = ''.join(random.sample(LETTERS, k=3))
        perms = [''.join(x) for x in permutations(guess, 2)]

        # calc frequency
        words = corpora.words()
        words = dict(islice(words.items(), 30_000))

        count = 0
        for word, freq in words.items():
            if any(x in word for x in perms):
                count += freq

        freq = count / sum(words.values())

        data['guess'] = guess
        data['amount'] = freq
        data['tries'] = 0

        reply = f'What is the total SFB% of `{guess}`?'

    with open(path, 'w') as f:
        f.write(json.dumps(data, indent=4))

    
    return reply