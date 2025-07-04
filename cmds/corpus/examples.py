import humanize
import re
from discord import Message
from collections import Counter
from itertools import islice

from src import corpora, parser
from src.consts import PUNCT

def exec(message: Message):
    part = parser.get_arg(message)
    pattern = re.compile(part.replace('.', '\.').replace('_', '.'))

    words = corpora.words(id=message.author.id)

    words = dict(islice(words.items(), 30_000))

    strip_string = ''
    if not any(x in PUNCT for x in part):
        strip_string = PUNCT
    else:
        strip_string = ''

    counts = Counter()
    for word, freq in words.items():
        if part.lower() == part:
            word = word.lower()

        if pattern.search(word):
            counts.update({word.strip(strip_string): freq})

    examples = []
    total = sum(counts.values())

    for (item, count) in counts.most_common(10):
        # total += count
        item = item.replace('`', '​`')
        examples.append(f'{item:<15} {"(" + str(count) + ")":>6}')

    if not examples:
        return f'Error: `{part}` does not appear anywhere in this corpus'

    perc = total / sum(words.values())

    res = [f'Examples of `{part}` in {corpora.get_corpus(message.author.id).upper()}:']
    res.append('```')
    
    res.append(f'{humanize.intcomma(total)} / {humanize.intcomma(sum(words.values()))} words ({perc:.3%})')
    res.append('')
    res += examples
    
    res.append('```')
    return '\n'.join(res)

def use():
    return 'examples [some_str]'

def desc():
    return 'find common examples of an ngram from MT-Quotes'