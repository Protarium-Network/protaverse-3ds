# Protaverse 3DS

The Nintendo 3DS side of Protaverse: the 3DS Miiverse applet served from an
[Aquamarine](https://github.com/AquamarineMiiverseTeam) Portal, with Nintendo's original
3DS interface recoloured red and every page backed by the Portal's existing data.

The 3DS uses the same portal host as the Wii U. Your discovery server just has to return the
portal host as `n3ds_host`; the Portal then recognises the 3DS by its user agent and serves
the 3DS pages instead of the Wii U ones. Wii U and web visitors are not affected.

## What's in here

```
portal/                  files to copy into Aquamarine-Portal (same layout)
  middleware/ctr.js      3DS detection, 3DS view selection, translations
  routes/ctr.js          the Nintendo-shaped URLs the 3DS front-end calls
  views/ctr/             3DS pages (EJS, Nintendo markup)
  languages-3ds/         3DS strings, 12 languages complete (en fr es de it nl ja pl el bg pt ru)
  static/n3ds/           our additions (protaverse.css, toolbar.js); the Nintendo assets are generated
tools/
  build_n3ds.py          generates static/n3ds (CSS, olv.js bundle, images) from an rverse2 checkout
  convert_lang.py        converts rverse2's PHP translations to JSON
  i18n_build.js          completes languages-3ds from rverse2 + Portal strings + i18n_fill.json
docs/portal-patches.md   the small changes needed in the Portal itself
```

## Pages

Activity feed, communities (top, favorites, platform filter, search), community (3DS banner,
All/Popular, paging, favorite), post form (feeling, text or drawing, spoiler), post page with
Yeahs and comments, comment form, profiles (own, others, posts, following, followers, follow
button), notifications with the toolbar badge, error page. Other Portal pages (messages,
settings, account creation) keep the Wii U layout with a working 3DS toolbar.

## Install

1. Copy `portal/` over your Aquamarine-Portal directory.
2. Generate the Nintendo assets. They are not in this repository; `build_n3ds.py` takes them
   from [rverse2](https://github.com/rverseTeam/rverse2) and recolours them:
   ```
   git clone https://github.com/rverseTeam/rverse2
   pip install pillow
   python tools/build_n3ds.py rverse2/public <Aquamarine-Portal>/static/n3ds
   ```
3. Apply the Portal changes from [docs/portal-patches.md](docs/portal-patches.md)
   (two lines in `index.js`, plus optional 3DS banners and 3DS drawings).
4. Restart the Portal.

The 3DS router relays actions (posts, Yeahs, favorites) to the console API with the console's
own credentials. It expects the API on `http://127.0.0.1:8083`; override with `CTR_API_URL`.
`CTR_PORTAL_URL` defaults to `http://127.0.0.1:$PORT`.

## How it works

Nintendo's 3DS front-end (`olv.js`) decides what a page does from its URL and calls its own
endpoints (`/titles/:title/:community/new`, `/posts/:id/empathies`, `/check_update.json`...).
`routes/ctr.js` exposes that URL scheme and hands the work to the Portal's existing routes and
the API, so the 3DS shares posts, Yeahs, follows, favorites and notifications with the Wii U.

- Pages are loaded with `?_pjax=1`; only `#body` is swapped.
- Posts are submitted urlencoded and relayed to the API as multipart.
- Screenshots are resized for the 3DS on first request (`/img-ctr/screenshots/<id>.jpg`,
  400x240 max): full-size Wii U captures are too heavy for the applet's browser.
- The toolbar at the bottom of the 3DS screen is drawn by the applet itself; the page drives
  it through `cave.toolbar_*`. In a desktop browser `cave-emulation.js` only logs those calls.

### Theme

`build_n3ds.py` turns every saturated green/cyan/blue of Nintendo's CSS and images into
`#de3e3e`, keeping lightness. The platform tags keep their original colours (Wii U blue).
To change the colour, edit `RED_HUE` / `SAT_SCALE` and rerun it.

### Translations

Server-side strings come from `languages-3ds/<lang>.json` (account language), falling back to
English and then to the Portal's own language files. Texts written by `olv.js` itself (Yeah
buttons, "N people gave this a Yeah") are overridden per language by
`views/ctr/partials/locale.ejs`. To add or fix a language, edit `tools/i18n_fill.json` and run
`node tools/i18n_build.js <Aquamarine-Portal>`.

## Testing on a PC

Set your browser's user agent to a 3DS one, for example
`Mozilla/5.0 (Nintendo 3DS/5) AppleWebKit/532.7 (KHTML, like Gecko) NX/1.8.9 miiverse/8.1.prod.EU`,
with a Portal session, and open `/communities`. Use a window at least 768px wide or add a
viewport tag; the pages are 400px wide.

## License

AGPL-3.0, see [LICENSE](LICENSE). Parts adapted from rverse2 are under Apache-2.0
([LICENSES/Apache-2.0-rverse2.txt](LICENSES/Apache-2.0-rverse2.txt)); details in [NOTICE](NOTICE).
