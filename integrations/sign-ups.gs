/**
 * Happy Brew website sign-ups
 * ---------------------------
 * A Google Apps Script that receives a form sent from the website and
 *   1. adds a row to this Google Sheet, and
 *   2. adds the person to the Square customer directory, in that form's
 *      customer group, but only if they ticked "send me news by email".
 *
 * It works for any form on the website:
 *   - Each form fills the tab of this Sheet that has the form's name (the
 *     form's data-subject in the HTML). To start saving a new form, add an
 *     empty tab with that name and paste this script's web address into
 *     the form's data-endpoint. Nothing in this file has to change.
 *   - Every field the form sends gets a column, added the first time the
 *     field arrives. Fields can be added to or removed from a form in the
 *     HTML without touching this script.
 *
 * It lives inside a Google Sheet (Extensions > Apps Script). Setup steps are
 * in the website README under "Sign-ups: Google Sheet and Square".
 *
 * Nothing secret belongs in this file. The Square access token goes in
 * Project Settings > Script properties, as SQUARE_ACCESS_TOKEN.
 * Optional: NOTIFY_EMAIL (an address that gets an email for every sign-up).
 *
 * The next line limits the script to the one Sheet it lives in, so Google
 * does not ask for access to all of your spreadsheets.
 * @OnlyCurrentDoc
 */

/* Optional extras for particular forms. A form does not need an entry
   here to be saved; it only needs a tab with its name. The name on the
   left is the form's data-subject in the HTML.

   "tab"         the Sheet tab to fill. The script creates it if it is missing.
   "squareGroup" the customer group in Square, so the café can email just
                 these people (otherwise "Website sign-ups").
   "headings"    friendlier column headings, and the order of the columns in
                 a new tab. A field not listed here still gets saved, in a
                 column named after it (t_shirt_size becomes "T shirt size").
                 A field listed here is always given a column, and listing
                 "email" makes an email address compulsory for that form. */
var FORMS = {
  'Art Club sign-up': {
    tab: 'Art Club',
    squareGroup: 'Art Club',
    headings: {
      session: 'Art Club date',
      first_name: 'First name',
      last_name: 'Last name',
      email: 'Email',
      phone: 'Phone',
      party_size: 'How many',
      notes: 'Notes',
      news_opt_in: 'Wants email news'
    }
  }
};

var DEFAULT_SQUARE_GROUP = 'Website sign-ups';   /* used when a form names no group */
var OVERFLOW = 'More answers';                   /* column for answers that did not get a column of their own */
var MAX_FIELDS = 30;                             /* most fields accepted from one sign-up */
var MAX_COLUMNS = 40;                            /* most columns a tab can grow to */
var MAX_ROWS_PER_DAY = 300;                      /* most sign-ups saved in a day, all forms together */
var MAX_SQUARE_PER_DAY = 100;                    /* most people added to Square in a day */
var SQUARE_VERSION = '2025-05-21';
var SQUARE_URL = 'https://connect.squareup.com/v2';

/* The website sends each form here. */
function doPost(e) {
  try {
    var p = (e && (e.parameters || e.parameter)) || {};
    if (text_(own_(p, '_gotcha') ? p._gotcha : '')) return reply_({ ok: true });   /* spam bot: say nothing useful */

    var subject = text_(own_(p, '_subject') ? p._subject : '').split(':')[0].trim();
    var form = formFor_(subject);
    var tab = tabName_(form.tab || subject);
    if (!tab) return reply_({ ok: false, error: 'The form has no name.' });

    /* Take every field the form sent. Names starting with "_" are the
       website's own housekeeping (_subject, _gotcha) and are not saved. */
    var sent = Object.keys(p).filter(function (field) { return /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(field); }).sort();
    if (sent.length > MAX_FIELDS) return reply_({ ok: false, error: 'The form has too many fields.' });
    var data = {};
    Object.keys(form.headings || {}).forEach(function (field) { data[field] = ''; });
    sent.forEach(function (field) { data[field] = text_(p[field]); });

    /* If the form has an email field, it has to hold a real-looking address. */
    var hasEmail = own_(data, 'email');
    if (hasEmail) {
      data.email = data.email.toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return reply_({ ok: false, error: 'A valid email address is needed.' });
    }

    var wantsNews = own_(data, 'news_opt_in') && data.news_opt_in === 'yes';
    if (own_(data, 'news_opt_in')) data.news_opt_in = wantsNews ? 'Yes' : 'No';

    /* One sign-up at a time from here on, so two arriving together cannot
       trip over each other in the Sheet or in Square. */
    var square = 'Not asked for';
    var lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      var sheet = sheetFor_(tab, form);
      if (!sheet) return reply_({ ok: false, error: 'Unknown form.' });
      if (!spend_('rows', MAX_ROWS_PER_DAY)) return reply_({ ok: false, error: 'Too many sign-ups today.' });

      /* Square first, so the Sheet row can record what happened there. */
      if (wantsNews && !hasEmail) square = 'No email address given';
      else if (wantsNews && !token_()) square = 'Square not set up';
      else if (wantsNews && !spend_('square', MAX_SQUARE_PER_DAY)) square = 'Daily limit reached, not added to Square';
      else if (wantsNews) {
        try { square = addToSquare_(data, subject, form.squareGroup || DEFAULT_SQUARE_GROUP); }
        catch (error) { square = 'Could not add: ' + error.message; }
      }

      addRow_(sheet, form, data, square);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    notify_(subject, form, data, square);
    return reply_({ ok: true });
  } catch (error) {
    console.error(error);
    return reply_({ ok: false, error: 'Something went wrong.' });
  }
}

/* Opening the script's web address in a browser shows that it is running. */
function doGet() {
  return ContentService.createTextOutput('The Happy Brew sign-up script is running.');
}

/* Run this once from the editor after pasting the script in. It asks for the
   permissions the script needs, writes one test row and checks Square. */
function testSetup() {
  var form = FORMS['Art Club sign-up'];
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    addRow_(sheetFor_(form.tab, form), form, { session: 'TEST ROW (safe to delete)', first_name: 'Test', last_name: 'Person', email: 'test@example.com', news_opt_in: 'No' }, 'Not asked for');
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  console.log('Sheet: test row added to the "' + form.tab + '" tab.');
  if (!token_()) { console.log('Square: no SQUARE_ACCESS_TOKEN set, so Square is switched off.'); return; }
  try {
    square_('post', '/customers/search', { limit: 1, query: { filter: { email_address: { exact: 'test@example.com' } } } });
    console.log('Square: connected.');
  } catch (error) {
    console.log('Square: ' + error.message);
  }
}

/* ---------- Which form, which tab ---------- */

/* The extras for a form, found by its name or by the name of its tab.
   A form with no entry in FORMS gets none. */
function formFor_(subject) {
  if (own_(FORMS, subject)) return FORMS[subject];
  var wanted = tabName_(subject).toLowerCase();
  var names = Object.keys(FORMS);
  for (var i = 0; i < names.length; i++) {
    if (wanted && tabName_(FORMS[names[i]].tab || names[i]).toLowerCase() === wanted) return FORMS[names[i]];
  }
  return {};
}

/* The tab a form fills. A form listed in FORMS gets its tab made for it.
   Any other form is saved only if someone has already added a tab with its
   name; that is how the Sheet's owner says "yes, save this form". */
function sheetFor_(tab, form) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(tab);
  if (!sheet && form.tab) sheet = book.insertSheet(tab);
  return sheet || null;
}

/* A form's name made safe to use as the name of a tab. */
function tabName_(name) {
  return String(name || '').replace(/[\[\]*?\/\\:']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/* ---------- Google Sheet ---------- */

/* Each value goes under the column whose heading matches, wherever that
   column is, so whole columns can be moved around in the Sheet. A field
   with no column yet gets a new one at the right-hand end. Once a tab is
   MAX_COLUMNS wide, further new fields share the "More answers" column
   instead, so nothing a visitor sent is thrown away. */
function addRow_(sheet, form, data, square) {
  var width = sheet.getLastRow() === 0 ? 0 : sheet.getLastColumn();
  var header = width ? sheet.getRange(1, 1, 1, width).getValues()[0].map(function (cell) { return String(cell).trim(); }) : [];
  var before = header.length;
  var listed = Object.keys(form.headings || {});
  var names = headingsFor_(form, listed.concat(Object.keys(data)));

  /* The headings this row wants, in order: Received, the fields, Square. */
  var wanted = ['Received'];
  listed.concat(Object.keys(data)).forEach(function (field) { if (wanted.indexOf(names[field]) < 0) wanted.push(names[field]); });
  wanted.push('Square');

  var values = {};
  values.Received = new Date();
  values.Square = square;
  Object.keys(data).forEach(function (field) { values[names[field]] = safeCell_(data[field]); });

  var extra = [];
  wanted.forEach(function (name) {
    if (header.indexOf(name) >= 0) return;
    if (header.length < MAX_COLUMNS || name === 'Received' || name === 'Square') header.push(name);
    else if (own_(values, name) && values[name] !== '') extra.push(name + ': ' + values[name]);
  });
  if (extra.length) {
    if (header.indexOf(OVERFLOW) < 0) header.push(OVERFLOW);
    values[OVERFLOW] = safeCell_(extra.join('; '));   /* at most MAX_FIELDS answers of 1,000 characters: fits in one cell */
  }

  if (header.length > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), header.length - sheet.getMaxColumns());
  if (header.length !== before) sheet.getRange(1, 1, 1, header.length).setValues([header]);
  if (!before) sheet.setFrozenRows(1);
  sheet.appendRow(header.map(function (name) { return name && own_(values, name) ? values[name] : ''; }));
}

/* The column heading for each field: the friendly one from FORMS if there
   is one, otherwise the field's own name tidied up (t_shirt_size becomes
   "T shirt size").

   A field always gets the same heading, whatever else is sent with it, and
   no two fields share one. Plainly named fields (small letters and digits
   joined by single underscores) each tidy up to a different heading. Any
   other name, and any name that would tidy up to a heading already spoken
   for, keeps its exact name in brackets: "First name (first-name)". */
function headingsFor_(form, fields) {
  var listed = form.headings || {};
  var taken = {};
  var names = {};
  ['Received', 'Square', OVERFLOW].forEach(function (name) { taken[name.toLowerCase()] = true; });
  Object.keys(listed).forEach(function (field) { taken[String(listed[field]).toLowerCase()] = true; });
  fields.forEach(function (field) {
    if (own_(listed, field)) { names[field] = String(listed[field]); return; }
    var name = field.replace(/[_-]+/g, ' ').trim();
    name = name.charAt(0).toUpperCase() + name.slice(1);
    var plain = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(field);
    names[field] = plain && !own_(taken, name.toLowerCase()) ? name : name + ' (' + field + ')';
  });
  return names;
}

/* What the visitor typed for one field, trimmed, flattened and capped.
   A field sent more than once (a group of tick boxes) is joined with commas. */
function text_(value) {
  if (value == null) return '';
  if (Object.prototype.toString.call(value) === '[object Array]') {
    value = value.slice(0, 20).map(function (one) { return String(one).slice(0, 2000); }).join(', ');
  }
  return String(value).slice(0, 4000).replace(/\s+/g, ' ').trim().slice(0, 1000);
}

/* Stop a typed value such as "=1+1" being run as a spreadsheet formula. */
function safeCell_(value) {
  value = String(value == null ? '' : value);
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

/* True if the object itself has this key (not one it was born with, such
   as "constructor"). Field names come from strangers, so this matters. */
function own_(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/* ---------- Daily limits ---------- */

/* Counts one more "rows" or "square" for today and says whether that is
   still within the limit. A public form can be hammered by a stranger;
   this keeps a bad day from filling the Sheet or the Square directory. */
function spend_(what, limit) {
  var props = PropertiesService.getScriptProperties();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var count = {};
  try { count = JSON.parse(props.getProperty('TODAY_COUNT') || '{}') || {}; } catch (error) { count = {}; }
  if (count.day !== today) count = { day: today };
  var used = Number(count[what]) || 0;
  if (used >= limit) return false;
  count[what] = used + 1;
  props.setProperty('TODAY_COUNT', JSON.stringify(count));
  return true;
}

/* ---------- Square ---------- */

function token_() {
  return PropertiesService.getScriptProperties().getProperty('SQUARE_ACCESS_TOKEN');
}

function square_(method, path, body) {
  var options = {
    method: method,
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token_(), 'Square-Version': SQUARE_VERSION }
  };
  if (body) options.payload = JSON.stringify(body);
  var response = UrlFetchApp.fetch(SQUARE_URL + path, options);
  var json = {};
  try { json = JSON.parse(response.getContentText() || '{}'); } catch (error) { /* not JSON */ }
  if (response.getResponseCode() >= 300) {
    var detail = json.errors && json.errors[0] && (json.errors[0].detail || json.errors[0].code);
    throw new Error('Square said ' + response.getResponseCode() + (detail ? ' (' + detail + ')' : ''));
  }
  return json;
}

/* Find the person by email, or create them, then put them in the group. */
function addToSquare_(data, subject, groupName) {
  if (!token_()) return 'Square not set up';
  var found = square_('post', '/customers/search', { limit: 1, query: { filter: { email_address: { exact: data.email } } } });
  var customer = found.customers && found.customers[0];
  var result = 'Already in Square';
  if (!customer) {
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    customer = square_('post', '/customers', {
      idempotency_key: Utilities.getUuid(),
      given_name: (own_(data, 'first_name') && data.first_name) || undefined,
      family_name: (own_(data, 'last_name') && data.last_name) || undefined,
      email_address: data.email,
      note: 'Asked for email news on the website (' + subject.slice(0, 80) + ', ' + today + ').'
    }).customer;
    result = 'Added to Square';
  }
  square_('put', '/customers/' + customer.id + '/groups/' + groupId_(groupName));
  return result;
}

/* The group's id, looked up (or created) once and then remembered. */
function groupId_(name) {
  var props = PropertiesService.getScriptProperties();
  var key = 'SQUARE_GROUP_ID: ' + name;
  var id = props.getProperty(key);
  if (id) return id;
  var groups = square_('get', '/customers/groups').groups || [];
  var match = groups.filter(function (group) { return group.name === name; })[0];
  if (!match) match = square_('post', '/customers/groups', { idempotency_key: Utilities.getUuid(), group: { name: name } }).group;
  props.setProperty(key, match.id);
  return match.id;
}

/* ---------- Email notice to the café (optional) ---------- */

function notify_(subject, form, data, square) {
  var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  try {
    var names = headingsFor_(form, Object.keys(data));
    var lines = Object.keys(data).map(function (field) { return names[field] + ': ' + data[field]; });
    lines.push('Square: ' + square);
    var message = { to: to, subject: 'Website: ' + subject.slice(0, 80), body: lines.join('\n') };
    if (own_(data, 'email') && data.email) message.replyTo = data.email;
    MailApp.sendEmail(message);
  } catch (error) {
    console.error(error);
  }
}

function reply_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}
