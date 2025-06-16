from discord import Client, Guild
from typing import Iterable, TypeVar

_VT = TypeVar('_VT')

AKL_ID = 807843650717483049

LAYOUT_ROLES: list[str] = [
    'CTGAP',
    'Workman',
    'Taipo',
    'TypeHack',
    'SIND',
    'Steno',
    'Sertain',
    'Semimak',
    'RSTHD',
    'RSI Terminated',
    'QWERTY',
    'QGMLWY',
    'Other (self-made)',
    'Other',
    'Nerps',
    'Neo',
    'MTGAP',
    'MessagEase',
    'ISRT',
    'Halmak',
    'Hands Down',
    'FR-Godox',
    'Engram',
    'Dvorak',
    'Colemak Qi',
    'ColemaQ',
    'Colemak DHv',
    'Colemak DH',
    'Colemak',
    'boo'
    'BÉPO',
    'BEAKL',
    'ASETNIOP',
    'APT',
    'Canary',
    'Sturdy',
    'Nrts Haei',
    'Recurva',
]

class CaseInsensitiveDict(dict):
    @classmethod
    def from_iterable(cls, iterable: Iterable[tuple[str, _VT]]):
        return cls((k.lower(), i) for (k, i) in iterable)

    def __getitem__(self, key: str):
        return super().__getitem__(key.lower())

    def __contains__(self, key: str):
        return super().__contains__(key.lower())

def exec(bot: Client):
    guild: Guild = bot.get_guild(AKL_ID)
    if not guild:
        return 'Error: Cannot find akl server'

    roles = guild.roles
    role_counts: dict[str, int] = CaseInsensitiveDict.from_iterable((role.name, len(role.members)) for role in roles)
    layout_role_counts: list[tuple[str, int]] = [(layout_role, role_counts[layout_role])
                                                 for layout_role in LAYOUT_ROLES
                                                 if layout_role in role_counts]

    layout_role_counts.sort(key=lambda x: x[1], reverse=True)
    layout_role_counts = layout_role_counts[:20]

    res = ['```',
           '--- AKL STATS ---',
           'Layout role count:']
    res.extend(f'    {role_name:<15} ({count} users)' for (role_name, count) in layout_role_counts)
    res.append('```')
    return '\n'.join(res)
