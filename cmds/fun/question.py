import json
import requests
from discord import Message

RESTRICTED = False

def exec(message: Message):
    file = 'https://story-shack-cdn-v2.glitch.me/generators/random-question-generator'

    req = requests.get(file)
    res = json.loads(req.text)

    return res['data']['name']