/* Happy Brew — script.js
   Small, dependency-free helpers. The site works without JavaScript;
   this adds the mobile menu, the "open now" badge, form sending and a few niceties. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     OPENING HOURS — edit here when hours change (24-hour clock).
     Days: 0 = Sunday, 1 = Monday ... 6 = Saturday. null = closed.
     Also update the hours written in the footer and on the Visit page.
     ------------------------------------------------------------------ */
  var HOURS = {
    0: ['06:30', '16:00'],
    1: null,
    2: ['06:30', '16:00'],
    3: ['06:30', '16:00'],
    4: ['06:30', '16:00'],
    5: ['06:30', '16:00'],
    6: ['06:30', '16:00']
  };
  var TIME_ZONE = 'America/New_York';
  var CONTACT_EMAIL = 'info@happybrew.org';
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ---------- Mobile menu ---------- */
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    nav.classList.toggle('is-open', open);
  }
  if (toggle && nav && header) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });
    /* Close when keyboard focus (or a click) moves outside the header */
    header.addEventListener('focusout', function (event) {
      if (event.relatedTarget && !header.contains(event.relatedTarget)) setMenu(false);
    });
    document.addEventListener('click', function (event) {
      if (!header.contains(event.target)) setMenu(false);
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
  }

  /* ---------- "Open now" badge ---------- */
  function nowInZone() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    var out = {};
    parts.forEach(function (p) { out[p.type] = p.value; });
    return {
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(out.weekday),
      minutes: parseInt(out.hour, 10) * 60 + parseInt(out.minute, 10)
    };
  }
  function toMinutes(hhmm) {
    var bits = hhmm.split(':');
    return parseInt(bits[0], 10) * 60 + parseInt(bits[1], 10);
  }
  function friendly(hhmm) {
    var bits = hhmm.split(':');
    var h = parseInt(bits[0], 10);
    var suffix = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + bits[1] + ' ' + suffix;
  }
  function updateStatus() {
    var badge = document.querySelector('[data-open-status]');
    var text = document.querySelector('[data-open-text]');
    if (!badge || !text) return;
    var now;
    try { now = nowInZone(); } catch (error) { return; }
    if (now.day < 0) return;
    var today = HOURS[now.day];
    if (today && now.minutes >= toMinutes(today[0]) && now.minutes < toMinutes(today[1])) {
      badge.setAttribute('data-state', 'open');
      text.textContent = 'Open now until ' + friendly(today[1]);
      return;
    }
    badge.setAttribute('data-state', 'closed');
    if (today && now.minutes < toMinutes(today[0])) {
      text.textContent = 'Closed now. Opens today at ' + friendly(today[0]);
      return;
    }
    for (var i = 1; i <= 7; i++) {
      var d = (now.day + i) % 7;
      if (HOURS[d]) {
        text.textContent = 'Closed now. Opens ' + (i === 1 ? 'tomorrow' : DAY_NAMES[d]) + ' at ' + friendly(HOURS[d][0]);
        return;
      }
    }
  }
  updateStatus();

  /* ---------- Events: flag dates that have passed ---------- */
  (function () {
    var today;
    try {
      today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date()); /* YYYY-MM-DD */
    } catch (error) { return; }
    document.querySelectorAll('[data-event-date]').forEach(function (el) {
      if (el.getAttribute('data-event-date') >= today) return;
      var card = el.closest('.event, .event-card');
      if (!card) return;
      if (card.classList.contains('event-card')) {
        /* Home page: simply drop events that are over */
        card.hidden = true;
        return;
      }
      el.classList.add('is-past');
      var meta = card.querySelector('.event__meta');
      if (meta) meta.insertAdjacentHTML('beforeend', ' <span>(This date has passed. Check Instagram or call us for the next one.)</span>');
    });

    /* Sign-up forms: show the date of the event they belong to */
    document.querySelectorAll('input[data-copy-from]').forEach(function (input) {
      var source = document.querySelector(input.getAttribute('data-copy-from'));
      if (!source) return;
      var card = source.closest('.event');
      var badge = card && card.querySelector('[data-event-date]');
      var past = badge && badge.getAttribute('data-event-date') < today;
      input.defaultValue = past ? (input.getAttribute('data-past-value') || '') : source.textContent.trim();
    });
  })();

  /* ---------- Forms ----------
     Each form has data-endpoint="". Paste a Formspree URL there
     (for example https://formspree.io/f/abcdwxyz) and the form sends in the page.
     While it is empty, the form opens the visitor's email app with the message filled in. */
  function fieldLabel(form, field) {
    var label = field.id && form.querySelector('label[for="' + field.id + '"]');
    var text = label ? label.textContent : field.name;
    return text.replace(/\(optional\)/i, '').replace(/\s+/g, ' ').trim();
  }
  function collect(form) {
    var lines = [];
    Array.prototype.forEach.call(form.elements, function (field) {
      if (!field.name || field.type === 'submit' || field.name === '_gotcha') return;
      if (field.type === 'checkbox') {
        if (field.checked) lines.push(fieldLabel(form, field) + ': Yes');
        return;
      }
      if (field.type === 'hidden') { lines.push(field.value); return; }
      if (field.value.trim()) lines.push(fieldLabel(form, field) + ': ' + field.value.trim());
    });
    return lines;
  }
  function showStatus(form, message, kind) {
    var status = form.querySelector('.form-status');
    if (!status) return;
    status.textContent = message;
    status.setAttribute('data-kind', kind || 'info');
  }
  document.querySelectorAll('form[data-endpoint]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var trap = form.querySelector('[name="_gotcha"]');
      if (trap && trap.value) return; /* spam bot */
      var endpoint = (form.getAttribute('data-endpoint') || '').trim();
      var topic = form.querySelector('[name="topic"]');
      var subject = form.getAttribute('data-subject') || 'Website message';
      if (topic && topic.value) subject += ': ' + topic.value;
      var success = form.getAttribute('data-success') || 'Thank you! We got your message and will be in touch soon.';

      if (!endpoint) {
        var body = collect(form).join('\n');
        window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        showStatus(form, 'Your email app should now open with your message ready to send. If nothing happens, email us at ' + CONTACT_EMAIL + '.');
        return;
      }

      var button = form.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      showStatus(form, 'Sending…');
      var data = new FormData(form);
      data.append('_subject', subject);
      var request = { method: 'POST', body: data, headers: { Accept: 'application/json' } };
      var timer = null;
      if (window.AbortController) {
        /* Give up after 45 seconds rather than leave "Sending…" on screen for ever */
        var stopper = new AbortController();
        request.signal = stopper.signal;
        timer = window.setTimeout(function () { stopper.abort(); }, 45000);
      }
      fetch(endpoint, request)
        .then(function (response) {
          if (!response.ok) throw new Error('Request failed');
          return response.json(); /* a reply we cannot read is not a confirmed sign-up */
        })
        .then(function (result) {
          /* Some services always answer "200 OK" and report a problem in the reply itself */
          if (!result || typeof result !== 'object' || result.ok === false) throw new Error('Request refused');
          form.reset();
          showStatus(form, success, 'success');
        })
        .catch(function () {
          showStatus(form, 'Sorry, that did not send. Please try again, or email us at ' + CONTACT_EMAIL + '.', 'error');
        })
        .then(function () {
          if (timer) window.clearTimeout(timer);
          if (button) button.disabled = false;
        });
    });
  });

  /* Pre-select a topic from links such as visit-us/?topic=Volunteering#contact */
  document.querySelectorAll('form select[name="topic"]').forEach(function (select) {
    var wanted;
    try { wanted = new URLSearchParams(window.location.search).get('topic'); } catch (error) { wanted = null; }
    if (!wanted) return;
    Array.prototype.forEach.call(select.options, function (option) {
      if (option.value.toLowerCase() === wanted.toLowerCase()) select.value = option.value;
    });
    /* ...and start the message, for example from an event's RSVP button */
    var message = select.form.querySelector('textarea[name="message"]');
    var starter;
    try { starter = new URLSearchParams(window.location.search).get('message'); } catch (error) { starter = null; }
    if (message && starter && !message.value) message.value = starter.slice(0, 300);
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- 404 page: send old Wix addresses to their new homes ---------- */
  var lost = document.querySelector('[data-not-found]');
  if (lost) {
    var base = document.querySelector('base');
    var root = base ? base.getAttribute('href') : '/';
    var path = window.location.pathname;
    if (path.indexOf(root) === 0) path = path.slice(root.length);
    path = path.replace(/\/+$/, '').replace(/\.html$/, '').toLowerCase();
    var MOVED = [
      [/^event-details\//, 'events/'],
      [/^event-list$/, 'events/'],
      [/^(general-7|volunteer)$/, 'support/#volunteer'],
      [/^(donate|thankyouforyourgenerosity)$/, 'support/'],
      [/^(contact-us|contact|thank-you-contact)$/, 'visit-us/'],
      [/^(our-stories|blog)$/, 'happy-news/'],
      [/^(book-online|webinar-registration|copy-of-landing-page|copy-of-private-event-venue(-1)?)$/, 'room-request/'],
      [/^(service-page|booking-calendar)\//, 'room-request/'],
      [/^(about|the-crew|crew)$/, 'the-crew/'],
      [/^(programs|vendors)$/, 'our-programs/'],
      [/^(visit|hours|location)$/, 'visit-us/'],
      [/^(items|merch)$/, 'support/#shop'],
      [/^(photos|inquiry-services-page|plans-pricing)$/, '']
    ];
    for (var m = 0; m < MOVED.length; m++) {
      if (MOVED[m][0].test(path)) {
        window.location.replace(root + MOVED[m][1]);
        break;
      }
    }
  }
})();
