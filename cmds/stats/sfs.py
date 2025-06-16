from discord import Message

from util import corpora, memory, parser
from util.analyzer import TABLE

def exec(message: Message):
    name = parser.get_arg(message)
    ll = memory.find(name.lower())

    trigrams = corpora.ngrams(3, id=message.author.id)
    total = sum(trigrams.values())

    sfs = {}
    for gram, count in trigrams.items():
        gram = gram.lower()
        
        if len(set(gram)) != len(gram): # ignore repeats
            continue

        key = '-'.join([ll.keys[x].finger for x in gram if x in ll.keys])

        if key in TABLE and TABLE[key].startswith('dsfb'):
            first = gram[0]
            last = gram[-1]
            if (first, last) in sfs:
                sfs[(first, last)] += count
            else:
                sfs[(first, last)] = count

    sfs = sorted(sfs.items(), key=lambda x: x[1], reverse=True)

    res = []
    for (first, last), count in sfs:
        res.append(f'{first + last:<5} {count / total:.3%}')

    return '\n'.join(['```', f'Top 10 {ll.name} SFS:'] + res[:10] + ['```'])

def use():
    return 'sfs [layout name]'

def desc():
    return 'see the worst sfs for a particular layout'
