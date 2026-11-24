/**
 * Happy Brew website sign-ups
 * ---------------------------
 * A Google Apps Script that receives a form sent from the website and
 *   1. adds a row to this Google Sheet (always), and
 *   2. adds the person to the Square customer directory, in that form's
 *      customer group, but only if they ticked "send me news by email".
 *
 * It lives inside a Google Sheet (Extensions > Apps Script). Setup steps are
 * in the website README under "Art Club sign-ups".
 *
 * Nothing secret belongs in this file. The Square access token goes in
 * Project Settings > Script properties, as SQUARE_ACCESS_TOKEN.
 * Optional: NOTIFY_EMAIL (an address that gets an email for every sign-up).
 */

/* One entry per website form. The name on the left is the form's
   data-subject in the HTML. "columns" pairs each form field with the
   heading it gets in the Sheet. "squareGroup" is the customer group in
   Square, so the café can email just these people. */
var FORMS = {
  'Art Club sign-up': {
    tab: 'Art Club',
    squareGroup: 'Art Club',
    columns: [
      ['session', 'Art Club date'],
      ['first_name', 'First name'],
      ['last_name', 'Last name'],
      ['email', 'Email'],
      ['phone', 'Phone'],
      ['party_size', 'How many'],
      ['notes', 'Notes'],
      ['news_opt_in', 'Wants email news']
    ]
  }
};

var DEFAULT_SQUARE_GROUP = 'Website sign-ups';   /* used when a form names no group */
var SQUARE_VERSION = '2025-05-21';
var SQUARE_URL = 'https://connect.squareup.com/v2';

/* The website sends each form here. */
function doPost(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p._gotcha) return reply_({ ok: true });                 /* spam bot: say nothing useful */

    var subject = String(p._subject || '').split(':')[0].trim();
    var form = FORMS[subject];
    if (!form) return reply_({ ok: false, error: 'Unknown form.' });

    var data = {};
    form.columns.forEach(function (pair) { data[pair[0]] = clean_(p[pair[0]]); });
    data.email = data.email.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return reply_({ ok: false, error: 'A valid email address is needed.' });

    var wantsNews = data.news_opt_in === 'yes';
    if ('news_opt_in' in data) data.news_opt_in = wantsNews ? 'Yes' : 'No';

    /* Square first, so the Sheet row can record what happened there. */
    var square = 'Not asked for';
    if (wantsNews) {
      try { square = addToSquare_(data, subject, form.squareGroup || DEFAULT_SQUARE_GROUP); }
      catch (error) { square = 'Could not add: ' + error.message; }
    }

    addRow_(form, data, square);
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
  addRow_(form, { session: 'TEST ROW (safe to delete)', first_name: 'Test', last_name: 'Person', email: 'test@example.com', phone: '', party_size: '1', notes: '', news_opt_in: 'No' }, 'Not asked for');
  console.log('Sheet: test row added to the "' + form.tab + '" tab.');
  if (!token_()) { console.log('Square: no SQUARE_ACCESS_TOKEN set, so Square is switched off.'); return; }
  try {
    square_('post', '/customers/search', { limit: 1, query: { filter: { email_address: { exact: 'test@example.com' } } } });
    console.log('Square: connected.');
  } catch (error) {
    console.log('Square: ' + error.message);
  }
}

/* ---------- Google Sheet ---------- */

function addRow_(form, data, square) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName(form.tab) || book.insertSheet(form.tab);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Received'].concat(form.columns.map(function (pair) { return pair[1]; }), ['Square']));
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([new Date()].concat(form.columns.map(function (pair) { return safeCell_(data[pair[0]]); }), [square]));
  } finally {
    lock.releaseLock();
  }
}

/* Trim, flatten and cap whatever the visitor typed. */
function clean_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, 1000);
}

/* Stop a typed value such as "=1+1" being run as a spreadsheet formula. */
function safeCell_(value) {
  value = String(value == null ? '' : value);
  return /^[=+\-@]/.test(value) ? "'" + value : value;
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
      given_name: data.first_name || undefined,
      family_name: data.last_name || undefined,
      email_address: data.email,
      note: 'Asked for email news on the website (' + subject + ', ' + today + ').'
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
    var lines = form.columns.map(function (pair) { return pair[1] + ': ' + (data[pair[0]] || ''); });
    lines.push('Square: ' + square);
    MailApp.sendEmail({ to: to, replyTo: data.email, subject: 'Website: ' + subject, body: lines.join('\n') });
  } catch (error) {
    console.error(error);
  }
}

function reply_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}
