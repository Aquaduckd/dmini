import json

CORPUS = 'mt-quotes'
NGRAMS = ['monograms', 'bigrams', 'trigrams']

LOADED: dict[str, dict] = {}

def load_json(path: str) -> dict:
    if path in LOADED:
        return LOADED[path]
    with open(path, 'r', encoding='utf-8') as f:
        d: dict = json.load(f)
        LOADED[path] = d
        return d

def ngrams(n: int, *, id: int = 0):
    file = get_corpus(id)
    path = f'data/corpora/{file}/{NGRAMS[n - 1]}.json'
    grams = load_json(path)
    return grams

def monograms():
    return ngrams(1)

def bigrams():
    return ngrams(2)

def trigrams():
    return ngrams(3)

def words(id: int = 0):
    file = get_corpus(id)
    path = f'data/corpora/{file}/words.json'
    words_ = load_json(path)
    return words_

def get_corpus(id: int):
    with open('data/misc/corpora.json', 'r') as f:
        prefs = json.load(f)

    if str(id) in prefs:
        file = prefs[str(id)]
    else:
        file = CORPUS

    return file
