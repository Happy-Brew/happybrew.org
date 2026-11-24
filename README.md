# Happy Brew website

A plain HTML, CSS and JavaScript website for [Happy Brew](https://www.happybrew.org/), the nonprofit community café at 3200 Hendricks Ave, Jacksonville, FL.

- **Preview:** https://preview.happybrew.org/
- **Repository:** https://github.com/Happy-Brew/happybrew.org
- **No build step and no framework.** Every page is a file you can open and edit. Push to `main` and GitHub Pages publishes it within a minute or two.

> This is a proposed replacement for the current Wix site. It is marked "noindex" so search engines ignore it until it goes live. See [Going live](#going-live).

## What's in here

| Path | What it is |
| --- | --- |
| `index.html` | Home page |
| `menu/index.html` | Food and drink menu with prices |
| `about-us/index.html` | Mission, values and story |
| `the-crew/index.html` | Staff and board bios |
| `our-programs/index.html` | Employment, internship, vendors, collaborators |
| `universal-design/index.html` | Accessibility features |
| `events/index.html` | Upcoming events |
| `room-request/index.html` | Room and venue rentals, FAQ, request form |
| `support/index.html` | Donate, volunteer, legal disclosures |
| `visit-us/index.html` | Address, hours, map, contact form |
| `happy-news/index.html` | Blog index |
| `post/<name>/index.html` | One folder per blog post |
| `thankyouforyourgenerosity/`, `thank-you-contact/` | Thank-you pages (the donation service may send donors to the first one) |
| `404.html` | "Page not found" page. It also forwards old Wix addresses (such as old event links) to the new pages. |
| `general-7/`, `contact-us/`, `book-online/` and similar | One-line redirect pages for old Wix addresses that were merged into other pages. Leave them in place. |
| `sitemap.xml` | List of pages for search engines. Add a line when you add a page or post. |
| `styles.css` | All styling. Colours and sizes are at the top under `:root`. |
| `script.js` | Mobile menu, "open now" badge, forms, old-link forwarding |
| `assets/` | Images, fonts, favicon, sharing image, menu PDF |
| `integrations/sign-ups.gs` | Script for a Google Sheet that receives the Art Club sign-up form (see [Forms](#forms)) |

Page addresses match the old Wix site (`/about-us`, `/the-crew`, `/room-request` and so on) so existing links keep working.

## Editing content

Open the page's `index.html` in any text editor, change the words between the tags, save, commit and push. Text you can see on the page is text you can search for in the file.

**The header and footer are repeated in every HTML file.** If you change the navigation, address, phone, email or hours in the footer, change it in every file. The quickest way is a project-wide find and replace in your editor (in VS Code: Edit → Replace in Files).

### Menu and prices

Edit `menu/index.html`. Each item is one line:

```html
<li><span class="row"><span class="item">Latte</span><span class="price"><span class="vh">Regular </span>$5.50 <span aria-hidden="true">/</span><span class="vh"> large</span> $6.50</span></span></li>
```

- Change the name inside `class="item"` and the prices inside `class="price"`.
- The `vh` spans are read aloud by screen readers ("Regular $5.50, large $6.50"). Keep them.
- An item with one price: `<span class="price">$4</span>`.
- The name and price sit together inside `class="row"`. A description goes after the row, just before `</li>`: `<span class="desc">With cream cheese or butter</span>`.
- A gluten-free item starts with `<span class="gf" aria-hidden="true">GF</span>` and ends with `<span class="vh">(gluten-free)</span>`.
- To add or remove an item, copy or delete a whole `<li>…</li>` line.
- The "Jump to" buttons at the top of the page link to section headings by their `id` (for example `<h3 id="smoothies">` and `<a href="#smoothies">`). If you add or rename a section, update both.

Also update:

- the four featured items on the home page (`index.html`, search for "What’s brewing")
- the downloadable menu: replace `assets/happy-brew-menu.pdf` with the new PDF, keeping the same file name

### Hours

Hours appear in four places. Change all of them:

1. `script.js`: the `HOURS` block at the top. This drives the "Open now" badge. Times use the 24-hour clock and `null` means closed.
2. `visit-us/index.html`: the line under the heading at the top of the page, and the hours table.
3. The footer in every HTML file (search for `6:30 am to 4:00 pm`).
4. `index.html`: the facts strip under the hero, and the JSON-LD block near the top of the file (`openingHoursSpecification`), which tells Google the hours.

### Address, phone and email

Search all files for the old value and replace it:

- Address: `3200 Hendricks Ave`
- Phone: `904.575.4940` (shown) and `+19045754940` (in the `tel:` link)
- Email: `info@happybrew.org`

Also update the JSON-LD block in `index.html` and `CONTACT_EMAIL` at the top of `script.js`.

### Events

Edit `events/index.html`. Each event is an `<article class="event">` block. For a new date, change three things in the block:

```html
<div class="event__date" aria-hidden="true" data-event-date="2026-12-12"><span class="mon">Dec</span><span class="day">12</span><span class="dow">Sat</span></div>
...
<p class="event__meta"><time datetime="2026-12-12T08:30">Saturday, December 12, 2026</time> · 8:30 to 11:00 am</p>
```

`data-event-date` must be `YYYY-MM-DD`. When that date has passed, the Events page greys the date badge and adds "This date has passed" automatically, and the home page hides the event, so a stale date never looks current. The home page shows the next two events in shorter form; update `index.html` too.

The Art Club sign-up form further down the page shows the Art Club date automatically, copied from the Art Club block, so there is nothing extra to change there.

The Run Club button links to the contact form with a message already started. If you change the event date, update the date inside that link as well (search for `RSVP%20for`).

### Blog posts (Happy News)

1. Copy an existing folder in `post/`, rename it, and edit its `index.html`:
   - near the top: the `<title>`, the two descriptions (`name="description"` and `og:description`), `og:title`, and the folder name in the `canonical` and `og:url` lines
   - the block that starts `<script type="application/ld+json">`: headline, date, author, image and address
   - on the page: the `<h1>`, the author and date line, and the paragraphs inside `<div class="wrap wrap--narrow article">`
   - at the bottom: the "Older story" link (point it at the post that used to be newest). Then open that older post and add a "Newer story" link back to the new one.
2. Put images in `assets/img/news/`.
3. Add a card for the post at the top of the list in `happy-news/index.html` (copy an existing `<article class="card card--link post-card">` block). Card photos are cropped to a wide window; if a face near the top of a tall photo gets cut off, add `class="focus-top"` to that card's `<img>`. The home page shows the three newest; update those in `index.html` if you want the new post featured.
4. Add the post's address to `sitemap.xml`.

### Staff and board

Edit `the-crew/index.html`. Each person is one `<li class="person">` block. Headshots are square images in `assets/img/crew/`.

### Photos

Photos live in `assets/img/`. Most come in two sizes, for example `crew-lift-720.webp` and `crew-lift-1440.webp`, so phones download the small one. To replace a photo, export the new one at the same two widths with the same file names. Always describe the photo in the `alt="…"` text for people who can't see it.

## Forms

There are four forms: the newsletter sign-up in the footer of every page, the contact form on `visit-us/`, the room request form on `room-request/`, and the Art Club sign-up on `events/`.

Each `<form>` tag has `data-endpoint=""`.

- **While it is empty**, submitting the form opens the visitor's email app with a message to `info@happybrew.org` already filled in.
- **To have forms send directly**, create a form at [Formspree](https://formspree.io/) and paste its URL in:

```html
<form ... data-endpoint="https://formspree.io/f/abcdwxyz" ...>
```

Do this for each form you want connected. The newsletter form is in the footer of every HTML file, so use find and replace for that one. You can use one Formspree form for everything or a separate one per form.

### Art Club sign-ups: Google Sheet and Square

The Art Club form on `events/` is built to send to a small script that lives inside a Google Sheet you own. The script is in this repository at `integrations/sign-ups.gs`. For every sign-up it:

- adds a row to the Sheet (always);
- adds the person to the Square customer directory, in a group called "Website sign-ups", but only if they ticked "send me Happy Brew news";
- optionally emails the café.

To set it up (about ten minutes, once):

1. In the café's Google account, create a Google Sheet, for example "Happy Brew website sign-ups".
2. In the Sheet, open **Extensions → Apps Script**. Delete what is there, paste in the whole of `integrations/sign-ups.gs`, and save.
3. Open **Project Settings → Script properties** and add:
   - `SQUARE_ACCESS_TOKEN`: an access token from the Square Developer Dashboard that can read and write customers. Leave it out and the script still fills the Sheet; it only skips Square.
   - `NOTIFY_EMAIL` (optional): an address to email each time someone signs up.
4. Back in the editor, choose the function `testSetup` and press **Run**. Google asks you to approve the script the first time. A test row should appear in an "Art Club" tab, and the log says whether Square connected. Delete the test row.
5. Press **Deploy → New deployment**, type **Web app**, "Execute as: Me", "Who has access: Anyone". Copy the web app URL (it ends in `/exec`).
6. In `events/index.html`, find the form with `data-subject="Art Club sign-up"` and paste the URL into its `data-endpoint=""`.

Things to know:

- **Changing the script later:** after editing it, use **Deploy → Manage deployments → Edit → Version: New version**. Until you do, the old version keeps running.
- **Square and the email list:** the script puts people in Square's customer directory, but Square does not let outside tools mark someone as subscribed to marketing email. Check how new people in the "Website sign-ups" group appear under Marketing; if they show as not subscribed, set them to Subscribed in the Square Dashboard. The Sheet's "Wants email news" column is your record that they asked.
- **Other forms:** the same script can take the other forms too. Add an entry to `FORMS` at the top of the script (the name must match the form's `data-subject`) and paste the same URL into that form's `data-endpoint`.
- **The token is a password.** It belongs only in Script properties, never in this repository.

## Design notes

- **Colours** come from the Happy Brew logo and crew shirts: sunflower `#fab300`, navy `#0d3256`, cream `#fffaf0`. Change them once at the top of `styles.css`.
- **Look and feel:** navy leads, like the café's own menu boards and aprons. The header and the top of every page are navy with the white script logo, yellow is the highlight, and corners are nearly square. The rules for this are grouped under the heading "LOOK AND FEEL" near the end of `styles.css`.
- **Fonts** are self-hosted in `assets/fonts/`: Fraunces (a serif) for main headings and Atkinson Hyperlegible Next for everything else. Atkinson Hyperlegible was designed by the Braille Institute for readers with low vision. Both are free under the SIL Open Font License.
- **Accessibility:** base text is 18px or larger, colour contrast is at least 4.5:1, every page has a skip link, visible focus outlines and keyboard-friendly navigation. Please keep these when editing: don't put text over photos, don't use yellow text on white or cream (yellow text is only for navy backgrounds), and always write alt text.
- Striped boxes and chips labelled **TODO** mark content the organisation still needs to supply. Search the files for `TODO` to find them.

### After changing `styles.css` or `script.js`

Browsers keep a copy of these two files for a while. So that returning visitors get the new version straight away, every page loads them as `styles.css?v=3` and `script.js?v=3`. When you change either file, find and replace `?v=3` with `?v=4` (and so on) across all HTML files. If you forget, nothing breaks: visitors simply see the old styling for up to ten minutes.

## Going live

When this replaces the Wix site at happybrew.org:

1. In every HTML file except `404.html`, the two thank-you pages and the one-line redirect pages, delete the line `<meta name="robots" content="noindex">` and the comment above it.
2. Replace `https://preview.happybrew.org/` with `https://www.happybrew.org/` in every HTML file and in `sitemap.xml` (it appears in the canonical link, the sharing tags and the JSON-LD blocks).
3. In the footer of every HTML file, delete the sentence that begins "This is a preview of a proposed new website".
4. Change the custom domain in the repository's Settings → Pages from `preview.happybrew.org` to `www.happybrew.org` (this rewrites the `CNAME` file), and point that domain's DNS at GitHub Pages (`happy-brew.github.io`).
5. Connect the forms (see [Forms](#forms)) before switching the domain, because the Wix forms will stop working. The newsletter form only emails the address to the café; connect it to your email list tool if you want sign-ups added automatically.
6. Submit `https://www.happybrew.org/sitemap.xml` in Google Search Console.
7. Check that the donation service still sends donors to `/thankyouforyourgenerosity`.

## Run it locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/.

## Credits

Website content and photographs © Happy Brew Inc. Fonts: Fraunces and Atkinson Hyperlegible Next, SIL Open Font License 1.1.
