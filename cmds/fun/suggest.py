from discord import Message

from util import parser

RESTRICTED = False

def exec(message: Message):
    suggestion = parser.get_arg(message)

    with open('suggestions.txt', 'a') as f:
        f.write(f'\n{message.author.name}: {suggestion}')

    return 'Received :)'

def use():
    return 'suggest [message]'

def desc():
    return 'send me a suggestion for how to improve cmini :)'