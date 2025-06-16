from discord import Message

from src import memory, parser

RESTRICTED = True

row_names = ['AD', 'AC', 'AB']

translations = {
    '`':  ['grave', 'asciitilde'],
    '1':  ['1',     'exclam'],
    '2':  ['2',     'at'],
    '3':  ['3',     'numbersign'],
    '4':  ['4',     'dollar'],
    '5':  ['5',     'percent'],
    '6':  ['6',     'asciicircum'],
    '7':  ['7',     'ampersand'],
    '8':  ['8',     'asterisk'],
    '9':  ['9',     'parenleft'],
    '0':  ['0',     'parenright'],

    '[':  ['bracketleft',  'braceleft'],
    ']':  ['bracketright', 'braceright'],
    '\\': ['backslash',    'bar'],
    '-':  ['minus',        'underscore'],
    '=':  ['equal',        'plus'],
    ';':  ['semicolon',    'colon'],
    '\'': ['apostrophe',   'quotedbl'],
    ',':  ['comma',        'less'],
    '.':  ['period',       'greater'],
    '/':  ['slash',        'question'],
}

def get_lowercase(key):
    item = translations.get(key)
    if item:
        return item[0]
    False

def get_uppercase(key):
    item = translations.get(key)
    if item:
        return item[1]
    False

def xkb_header(name):
    res = 'default partial alphanumeric_keys modifier_keys' + '\n'
    res += 'xkb_symbols "basic" {' + '\n\n'
    res += f'   name[Group1]= "{name}";' + '\n\n'
    return res

def xkb_format(key_id, lowercase, uppercase):
    return f'   key <{key_id}>\t {{[\t  {lowercase},  {uppercase}\t ]}};' + '\n'

def exec(message: Message):
    name = parser.get_arg(message)
    layout = memory.find(name.lower())

    if not layout:
        return f'Error: could not find layout `{name}`'
                                 
    xkb = xkb_header(layout.name)

    keys = layout.keys
                                 
    # Add number row
    xkb += xkb_format('TLDE', 'grave', 'asciitilde') # Tilde (`)
    for num, key in enumerate("1234567890-="):
        lowercase = get_lowercase(key) or key
        uppercase = get_uppercase(key) or key.upper()

        row_name = 'AE'
        key_number = '{:0>2}'.format(num + 1)
        xkb += xkb_format(row_name + key_number, lowercase, uppercase)
        
    # Other rows
    row = col = 0

    # It's too late to implement this in a better way, sorry
    # This also assumes ANSI enter key (\ above enter?)
    # since that's how qwerty.json is defined
    done_ad13 = False
    for i in range(len(row_names)):
        xkb += '\n'
        for key, props in keys.items():
            if props.row == row and props.col == col:
                lowercase = get_lowercase(key) or key
                uppercase = get_uppercase(key) or key.upper()

                row_name = row_names[row] if row < len(row_names) else '??'
                key_number = '{:0>2}'.format(col + 1)

                key_id = row_name + key_number

                if key_id == 'AD13' and not done_ad13:
                    key_id = 'BKSL'
                    col -= 1
                    done_ad13 = True

                # Add the key
                xkb += xkb_format(key_id, lowercase, uppercase)

                col += 1
                continue

        # Key not found, check next row
        row += 1; col = 0 
        
    return '```' + xkb + '};' + '```'

def use():
    return 'xkb [name]'

def desc():
    return 'generate an xkb symbol file for a layout'