// Protaverse 3DS: serves the 3DS Miiverse applet from the Portal.
// For the 3DS user agent it renders views/ctr/<view> when a 3DS version exists, otherwise
// the Wii U view with a small toolbar script appended, and serves the Nintendo-shaped URLs
// from routes/ctr.js. Install after the auth, account-data and pjax middlewares:
//     require('./middleware/ctr')(app);
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ctrLanguages = {};
for (const file of fs.readdirSync(path.join(root, 'languages-3ds'))) {
    ctrLanguages[path.basename(file, '.json')] = require(path.join(root, 'languages-3ds', file));
}
const ctrRoutes = require('../routes/ctr');
const isCtr = (req) => /Nintendo 3DS/.test(req.get('user-agent') || '');
const lookup = (obj, key) => key.split('.').reduce((o, part) => o && o[part], obj);

function ctr(req, res, next) {
    if (!isCtr(req)) return next();
    // olv.js loads pages with ?_pjax=1 and only keeps #body
    res.locals.ctr_pjax = req.query._pjax !== undefined;
    res.set('X-PJAX-PATH', req.originalUrl.replace(/([?&])_pjax=[^&]*&?/, '$1').replace(/[?&]$/, ''));
    const accountLanguage = req.account && req.account[0] && req.account[0].language;
    // t('community.index.header.title', 'Communities', { name }) -> 3DS strings, then Portal strings
    res.locals.t = (key, fallback, params) => {
        let value = [ctrLanguages[accountLanguage], ctrLanguages.en, res.locals.language]
            .map(source => lookup(source, key)).find(v => typeof v === 'string');
        if (value === undefined) value = fallback;
        for (const name of Object.keys(params || {})) value = String(value).split(':' + name).join(params[name]);
        return value;
    };
    // texts olv.js writes itself (see views/ctr/partials/locale.ejs)
    res.locals.ctr_js = (ctrLanguages[accountLanguage] || {}).js || {};
    res.locals.profile_url = req.account && req.account[0] ? '/users/' + encodeURIComponent(req.account[0].nnid) : '/';
    const render = res.render.bind(res);
    res.render = (view, options, callback) => {
        if (view.startsWith('ctr/')) return render(view, options, callback);
        const ctrView = 'ctr/' + view.replace(/\.ejs$/, '');
        if (fs.existsSync(path.join(root, 'views', ctrView + '.ejs'))) return render(ctrView, options, callback);
        if (callback || req.pjax || req.get('x-embedded-dom')) return render(view, options, callback);
        render(view, options, (err, html) => {
            if (err) return next(err);
            res.send(html + '<script src="/n3ds/js/toolbar.js"></script>');
        });
    };
    next();
}

module.exports = (app) => {
    app.use(ctr);
    app.use((req, res, next) => isCtr(req) ? ctrRoutes(req, res, next) : next());
};
