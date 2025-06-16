from discord import Message

from src import memory, parser, authors
from src.admins import ADMINS

RESTRICTED = False

def exec(message: Message):
    args = parser.get_args(message)
    name = args[0].lower()
    target = args[1].lower()
    ll = memory.get(name)
    if not ll:
        return f'{name} not found'

    user = message.author.id
    user_name = authors.get_name(user).lower()
    # Check current owner
    if user_name in ADMINS:
        # See if the target is an ID
        try:
            temp_name = authors.get_name(int(target))
            # No matching name
            if temp_name == "unknown":
                return f'Error: invalid ID {target}'
        # Not a valid ID, check if a valid name
        except ValueError:
            temp_id = authors.get_id(target)
            temp_name = authors.get_name(temp_id).lower()
            # Name we have doesn't match
            if temp_name != target:
                return f'Error: invalid name {target}'
        # Valid ID, we got a name back
        else:
            temp_id = target

        ll.user = temp_id
        memory.add(ll)
        return f'{name} has been assigned by {user_name} to {temp_name}'
    else:
        return f'Unauthorized'

def usage():
    return 'assign [LAYOUT] [AUTHOR]'

def desc():
    return 'assign your layout to a new author'