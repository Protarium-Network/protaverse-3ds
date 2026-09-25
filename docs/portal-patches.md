# Changes in Aquamarine-Portal

Everything else lives in `portal/`. These are the few edits in existing Portal files.

## 1. Install the middleware (required)

`Aquamarine-Portal/index.js`, after the pjax middleware and before the routes loop:

```js
// Protaverse 3DS (3DS Miiverse applet), see middleware/ctr.js
require('./middleware/ctr')(app);

for (const route of routes) {
    app.use(route.path, route.route)
}
```

It has to come after `auth` and the account-data middleware (it reads `req.account` and
`res.locals.language`) and after the pjax middleware (it reads `req.pjax`).

## 2. 3DS community banners (optional)

The 3DS community and post pages show `/img/banners-ctr/<community id>.jpg` (400x168) and hide
it when missing. To upload them from the admin panel, add a kind to the image upload route in
`routes/admin.js` (`POST /uploads/raw`):

```js
const kind = ['general','community_icon','community_banner','community_banner_3ds'].includes(req.query.kind) ? req.query.kind : 'general';
// ...
if (kind !== 'general') {
    // ...community lookup...
    if (kind === 'community_icon') {
        // ...
    } else if (kind === 'community_banner_3ds') {
        // top screen of the 3DS community page (views/ctr/pages/community.ejs)
        image.cover(400, 168).quality(90);
        target = path.join(CDN_ROOT, 'banners-ctr', `${communityId}.jpg`);
        mime = Jimp.MIME_JPEG;
        publicUrl = `/img/banners-ctr/${communityId}.jpg`;
        fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
    } else {
        // Wii U banner
    }
}
```

and the option in `views/admin/uploads.ejs`:

```html
<option value="community_banner_3ds">3DS community banner (400×168)</option>
```

## 3. 3DS drawings (required to post drawings)

The 3DS sends drawings as raw BMP (`cave.memo_getImageBmp`), not zlib-compressed like the
Wii U. In `shared_config/decoder.js`, `paintingProccess`, fall back to the raw buffer when
inflating fails:

```js
try {
    output = pako.inflate(paintingBuffer);
}
catch (err) {
    // 3DS memos (cave.memo_getImageBmp) arrive as raw, uncompressed BMP
    output = paintingBuffer;
}
```
