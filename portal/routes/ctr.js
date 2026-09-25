// 3DS applet routes. Nintendo's 3DS front-end (static/n3ds, olv.js) picks each page's
// behaviour from its URL and calls Nintendo-shaped endpoints, so this router exposes
// those URLs and hands the work to the existing Portal routes and API endpoints.
// Mounted only for the 3DS user agent (see index.js).
const express = require('express');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const route = express.Router();

const db_con = require("../../shared_config/database_con");

const titles = require('./ui/menu/titles');
const communities = require('./ui/menu/communities');
const notifications = require('./ui/menu/notifications');
const activityFeed = require('./ui/menu/activity_feed');
const users = require('./ui/menu/users');

// where the console API and this Portal listen (requests are relayed with the console's credentials)
const API = process.env.CTR_API_URL || 'http://127.0.0.1:8083';
const PORTAL = process.env.CTR_PORTAL_URL || `http://127.0.0.1:${process.env.PORT}`;

// Re-issue a console request against another local endpoint with the same credentials.
async function forward(req, url, body) {
    const headers = {};
    for (const name of ['x-nintendo-servicetoken', 'x-nintendo-parampack', 'user-agent', 'cookie']) {
        if (req.get(name)) headers[name] = req.get(name);
    }
    if (body && !(body instanceof FormData)) headers['content-type'] = 'application/x-www-form-urlencoded';
    return fetch(url, { method: 'POST', headers, body, redirect: 'manual' });
}

const ok = (res) => res.json({ success: 1 });
const fail = (res, status) => res.status(status || 500).json({ success: 0, errors: [{ error_code: 1219999, message: '' }] });

// hand a request to another router under a different path
function delegate(router, url, query) {
    return (req, res, next) => {
        req.url = typeof url === 'function' ? url(req) : url;
        Object.assign(req.query, typeof query === 'function' ? query(req) : query);
        router(req, res, next);
    };
}

// ---- pages ----
route.get('/', delegate(activityFeed, '/'));
route.get('/my/latest_following_related_profile_posts', (req, res) => res.send(''));
route.get('/titles/show', (req, res) => res.redirect('/communities'));
route.get('/communities', delegate(titles, '/show'));
route.get('/communities/favorites', delegate(titles, '/favorites'));
route.get('/communities/categories/:platform', delegate(titles, '/communities', req => ({ platform: req.params.platform })));
route.get('/titles/search', delegate(titles, '/search', req => ({ q: req.query.query || '' })));
route.get('/news/my_news', delegate(notifications, '/'));
route.get('/titles/:title_id/:community_id(\\d+)/:kind(new|hot)?', delegate(communities,
    req => '/' + req.params.community_id,
    req => (req.params.kind === 'hot' ? { type: 'popular' } : {})));

route.get('/titles/:title_id/:community_id(\\d+)/post', async (req, res, next) => {
    try {
        const community = await db_con.env_db('communities').where({ id: req.params.community_id }).first();
        if (!community) return next();
        res.render('ctr/post_form', { account: req.account, community });
    } catch (err) { next(err); }
});

route.get('/posts/:post_id(\\d+)/reply', async (req, res, next) => {
    try {
        const post = await db_con.env_db('posts').where({ id: req.params.post_id }).whereNot({ moderated: 1 }).first();
        if (!post) return next();
        const community = await db_con.env_db('communities').where({ id: post.community_id }).first();
        res.render('ctr/reply_form', { account: req.account, post, community: community || { id: post.community_id, name: '' } });
    } catch (err) { next(err); }
});

// ---- posting (the Nintendo forms submit natively, urlencoded) ----
route.post('/posts', express.urlencoded({ extended: false, limit: '1mb' }), async (req, res, next) => {
    try {
        const communityId = String(req.body.olive_community_id || '');
        const form = new FormData();
        form.append('community_id', communityId);
        form.append('feeling_id', String(req.body.feeling_id || 0));
        form.append('is_spoiler', req.body.is_spoiler == 1 ? '1' : '0');
        if (req.body._post_type === 'painting' && req.body.painting) form.append('painting', req.body.painting);
        else form.append('body', String(req.body.body || ''));

        const apiRes = await forward(req, `${API}/v1/posts`, form);
        if (!apiRes.ok) console.error('[CTR] post rejected by the API: %d', apiRes.status);
        res.redirect(303, `/titles/${communityId}/${communityId}`);
    } catch (err) { next(err); }
});

// ---- JSON actions used by olv.js (it expects {success: 1}) ----
route.post('/posts/:post_id(\\d+)/:action(empathies|empathies.delete)', async (req, res) => {
    try {
        const r = await forward(req, `${API}/v1/posts/${req.params.post_id}/empathies`);
        r.ok ? ok(res) : fail(res, r.status);
    } catch (err) { fail(res); }
});

route.post('/replies/:reply_id(\\d+)/:action(empathies|empathies.delete)', async (req, res) => {
    try {
        const reply = await db_con.env_db('replies').where({ id: req.params.reply_id }).first();
        if (!reply) return fail(res, 404);
        const r = await forward(req, `${PORTAL}/posts/${reply.post_id}/comments/${reply.id}/empathy`);
        r.status < 400 ? ok(res) : fail(res, r.status);
    } catch (err) { fail(res); }
});

route.post('/titles/:title_id/:community_id(\\d+)/:action(favorite|unfavorite).json', async (req, res) => {
    try {
        const r = await forward(req, `${API}/v1/communities/${req.params.community_id}.${req.params.action}`);
        // 400 = already favorited, which is the state the button asked for
        r.ok || r.status === 400 ? ok(res) : fail(res, r.status);
    } catch (err) { fail(res); }
});

route.post('/users/:nnid/:action(follow|unfollow).json', async (req, res) => {
    try {
        const r = await forward(req, `${PORTAL}/users/${encodeURIComponent(req.params.nnid)}/${req.params.action}`);
        r.status < 400 ? ok(res) : fail(res, r.status);
    } catch (err) { fail(res); }
});

// Polled by olv.js for the toolbar badge. The auth middleware skips any path containing
// "js" (so ".json"), hence the account is looked up from the 3DS token here.
route.get('/check_update.json', async (req, res) => {
    try {
        const token = String(req.get('x-nintendo-servicetoken') || '').trim();
        const account = token && await db_con.account_db('accounts').where('3ds_service_token', token).first();
        const unread = account ? await db_con.env_db('notifications').where({ account_id: account.id, read: 0 }).count({ count: 'id' }).first() : null;
        res.json({
            success: 1,
            news: { unread_count: Number(unread && unread.count) || 0 },
            admin_message: { unread_count: 0 },
            mission: { unread_count: 0 }
        });
    } catch (err) { fail(res); }
});

// Screenshots resized for the 3DS: Wii U captures (800x450, ~100 KB) are too heavy for the
// applet's browser, which drops images once several are on a page. Generated on first
// request into CDN_Files/img/screenshots-ctr and regenerated if the original changes.
const SCREENSHOTS = path.join(__dirname, '../../CDN_Files/img/screenshots');
const SCREENSHOTS_CTR = path.join(__dirname, '../../CDN_Files/img/screenshots-ctr');
// ([.] not \\. : Express 4's path-to-regexp escapes dots itself)
route.get('/img-ctr/screenshots/:file([0-9]+[.]jpg)', async (req, res, next) => {
    try {
        const source = path.join(SCREENSHOTS, req.params.file);
        const target = path.join(SCREENSHOTS_CTR, req.params.file);
        if (!fs.existsSync(source)) return res.sendStatus(404);
        if (!fs.existsSync(target) || fs.statSync(target).mtimeMs < fs.statSync(source).mtimeMs) {
            const image = await Jimp.read(source);
            image.scaleToFit(400, 240).quality(80);
            fs.mkdirSync(SCREENSHOTS_CTR, { recursive: true });
            const temp = `${target}.${process.pid}.tmp`;
            fs.writeFileSync(temp, await image.getBufferAsync(Jimp.MIME_JPEG));
            fs.renameSync(temp, target);
        }
        res.sendFile(target, { maxAge: '7d' });
    } catch (err) { next(err); }
});

// olv.js bookkeeping calls we have nothing to store for
route.get('/local_list.json', (req, res) => ok(res));
route.post(['/settings/struct_post', '/settings/tutorial_post', '/settings/played_title_ids', '/settings/miiverse_info_post'], (req, res) => ok(res));

module.exports = route;
