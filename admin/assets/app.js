document.addEventListener('DOMContentLoaded', function () {

    // ---- Bulk selection (Licenses page) ----
    var selectAll = document.getElementById('select-all');
    var rowChecks = document.querySelectorAll('.row-check');
    var bulkCount = document.getElementById('bulk-count');
    var bulkButtons = document.querySelectorAll('.bulk-btn');

    function updateBulkBar() {
        var checked = document.querySelectorAll('.row-check:checked').length;
        if (bulkCount) bulkCount.textContent = checked + ' selected';
        bulkButtons.forEach(function (btn) { btn.disabled = checked === 0; });
        if (selectAll) {
            selectAll.checked = checked > 0 && checked === rowChecks.length;
            selectAll.indeterminate = checked > 0 && checked < rowChecks.length;
        }
    }

    if (selectAll) {
        selectAll.addEventListener('change', function () {
            rowChecks.forEach(function (cb) { cb.checked = selectAll.checked; });
            updateBulkBar();
        });
    }
    rowChecks.forEach(function (cb) {
        cb.addEventListener('change', updateBulkBar);
    });
    updateBulkBar();

    // ---- Theme toggle ----
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var root = document.documentElement;
            var current = root.getAttribute('data-theme') || 'dark';
            var next = current === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
        });
    });

    // ---- Mobile sidebar toggle ----
    var toggle = document.querySelector('[data-sidebar-toggle]');
    var shell = document.querySelector('.app-shell');
    if (toggle && shell) {
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            shell.classList.toggle('sidebar-open');
        });
    }
    document.addEventListener('click', function (e) {
        if (shell && shell.classList.contains('sidebar-open') &&
            !e.target.closest('.sidebar') && !e.target.closest('[data-sidebar-toggle]')) {
            shell.classList.remove('sidebar-open');
        }
    });

    // ---- Row action dropdown menus ----
    document.querySelectorAll('[data-menu-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var menu = btn.nextElementSibling;
            document.querySelectorAll('.action-menu.open').forEach(function (m) {
                if (m !== menu) m.classList.remove('open');
            });
            if (menu) menu.classList.toggle('open');
        });
    });
    document.addEventListener('click', function () {
        document.querySelectorAll('.action-menu.open').forEach(function (m) {
            m.classList.remove('open');
        });
    });

    // ---- Tap-to-copy ----
    document.querySelectorAll('[data-copy]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.stopPropagation();
            var value = el.getAttribute('data-copy');
            var tip = el.querySelector('.copy-tip');

            function done() {
                el.classList.add('copied');
                if (tip) tip.textContent = 'Copied!';
                setTimeout(function () {
                    el.classList.remove('copied');
                    if (tip) tip.textContent = 'Tap to copy';
                }, 1400);
            }

            function fallbackCopy() {
                var ta = document.createElement('textarea');
                ta.value = value;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); done(); } catch (err) { /* ignore */ }
                document.body.removeChild(ta);
            }

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(value).then(done).catch(fallbackCopy);
            } else {
                fallbackCopy();
            }
        });
    });

});
