import json
from typing import Dict

from src.keyboard import Layout

with open('data/misc/table.json', 'r') as f:
    TABLE: Dict[str, str] = json.load(f)
DEFAULT_COUNTER: dict[str, float] = dict.fromkeys(set(TABLE.values()) | {'sfR', 'unknown'}, 0)

def use(ll: Layout, grams: Dict[str, str]):
    fingers = {}

    for gram, count in grams.items():
        gram = gram.lower()

        if gram not in ll.keys:
            continue

        finger = ll.keys[gram].finger

        if finger not in fingers:
            fingers[finger] = 0

        fingers[finger] += count

    total = sum(fingers.values())
    for finger in fingers:
        fingers[finger] /= total

    fingers['LH'] = sum(fingers[x] for x in fingers if x[0] in 'L')
    fingers['RH'] = sum(fingers[x] for x in fingers if x[0] in 'RT')

    return fingers


def sfb_bigram(ll: Layout, grams: Dict[str, int]):
    counts = 0
    valid_keys = set(ll.keys.keys())

    for gram, count in grams.items():
        gram = gram.lower()

        if any(char not in valid_keys for char in gram):
            continue

        if ' ' in gram or gram[0] == gram[1]:
            continue

        if ll.keys[gram[0]].finger == ll.keys[gram[1]].finger:
            counts += count

    return counts / sum(grams.values())


def trigrams(ll: Layout, grams: Dict[str, int]):
    counts = DEFAULT_COUNTER.copy()
    fingers = {x: ll.keys[x].finger for x in ll.keys}

    for gram, count in grams.items():
        gram = gram.lower()

        if ' ' in gram:
            continue

        if gram[0] == gram[1] or gram[1] == gram[2] or gram[0] == gram[2]:
            counts['sfR'] += count
            continue

        finger_combo = '-'.join(fingers[x] for x in gram if x in fingers)
        finger_combo = finger_combo.replace('TB', 'RT')
        gram_type = TABLE.get(finger_combo, 'unknown')

        counts[gram_type] += count

    total = sum(counts.values())
    for stat in counts:
        counts[stat] /= total

    return counts
