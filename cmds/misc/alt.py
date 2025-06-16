import operator

from typing import Dict, List, Tuple
from itertools import product, pairwise

from discord import Message
from util import parser, authors, memory
from util.admins import ADMINS

RESTRICTED = False

class FingerMap:
    def __init__(self, fmap: List[List[str]]):
        self.fmap = fmap

    def __getitem__(self, index: Tuple[int, int]) -> str:
        row, col = index
        return self.fmap[row][col]

def parse(word: str, layout: Dict[str, Tuple], fingermap: FingerMap) -> List[str]:
    options = [fingermap[layout[char]] for char in word]
    columns = [layout[char][1] for char in word]
    defaults = [option[0] for option in options]
    cpairs = list(pairwise(columns))
    wpairs = list(pairwise(word))

    f = lambda x: "prmitTIMRPP".index(x)
    eq = lambda x: operator.eq(*x[0]) and not operator.eq(*x[1])

    # def cross(x, y):
    #     fdir = f(x[0]) >= f(x[1])
    #     cdir = y[0] >= y[1]
    #     if not fdir ^ cdir:
    #         return 0
    #     else:
    #         return abs(y[1] - y[0])



    cross = lambda x, y: f(x[1]) > f(x[0]) ^ y[1] > y[0]
    def cross(x, y):
        if y[1] > y[0] and f(x[1]) < f(x[0]):
            return True
        elif y[1] < y[0] and f(x[1]) > f(x[0]):
            return True
        else:
            return False
    cross = lambda x, y: \
        (y[1] > y[0] and f(x[1]) < f(x[0])) or \
        (y[1] < y[0] and f(x[1]) > f(x[0]))
    dist = lambda x: operator.eq(*x)
    eq = lambda x, y: operator.eq(*x) and not operator.eq(*y)

    def dist(x, y):
        return abs(abs(f(x[1]) - f(x[0])) - abs(y[1] - y[0]))
    def score(option: List[str]) -> Tuple[int, int, int]:
        opairs = list(pairwise(option))
        # print(opairs, cpairs, [(f(op[0]), f(op[1])) for op in opairs])
        # sfb_score = sum(map(eq, zip(opairs, wpairs)))
        sfb_score = sum(map(eq, opairs, wpairs))
        unique_score = len(set(zip(option, word)))
        dist_score = sum(map(dist, opairs, cpairs))
        # default_score = sum(map(dist, zip(option, defaults)))
        cross_score = sum(map(cross, opairs, cpairs))
        return sfb_score, cross_score, 0

    predictions = sorted([(option, score(option))
        for option in product(*options)
        ], key=lambda k: (k[1][0], k[1][1], k[1][2])
    )

    return predictions[0]

def exec(message: Message):
    user = message.author.id
    user_name = authors.get_name(user).lower()
    # Check current user
    # if user_name not in ADMINS:
        # return 'Unauthorized'

    args = parser.get_args(message)

    if len(args) < 2:
        return "Usage: alt <layout> <word>"

    name, word = args
    ll = memory.find(name.lower())
    if not ll:
        return f"Could not find layout: {name}"

    layout = {
        k:(v.row,v.col + 1 if v.row == 2 else v.col)
        for k, v in ll.keys.items()
    }

    fingermap = FingerMap([
        # q   w    e    r    t    y    u    i     o    p    [   ]   \
        ["p","rp","mr","im","im","IM","IM","MR","RM","PR","P","P","P"],
        # a   s    d    f    g   h    j    k    l   ;   '
        ["p","rm","mi","im","i","IM","IM","MR","R","P","P"],
        #    z   x    c    v    b    n   m    ,    .   /
        ["","r","mr","im","im","Ii","I","IM","MR","R","P"],
        # thumb alpha
        ["T"]
    ])

    fingernames = dict(zip(
        "prmitTIMRP", [f"L{f}" for f in "PRMIT"] + [f"R{f}" for f in "TIMRP"]
    ))

    # Filter characters from word that aren't in layout
    word = ''.join(filter(lambda c: c in layout, word.lower()))
    if len(word) > 15:
        return "Max word length: 15"

    alts, scores = parse(word, layout, fingermap)
    # alts = parse(word, layout, fingermap)
    sfb, cross, default = scores
    # return '```' + '\n'.join(' '.join([fingernames[o] for o in alt[0]]) + ''.join(f" {c}" for c in alt[1]) for alt in alts) + '```'

    return '```' + f"Alt fingering suggestion for '{word}' ({name})\n" + \
        ' '.join([fingernames[o] for o in alts]) + "\n" + \
        ''.join([f"{c:3}" for c in word]) + "\n" + \
        ' '.join([fingernames[fingermap[layout[c]][0]] for c in word]) + " (traditional)\n" + \
        f"SFB: {sfb} / {sfb/len(word):.2%}\n" \
        f"Crossovers: {cross}\n" \
        f"Unique: {default} / {default/len(word):.2%}\n" \
    + '```'
