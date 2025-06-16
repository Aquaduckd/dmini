import random
from discord import Message

RESTRICTED = False

def exec(message: Message):
    return random.choice([
        'Yes', 'Count on it',
        'No doubt',
        'Absolutely', 'Very likely',
        'Maybe', 'Perhaps',
        'No', 'No chance', 'Unlikely',
        'Doubtful', 'Probably not'
    ])
