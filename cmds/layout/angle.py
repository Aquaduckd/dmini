from discord import Message

from src import layout, memory, parser
from src.keyboard import Layout

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

    ll.name += ' (angle modded)'

    return layout.to_string(ll, id=message.author.id)


def modify(ll: Layout) -> None:
    if ll.board == 'mini':
        raise ValueError('Error: cannot angle mod mini layouts')

    if ll.board != 'angle':
        for key in ll.keys.values():
            if key.row != 2:
                continue
            col = key.col
            if col >= 5:
                continue
            if col == 0:
                key.col = 4
                key.finger = 'LI'
            else:
                key.col -= 1

    ll.board = 'angle'

def use():
    return 'angle [layout_name]'

def desc():
    return 'view the angle modded version of a layout'