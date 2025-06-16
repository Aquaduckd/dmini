from discord import Message

from src import layout, memory, parser
from src.keyboard import Layout

def exec(message: Message):
    args = parser.get_args(message)
    name = args[0]
    cycles = args[1:]

    ll = memory.find(name)
    if not ll:
        return f'Error: couldn\'t find any layout named `{name}`'

    try:
        modify(ll, cycles)
    except ValueError as e:
        return str(e)

    ll.name += ' (modified)'

    return layout.to_string(ll, id=message.author.id)

def use():
    return 'cycle | swap [layout_name] [chars]'

def desc():
    return 'cycle a layout\'s letters around'

def modify(ll: Layout, cycles: list[str]) -> None:
    if not all(x in ll.keys for x in ''.join(cycles)):
        raise ValueError('Error: cannot swap letters that aren\'t in the layout')

    for cycle in cycles:
        if len(set(cycle)) != len(cycle):
            raise ValueError('Error: cannot use duplicate letters in cycle command')

        cmap = dict(zip(cycle, cycle[1:] + cycle[0]))
        keymap = {k: ll.keys[k] for k in cycle}

        for key, val in cmap.items():
            ll.keys[key] = keymap[val]
