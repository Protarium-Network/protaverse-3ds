# Converts rverse2's PHP translation arrays (resources/lang/<lang>/*.php) to JSON,
# renaming Miiverse/rverse/Aquamarine to Protaverse.
import re, json, os, glob, sys

TOK = re.compile(r"""\s*(?:(//[^\n]*|/\*.*?\*/|\#[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(=>)|([\[\],])|(-?\d+(?:\.\d+)?)|(true|false|null))""", re.S)


def unquote(t):
    body = t[1:-1]
    if t[0] == '"':
        return json.loads('"' + body + '"')
    return re.sub(r"\\(['\\])", r"\1", body)


def parse(src):
    src = src.split('return', 1)[1].rsplit(';', 1)[0]
    toks, pos = [], 0
    while pos < len(src):
        m = TOK.match(src, pos)
        if not m:
            if src[pos:].strip() == '':
                break
            raise ValueError(src[pos:pos + 40])
        pos = m.end()
        if m.group(1):
            continue
        toks.append(m.group(0).strip())
    i = 0

    def val():
        nonlocal i
        t = toks[i]
        i += 1
        if t == '[':
            d, lst = {}, []
            while toks[i] != ']':
                v = val()
                if toks[i] == '=>':
                    i += 1
                    d[v] = val()
                else:
                    lst.append(v)
                if toks[i] == ',':
                    i += 1
            i += 1
            return d if d else lst
        if t[0] in "'\"":
            return unquote(t)
        return {'true': True, 'false': False, 'null': None}.get(t, t)

    return val()


def rename(o):
    if isinstance(o, dict):
        return {k: rename(v) for k, v in o.items()}
    if isinstance(o, list):
        return [rename(v) for v in o]
    if isinstance(o, str):
        return re.sub(r'(?i)\b(miiverse|rverse|aquamarine)\b', 'Protaverse', o)
    return o


base, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
for lang in sorted(os.listdir(base)):
    out = {}
    for f in sorted(glob.glob(f'{base}/{lang}/*.php')):
        try:
            out[os.path.basename(f)[:-4]] = rename(parse(open(f, encoding='utf-8').read()))
        except (ValueError, IndexError) as err:  # a few upstream files are not valid PHP
            print(f'  skipped {f}: {err}', file=sys.stderr)
    with open(f'{out_dir}/{lang}.json', 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(lang, sorted(out))
