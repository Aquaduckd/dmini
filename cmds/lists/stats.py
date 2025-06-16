import json
import glob
from collections import Counter
from discord import Message

def exec(message: Message):
    files = glob.glob('layouts/*.json')

    with open('data/authors.json', 'r') as f:
        authors = json.load(f)

    with open('data/likes.json', 'r') as f:
        likes = json.load(f)

    with open('data/corpora.json', 'r') as f:
        corpora = json.load(f)

    most_liked = list(sorted(likes.items(), key=lambda x: len(x[1]), reverse=True))
    top_corpora = Counter(corpora.values()).most_common()

    lines = [
        '```',
        '--- CMINI STATS ---',
        f'Layouts: {len(files)}',
        f'Authors: {len(set(authors.values()))}',
        '',
        f'Most liked layouts:',
    ]

    for i in range(10):
        string = f'    {most_liked[i][0]:<15} ({len(likes[most_liked[i][0]])} likes)'
        lines.append(string)

    lines += [
        '',
        f'Top Corpora:',
    ]

    for i in range(3):
        string = f'    {top_corpora[i][0]:<15} ({top_corpora[i][1]} users)'
        lines.append(string)

    lines.append('```')

    return '\n'.join(lines)

def use():
    return 'stats'

def desc():
    return 'see the global stats'
