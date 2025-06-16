from discord import Message
import json, os
from util import memory, authors, links
from util.admins import ADMINS

RESTRICTED = False

def exec(message: Message):
    name = message.author.name
    id = message.author.id
    try:
        for layout in owned_layouts(id):
            memory.remove(layout.lower(), id=id, admin=name.lower() in ADMINS)
            unlink(layout)
            likes(layout)
        authors(id)
        unlike(id)
        corpora(id)
        return 'Done'
    except Exception as e:
        return f'An error has occurred: {str(e)}'
    
def owned_layouts(id: int):
    path = 'layouts'
    owned = []
    for filename in os.listdir(path):
        file_path = os.path.join(path, filename)
        if os.path.isfile(file_path):
            with open(file_path, 'r') as file:
                data = json.load(file)
                if 'user' in data and data['user'] == id:
                    owned.append(os.path.splitext(filename)[0])
    return owned

def unlink(ll: str):
    links.__LINKS = {key: value for key, value in links.__LINKS.items() if key != ll}
    with open('data/misc/links.json', 'w') as f:
        json.dump(links.__LINKS, f, indent=4)

def authors(id: int):
    with open('data/misc/authors.json', 'r') as f:
        authors = json.load(f)
    authors = {name: user_id for name, user_id in authors.items() if user_id != id}
    with open('data/misc/authors.json', 'w') as f:
        json.dump(authors, f, indent=4)
        
def unlike(id: int):
    with open('data/misc/likes.json', 'r') as f:
        likes = json.load(f)
    for layout, ids in likes.items():
        likes[layout] = [x for x in ids if x != id]
    with open('data/misc/likes.json', 'w') as f:
        json.dump(likes, f, indent=4)

def likes(ll: str):
    with open('data/misc/likes.json', 'r') as f:
        likes = json.load(f)
    if ll in likes:
        del likes[ll]
    with open('data/misc/likes.json', 'w') as f:
        json.dump(likes, f, indent=4)

def corpora(id: int):
    with open('data/misc/corpora.json', 'r') as f:
        prefs = json.load(f)
    if str(id) in prefs:
        del prefs[str(id)]
        with open('data/misc/corpora.json', 'w') as f:
            json.dump(prefs, f, indent=4)