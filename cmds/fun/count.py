import os
import json
import time
import math
import random
from discord import Message

RESTRICTED = False

PATH = 'minigames/count.json'

NAMES = {
    -1: '-',
    1: '+',
}

def exec(message: Message):
    current_time = math.floor(time.time())
    id = str(message.author.id)

    if not os.path.exists(PATH):
        data = {
            'count': 0,
            'goal': 50,
            'min_delay': 1,
            'max_delay': 10,

            'teams': {},
            'times': {},
            'delays': {},
        }

    else:
        with open(PATH, 'r') as f:
            data = json.load(f)

    if not id in data['teams']:
        weight = sum(data['teams'].values())
        
        if weight > 0:
            team = -1
        elif weight < 0:
            team = 1
        else:
            team = random.choice([-1, 1])

        data['teams'][id] = team
        data['times'][id] = 0 
        data['delays'][id] = 0

        reply = (
            f'Welcome! You are on team `{NAMES[team]}`. '
            f'Your goal is to get the counter to `{data["goal"] * team}`.'
        )

    elif current_time - data['times'][id] < data['delays'][id]:
        data['count'] -= data['teams'][id] * 5

        time_left = data['delays'][id] - (current_time - data['times'][id]) 

        reply = (
            f'You need to wait {time_left} more seconds! '
            f'Your team lost 5 points. '
            f'The count is now at `{data["count"]}`.'
        )

    elif current_time - data['times'][id] == data['delays'][id]:
        data['count'] += data['teams'][id] * 5
        
        reply = (
            f'You waited exactly {data["delays"][id]} seconds! '
            f'You earned 5 points for your team. '
            f'The count is now at `{data["count"]}`.'
        )

        data['delays'][id] = 0

    else:
        inc = data['teams'][id]
        data['count'] += inc

        if inc == 1:
            change = 'increased'
        else:
            change = 'decreased'

        delay = random.randrange(data['min_delay'], data['max_delay'])

        data['times'][id] = current_time
        data['delays'][id] = delay
        
        reply = (
            f'You {change} the count to `{data["count"]}`. '
            f'You must wait `{delay}` seconds before counting again.'
        )

    if abs(data['count']) >= data['goal']:
        team = math.copysign(1, data['count'])

        reply = (
            f'GAME OVER! The count has reached `{data["count"]}`. '
            f'Team `{NAMES[team]}` wins! '
            f'The game will now reset.'
        )

        os.remove(PATH)

    else:
        with open(PATH, 'w') as f:
            f.write(json.dumps(data, indent=4))

    return reply