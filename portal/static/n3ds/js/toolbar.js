// Appended to Portal pages that have no 3DS version yet: keeps the 3DS toolbar working.
(function () {
    if (typeof cave === 'undefined') return;
    var go = function (url) { return function () { window.location.href = url; }; };
    cave.toolbar_setVisible(1);
    cave.toolbar_setButtonType(1);
    cave.toolbar_setCallback(1, function () { history.back(); });
    cave.toolbar_setCallback(99, function () { history.back(); });
    cave.toolbar_setCallback(2, go('/'));
    cave.toolbar_setCallback(3, go('/communities'));
    cave.toolbar_setCallback(4, go('/news/my_news'));
    cave.toolbar_setCallback(5, go('/users/@me'));
    if (cave.transition_end) cave.transition_end();
})();
