from discord import Message

from src import corpora, memory, parser

def exec(message: Message):
    name = parser.get_arg(message)
    ll = memory.find(name.lower())

    bigrams = corpora.ngrams(2, id=message.author.id)
    total = sum(bigrams.values())

    sfbs = {}
    sfb_total = 0
    for gram, count in bigrams.items():
        gram = gram.lower()
        if len(set(gram)) != len(gram): # ignore repeats
            continue

        fingers = [ll.keys[x].finger for x in gram if x in ll.keys]

        if len(set(fingers)) != len(fingers):
            sfbs[gram] = sfbs.get(gram, 0) + count
            sfb_total += count

    sfbs = sorted(sfbs.items(), key=lambda x: x[1], reverse=True)

    return '\n'.join(['```', f'Top 10 {ll.name} SFBs:'] +
                     [f'{gram:<6} {count / total:.3%}' for (gram, count), i in zip(sfbs, range(10))] +
                     [f'Total: {sfb_total / total:.3%}', '```'])

def use():
    return 'sfbs [layout name]'

def desc():
    return 'see the worst sfbs for a particular layout'
