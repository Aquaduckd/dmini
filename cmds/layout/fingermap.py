from discord import Message

from src import layout, memory, parser

RESTRICTED = False

def exec(message: Message):
    name = parser.get_arg(message)
    ll = memory.find(name.lower())
    return layout.fingermap_to_string(ll)

def use():
    return 'fingermap [layout_name]'

def desc():
    return 'view the fingermap of a layout'
