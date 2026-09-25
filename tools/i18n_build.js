// Completes Aquamarine-Portal/languages-3ds/<lang>.json so every language has every string
// the 3DS views use (n3ds-work/ctr_keys.json), plus a `js` section for the texts olv.js
// writes itself (Yeah summary on post pages).
// Priority per key: i18n_fill.json (hand translations) > existing 3DS file > Portal language.
// Yeah button labels follow the Portal's wording when the Portal translated them, so the
// Wii U and 3DS say the same thing.
// usage: node tools/i18n_build.js <Aquamarine-Portal dir>
const fs = require('fs');
const path = require('path');

const portalDir = process.argv[2];
const keys = require('./ctr_keys.json');
const fill = require('./i18n_fill.json');
const LANGS = ['en', 'fr', 'es', 'de', 'it', 'nl', 'ja', 'pl', 'el', 'bg', 'pt', 'ru'];
const FEELINGS = { normal: 'default', happy: 'happy', like: 'like', surprised: 'surprised', frustrated: 'frustrated', puzzled: 'puzzled' };

const get = (obj, key) => key.split('.').reduce((o, part) => o && o[part], obj);
function set(obj, key, value) {
    const parts = key.split('.');
    let o = obj;
    for (const part of parts.slice(0, -1)) o = (o[part] = typeof o[part] === 'object' && o[part] ? o[part] : {});
    o[parts[parts.length - 1]] = value;
}
const load = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;

const portalEn = load(path.join(portalDir, 'static/languages/en.json'));
for (const lang of LANGS) {
    const file = path.join(portalDir, 'languages-3ds', lang + '.json');
    const out = load(file) || {};
    const portal = load(path.join(portalDir, 'static/languages', lang + '.json'));
    const manual = fill[lang] || {};
    const miitoo = portal && get(portal, 'aqua.portal.miitoo');
    const portalTranslatedYeah = lang !== 'en' && miitoo && miitoo['default.delete'] !== get(portalEn, 'aqua.portal.miitoo')['default.delete'];

    for (const key of keys) {
        if (typeof get(out, key) !== 'string' && portal && typeof get(portal, key) === 'string') set(out, key, get(portal, key));
    }
    if (portalTranslatedYeah) {
        for (const feeling of Object.keys(FEELINGS)) set(out, 'post.feelings.' + feeling, miitoo[FEELINGS[feeling]]);
        set(out, 'post.feelings.remove', miitoo['default.delete']);
    }
    for (const key of Object.keys(manual).filter(k => !k.startsWith('js.'))) set(out, key, manual[key]);

    // Yeah summary shown by olv.js on post pages: [plural, singular]
    const viewer = miitoo && miitoo.viewer;
    const portalViewer = lang !== 'en' && viewer && viewer.added !== get(portalEn, 'aqua.portal.miitoo.viewer.added');
    const js = {};
    if (portalViewer) {
        js.n_added = [viewer.default_people, viewer.default_person];
        js.you_added = viewer.added;
        js.you_and_n_added = [viewer.added_people, viewer.added_person];
    }
    for (const key of Object.keys(manual).filter(k => k.startsWith('js.'))) js[key.slice(3)] = manual[key];
    if (Object.keys(js).length) out.js = js; else delete out.js;

    const missing = keys.filter(key => typeof get(out, key) !== 'string');
    fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
    console.log(lang.padEnd(3), 'missing:', missing.length, missing.join(' '), '| js:', Object.keys(js).join(',') || '-',
        '| yeah:', get(out, 'post.feelings.normal'), '/', get(out, 'post.feelings.remove'));
}
