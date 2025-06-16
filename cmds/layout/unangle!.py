from discord import Message

from util import layout, memory, parser
from core.keyboard import Layout

RESTRICTED = False

def exec(message: Message):
    name = parser.get_arg(message)
    ll = memory.find(name.lower())

    if not ll:
        return f'Error: couldn\'t find any layout named `{name}`'

    try:
        modify(ll)
    except ValueError as e:
        return str(e)

    if not memory.remove(name.lower(), id=message.author.id):
        return f'Error: you don\'t own the layout {name}'
    if not memory.add(ll):
        return 'Error: something went wrong re-adding the layout. This shouldn\'t happen, please yell at ddn.'

    return layout.to_string(ll, id=message.author.id) + "Successfully updated!"

def modify(ll: Layout) -> None:
    if ll.board == 'angle':
        ll.board = 'ortho'
        for key in ll.keys.values():
            if key.row != 2:
                continue
            col = key.col
            if col >= 5:
                continue
            if col == 4:
                key.col = 0
                key.finger = 'LP'
            else:
                key.col += 1


def use():
    return 'unangle [layout_name]'

def desc():
    return 'unangle mod a layout and update the original layout'
