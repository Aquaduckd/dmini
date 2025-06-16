from discord import Message

from util import layout, memory, parser

def exec(message: Message):
    args = parser.get_args(message)

    ll = memory.find(args[0])
    if not ll:
        return f'Error: couldn\'t find any layout named `{args[0]}`'

    if not all(x in ll.keys for x in ''.join(args[1:])):
        return f'Error: cannot swap letters that aren\'t in the layout'

    for cycle in args[1:]:
        if len(set(cycle)) != len(cycle):
            return f'Error: cannot use duplicate letters in cycle command'

        cmap = dict(zip(cycle, cycle[1:] + cycle[0]))
        keymap = {k: ll.keys[k] for k in cycle}

        for key, val in cmap.items():
            ll.keys[key] = keymap[val]
    ll.keys = dict(sorted(ll.keys.items(), key=lambda k: (k[1].row, k[1].col)))
    name = ll.name

    if not memory.remove(name.lower(), id=message.author.id):
        return f'Error: you don\'t own the layout {name}'
    if not memory.add(ll):
        return 'Error: something went wrong re-adding the layout. This shouldn\'t happen, please yell at semi.'

    return layout.to_string(ll, id=message.author.id) + "Successfully updated!"

def use():
    return 'cycle! | swap! [layout_name] [chars]'

def desc():
    return 'cycle a layout\'s letters around and update the original layout'
