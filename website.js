/* Website section: edit the text on poweredbypfx.com.
   The form is built from content-schema.json, which the website's deploy
   writes from the markers in its pages. Only values that differ from the
   page's own text are saved, so untouched text can still change in code. */
(function () {
  'use strict';
  var app, sb, esc, SITE;
  var $ = function (id) { return document.getElementById(id); };
  var schema = null, rows = {}, pageId = 'home', values = {}, changed = false, wired = false;
  var SAFE = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

  function page() { return schema.pages.filter(function (p) { return p.page === pageId; })[0]; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function say(text, kind) { var m = $('wsMsg'); m.hidden = !text; m.textContent = text || ''; m.className = 'msg ' + (kind || 'info'); }

  function loadSchema() {
    return fetch(SITE + '/content-schema.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('no live schema'); return r.json(); })
      .catch(function () { return fetch('content-schema.json').then(function (r) { return r.json(); }); });
  }
  function open() {
    app = window.PFXApp; sb = app.sb; esc = app.esc; SITE = app.SITE;
    if (!wired) wire();
    say('');
    $('wsForm').innerHTML = '<div class="empty">Loading…</div>';
    Promise.all([loadSchema(), sb.from('site_content').select('*')]).then(function (r) {
      if (r[1].error) throw r[1].error;
      schema = r[0]; rows = {};
      (r[1].data || []).forEach(function (row) { rows[row.page] = row; });
      showPage(pageId);
    }).catch(function (err) { $('wsForm').innerHTML = '<div class="empty">' + esc(app.friendlyError(err)) + '</div>'; });
  }

  function showPage(id) {
    pageId = id; changed = false;
    var saved = (rows[id] && rows[id].draft) || {};
    values = {};
    page().entries.forEach(function (e) { values[e.key] = clone(e.key in saved ? saved[e.key] : e.default); });
    $('wsHistoryBox').hidden = true;
    say(''); renderTabs(); renderForm(); status();
  }
  function hasDraft(id) { var r = rows[id]; return !!r && !same(r.draft, r.published); }
  function renderTabs() {
    $('wsTabs').innerHTML = schema.pages.map(function (p) {
      return '<button class="ws-tab' + (p.page === pageId ? ' active' : '') + '" role="tab" data-page="' + esc(p.page) + '">' + esc(p.title) +
        (hasDraft(p.page) ? '<i title="Has unpublished changes">●</i>' : '') + '</button>';
    }).join('');
  }
  function status() {
    var r = rows[pageId], t = 'Edit the text and links on this page. Nothing changes on the website until you publish.';
    if (changed) t = 'You have unsaved changes.';
    else if (hasDraft(pageId)) t = 'Saved as a draft. It isn\'t on the website yet.';
    else if (r && r.published_at) t = 'Published ' + new Date(r.published_at).toLocaleString() + (r.published_by ? ' by ' + r.published_by : '') + '.';
    $('wsStatus').textContent = t;
    $('wsView').href = SITE + page().path;
  }
  function touch() { changed = true; status(); }

  /* ---------- form ---------- */
  function fieldHtml(id, label, type, value, max) {
    value = value == null ? '' : String(value);
    var long = type === 'rich' || (max && max > 100) || value.length > 90;
    var input = long
      ? '<textarea id="' + id + '" data-max="' + (max || '') + '">' + esc(value) + '</textarea>'
      : '<input type="text" id="' + id + '" data-max="' + (max || '') + '" value="' + esc(value) + '">';
    var hint = type === 'rich' ? '<div class="hint">To add a link, write [the words](/page) or [the words](https://site.com).</div>'
      : type === 'link' ? '<div class="hint">A page like /contact, or a full web address.</div>' : '';
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' + input + hint + '<div class="counter"></div></div>';
  }
  function count(el) {
    var max = +el.dataset.max, c = el.parentNode.querySelector('.counter');
    if (!c || !max) return;
    var n = el.value.length;
    c.textContent = n + ' / ' + max + ' characters' + (n > max ? ', too long for this spot' : '');
    c.className = 'counter ' + (n > max ? 'warn' : '');
  }
  function renderForm() {
    var groups = [], byName = {};
    page().entries.forEach(function (e, i) {
      var parts = e.label.split(': '), name = parts.length > 1 ? parts[0] : (e.type === 'list' ? e.label : 'Text');
      if (!byName[name]) { byName[name] = { name: name, items: [] }; groups.push(byName[name]); }
      byName[name].items.push({ e: e, i: i, label: parts.length > 1 ? parts.slice(1).join(': ') : e.label });
    });
    $('wsForm').innerHTML = groups.map(function (g) {
      return '<div class="ws-group"><h2>' + esc(g.name) + '</h2>' + g.items.map(entryHtml).join('') + '</div>';
    }).join('');
    $('wsForm').querySelectorAll('[data-max]').forEach(count);
  }
  function entryHtml(x) {
    var e = x.e, v = values[e.key], id = 'f' + x.i;
    if (e.type === 'toggle') {
      return '<label class="ws-toggle"><input type="checkbox" data-key="' + esc(e.key) + '"' + (v !== false ? ' checked' : '') + '> ' + esc(x.label) + '</label>';
    }
    if (e.type !== 'list') {
      return fieldHtml(id, x.label, e.type, v, e.max).replace(/id="f\d+"( data-max)/, 'id="' + id + '" data-key="' + esc(e.key) + '"$1');
    }
    var html = v.map(function (item, n) {
      var keys = e.fields.filter(function (f) { return !e.fixed || f.key in item; });
      if (!keys.length) return '';
      var title = e.fixed ? 'Row ' + (n + 1) : 'Item ' + (n + 1);
      var tools = e.fixed ? '' :
        '<span class="actions"><button type="button" class="btn btn-sm btn-ghost" data-act="up" data-list="' + esc(e.key) + '" data-n="' + n + '"' + (n === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-act="down" data-list="' + esc(e.key) + '" data-n="' + n + '"' + (n === v.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="btn btn-sm btn-ghost btn-danger" data-act="del" data-list="' + esc(e.key) + '" data-n="' + n + '"' + (v.length <= e.min ? ' disabled' : '') + '>Remove</button></span>';
      return '<div class="ws-item"><div class="ws-item-top"><b>' + title + '</b>' + tools + '</div><div>' +
        keys.map(function (f) {
          var fid = id + '_' + n + '_' + f.key;
          return fieldHtml(fid, f.label, f.type, item[f.key], f.max)
            .replace('id="' + fid + '" data-max', 'id="' + fid + '" data-list="' + esc(e.key) + '" data-n="' + n + '" data-f="' + esc(f.key) + '" data-max');
        }).join('') + '</div></div>';
    }).join('');
    var full = e.maxItems && v.length >= e.maxItems;
    var add = e.fixed ? '' : '<button type="button" class="btn btn-sm" data-act="add" data-list="' + esc(e.key) + '"' + (full ? ' disabled' : '') + '>+ Add</button>' +
      (full ? ' <span class="hint">This section fits ' + e.maxItems + ' at most.</span>' : '');
    return (x.label !== e.label || !e.label ? '<label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">' + esc(x.label) + '</label>' : '') + html + add + '<div style="height:12px"></div>';
  }

  function onInput(ev) {
    var el = ev.target;
    if (el.dataset.key) values[el.dataset.key] = el.type === 'checkbox' ? el.checked : el.value;
    else if (el.dataset.list) values[el.dataset.list][+el.dataset.n][el.dataset.f] = el.value;
    else return;
    if (el.dataset.max !== undefined) count(el);
    touch();
  }
  function onClick(ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return;
    var e = page().entries.filter(function (x) { return x.key === b.dataset.list; })[0];
    var list = values[e.key], n = +b.dataset.n, act = b.dataset.act;
    if (act === 'add') { var blank = {}; e.fields.forEach(function (f) { blank[f.key] = ''; }); list.push(blank); }
    if (act === 'del') {
      var name = list[n][e.fields[0].key] || 'this item';
      if (!confirm('Remove "' + name + '"?')) return;
      list.splice(n, 1);
    }
    if (act === 'up') list.splice(n - 1, 0, list.splice(n, 1)[0]);
    if (act === 'down') list.splice(n + 1, 0, list.splice(n, 1)[0]);
    touch(); renderForm();
  }

  /* ---------- saving ---------- */
  function changes() {   // only what differs from the page's own text
    var out = {};
    page().entries.forEach(function (e) { if (!same(values[e.key], e.default)) out[e.key] = clone(values[e.key]); });
    return out;
  }
  function problems() {
    var out = [];
    function check(label, type, value, max, required) {
      value = value == null ? '' : String(value);
      if (max && value.length > max) out.push(label + ' is too long (' + value.length + ' of ' + max + ').');
      if (type === 'link' && value && !/youtu|^[\w-]{6,}$/.test(value) && !SAFE.test(value)) out.push(label + ' isn\'t a valid link.');
      if (required && !value.trim()) out.push(label + ' is empty.');
    }
    page().entries.forEach(function (e) {
      var v = values[e.key];
      if (e.type === 'toggle') return;
      if (e.type !== 'list') { check(e.label, e.type, v, e.max, e.type !== 'link'); return; }
      v.forEach(function (item, n) {
        e.fields.forEach(function (f, i) {
          if (f.key in item) check(e.label + ', item ' + (n + 1) + ', ' + f.label, f.type, item[f.key], f.max, i === 0);
        });
      });
    });
    return out;
  }
  function write(row) {
    var body = Object.assign({ page: pageId }, row);
    return sb.from('site_content').upsert(body, { onConflict: 'page' }).select().single().then(function (res) {
      if (res.error) throw res.error;
      rows[pageId] = res.data; changed = false; renderTabs(); status();
    });
  }
  function busy(b) { ['wsSave', 'wsPublish', 'wsHistory'].forEach(function (id) { $(id).disabled = b; }); }
  function save() {
    busy(true);
    write({ draft: changes() }).then(function () { say('Draft saved. Your team can see it here; the website hasn\'t changed.', 'ok'); })
      .catch(function (err) { say(app.friendlyError(err), 'err'); }).finally(function () { busy(false); });
  }
  function publish() {
    var bad = problems();
    if (bad.length) { say('Fix this first: ' + bad.slice(0, 3).join(' ') + (bad.length > 3 ? ' (and ' + (bad.length - 3) + ' more)' : ''), 'err'); return; }
    if (!confirm('Publish "' + page().title + '" to poweredbypfx.com?')) return;
    var data = changes();
    busy(true);
    write({ draft: data, published: data }).then(function () {
      return sb.functions.invoke('publish-site').then(function (res) {
        if (res.error) say('Saved, but the website didn\'t rebuild, so it isn\'t live yet. It will go out with the next website update. (' + res.error.message + ')', 'err');
        else say('Published. The website updates in about 2 minutes.', 'ok');
      });
    }).catch(function (err) { say(app.friendlyError(err), 'err'); }).finally(function () { busy(false); });
  }
  function history() {
    var box = $('wsHistoryBox');
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false; box.textContent = 'Loading…';
    sb.from('site_content_history').select('id,published,published_at,published_by').eq('page', pageId).order('id', { ascending: false }).limit(10).then(function (res) {
      if (res.error) throw res.error;
      var list = res.data || [];
      if (!list.length) { box.textContent = 'No earlier versions of this page yet.'; return; }
      box.innerHTML = list.map(function (h, i) {
        var when = h.published_at ? new Date(h.published_at).toLocaleString() : 'Original website text';
        return '<div><span>' + esc(when) + (h.published_by ? ' · ' + esc(h.published_by) : '') + '</span><button class="btn btn-sm" data-restore="' + i + '">Load this version</button></div>';
      }).join('');
      box.querySelectorAll('[data-restore]').forEach(function (b) {
        b.addEventListener('click', function () {
          var old = list[+b.dataset.restore].published || {};
          page().entries.forEach(function (e) { values[e.key] = clone(e.key in old ? old[e.key] : e.default); });
          box.hidden = true; touch(); renderForm();
          say('Earlier version loaded. Click Publish to put it back on the website.', 'info');
        });
      });
    }).catch(function (err) { box.textContent = app.friendlyError(err); });
  }

  function wire() {
    wired = true;
    $('wsForm').addEventListener('input', onInput);
    $('wsForm').addEventListener('click', onClick);
    $('wsTabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-page]'); if (!b || b.dataset.page === pageId) return;
      if (changed && !confirm('You have unsaved changes. Leave this page?')) return;
      showPage(b.dataset.page);
    });
    $('wsSave').addEventListener('click', save);
    $('wsPublish').addEventListener('click', publish);
    $('wsHistory').addEventListener('click', history);
  }

  window.PFXWebsite = { open: open, dirty: function () { return changed; }, reset: function () { changed = false; } };
})();
