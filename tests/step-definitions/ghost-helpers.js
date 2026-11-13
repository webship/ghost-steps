'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the steps use and that other packs can require instead of copying:
// the wait budget, friendly failures that say what was found, URL building, the
// users registry, the Admin API through the browser session, and the locators
// of the admin (lists, editor, notifications, dialogs) and of the front end
// (the membership and search frames).
//
// The admin is a single-page app: every helper waits on what the app itself
// renders (the user menu, a list, the editor status, a notification), never on
// a fixed delay.

const { gotoUrl, smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds. Kept below the step timeout of webship-js.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

function supplied(value) {
  return value !== undefined && value !== null;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A RegExp that matches the whole text, ignoring surrounding space. */
function exactly(text) {
  return new RegExp('^\\s*' + escapeRegExp(text) + '\\s*$');
}

/** A short failure: what was expected and found, and where to look. */
function fail(message, hint) {
  return friendly({ message, hint });
}

/** The visible texts of a locator, trimmed and shortened, for failure messages. */
async function textsOf(locator, limit) {
  const texts = await locator.allInnerTexts().catch(() => []);
  const clean = texts.map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!clean.length) return '(nothing)';
  const shown = clean.slice(0, limit || 12).map((text) => `"${text.length > 80 ? text.slice(0, 77) + '...' : text}"`);
  return shown.join(', ') + (clean.length > shown.length ? `, and ${clean.length - shown.length} more` : '');
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match;
 * fail with what is there instead.
 *
 * @param {import('playwright').Locator} locator
 * @param {*} notCase
 * @param {{label: string, hint: string, timeout: number, found?: Function}} options
 */
async function assertPresence(locator, notCase, { label, hint, timeout, found }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch (error) {
    const seen = found ? ` Found: ${await found()}.` : '';
    throw fail(notCase ? `Expected not to see ${label}, but it is on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.${seen}`, hint);
  }
}

/**
 * Poll a reading until it satisfies a check; fail with the last reading.
 *
 * @param {Function} read async () => value
 * @param {Function} check (value) => boolean
 * @param {number} timeout
 * @returns {Promise<{ok: boolean, value: *}>}
 */
async function poll(read, check, timeout) {
  const end = Date.now() + timeout;
  let value;
  for (;;) {
    value = await read().catch((error) => error);
    if (!(value instanceof Error) && check(value)) return { ok: true, value };
    if (Date.now() > end) return { ok: false, value: value instanceof Error ? value.message : value };
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

function siteUrl(world, url) {
  if (!url) return siteRoot(world) + '/';
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

// The screens of the admin by the name a person knows them by. The value is
// the route after /ghost/#/.
const ADMIN_SCREENS = {
  'analytics': 'analytics',
  'posts': 'posts',
  'drafts': 'posts?type=draft',
  'scheduled': 'posts?type=scheduled',
  'published': 'posts?type=published',
  'pages': 'pages',
  'tags': 'tags',
  'new tag': 'tags/new',
  'members': 'members',
  'new member': 'members/new',
  'comments': 'comments',
  'settings': 'settings',
  'staff': 'settings/staff',
  'new post': 'editor/post',
  'new page': 'editor/page',
  'sign in': 'signin',
};

/** The route of a named admin screen; a name that is not in the table is used as a route. */
function adminRoute(name) {
  const key = String(name).trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ADMIN_SCREENS, key)) return ADMIN_SCREENS[key];
  return String(name).trim().replace(/^\/?(ghost\/)?#?\/?/, '');
}

function adminUrl(world, route) {
  return siteRoot(world) + '/ghost/#/' + String(route || '').replace(/^\/+/, '');
}

/** The route the admin is on (the part after `#/`), without a trailing slash. */
function currentRoute(world) {
  const hash = new URL(world.page.url()).hash || '';
  return hash.replace(/^#\/?/, '').replace(/\/$/, '');
}

/**
 * The user menu button (bottom of the admin menu; a Contributor has only this
 * button, labelled "Open user menu"). Found by its label, not by its role: while a dialog is open the
 * rest of the admin is hidden from the accessibility tree.
 */
function userMenuButton(world) {
  return world.page.locator('button[aria-label="User menu"], button[aria-label="Open user menu"]');
}

/**
 * What tells that the admin app has rendered for a signed-in user: the user
 * menu button, the title field of the editor (the editor fills the window and
 * has no menu) or the menu of the settings (the settings of an Owner or an
 * Administrator are a screen of their own, with "Back to app" and no user menu).
 */
function adminShell(world) {
  return world.page.locator('button[aria-label="User menu"], button[aria-label="Open user menu"], [data-testid="editor-title-input"], [data-testid="sidebar"]');
}

/** The sign in form of the admin. */
function signInForm(world) {
  return world.page.locator('input[name="identification"], [data-test-input="email"]');
}

/**
 * Wait until the admin has rendered either its app shell (somebody is signed
 * in) or its sign in form. Returns which one.
 *
 * @param {object} world
 * @returns {Promise<'app'|'signin'>}
 */
async function waitForAdmin(world) {
  const app = adminShell(world).first();
  const form = signInForm(world).first();
  try {
    await app.or(form).first().waitFor({ state: 'visible', timeout: budget(world) * 2 });
  } catch (error) {
    throw fail(`The admin did not load at ${world.page.url()}: neither the app (the user menu, the editor, the settings) nor the sign in form appeared.`,
      'Check that the site answers at /ghost/ and that launchUrl in cucumber.js is the address the site is configured with (the admin refuses another origin).');
  }
  return (await app.isVisible()) ? 'app' : 'signin';
}

/** Open an admin route and wait for the app. */
async function openAdmin(world, route) {
  const target = adminUrl(world, route);
  await gotoUrl(world.page, target);
  // Going from one route to another only changes the hash: the app swaps the
  // screen without a page load, so wait for the address and then for the app.
  await world.page.waitForLoadState('domcontentloaded').catch(() => {});
  const state = await waitForAdmin(world);
  await smartSettle(world.page, 1500);
  return state;
}

/**
 * A user of the `users` registry in cucumber.js (`worldParameters.users`).
 *
 * @param {object} world
 * @param {string} handle
 * @returns {{email: string, password: string, name: string, role: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw fail(`The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      `Add it to worldParameters.users in cucumber.js: ${handle}: { email: '...', password: process.env.SITE_${String(handle).toUpperCase()}_PASSWORD }. The account itself is created by the site build (scripts/seed-site.js), never by a feature.`);
  }
  if (!entry.email || !entry.password) {
    throw fail(`The user "${handle}" needs an email and a password in the users registry.`, `Set worldParameters.users.${handle}.email and .password in cucumber.js.`);
  }
  return entry;
}

/**
 * Call the Admin API with the session of the browser (the cookie the admin
 * itself uses). For reading state and for cleaning up what a scenario made.
 *
 * @param {object} world
 * @param {string} method
 * @param {string} endpoint the path after /ghost/api/admin, starting with a slash
 * @param {object} [data]
 * @returns {Promise<{status: number, json: object|null}>}
 */
async function adminApi(world, method, endpoint, data) {
  const response = await world.page.context().request.fetch(siteRoot(world) + '/ghost/api/admin' + endpoint, {
    method,
    data,
    headers: { Origin: siteRoot(world), 'Content-Type': 'application/json' },
    failOnStatusCode: false,
  });
  let json = null;
  try { json = await response.json(); } catch (error) { /* no body */ }
  return { status: response.status(), json };
}

/** As adminApi, but a refusal is a failure that says to sign in first. */
async function adminApiOrFail(world, method, endpoint, data, purpose) {
  const result = await adminApi(world, method, endpoint, data);
  if (result.status === 401 || result.status === 403) {
    throw fail(`Could not ${purpose}: the Admin API answered ${result.status} to ${method} ${endpoint}.`,
      'This step uses the session of the browser. Sign in first with a user who may do this, for example: Given I am logged in to the admin as "owner".');
  }
  if (result.status >= 400) {
    const reason = result.json && result.json.errors && result.json.errors[0] ? result.json.errors[0].message : '';
    throw fail(`Could not ${purpose}: the Admin API answered ${result.status} to ${method} ${endpoint}. ${reason}`, 'Check the log of the site (content/logs).');
  }
  return result;
}

/** Quote a value for an NQL filter of the Admin API. */
function nql(value) {
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// ---------------------------------------------------------------------------
// Admin: lists, notifications, dialogs
// ---------------------------------------------------------------------------

/** The rows of the list on the screen: posts, pages, tags or members. */
function listItems(world) {
  return world.page.locator('[data-testid="posts-list-item"], [data-testid="tag-list-row"], [data-testid="members-list-item"]');
}

/** The row of the list whose title (post, page), name (tag) or name or e-mail (member) is the text. */
function listItem(world, text) {
  const page = world.page;
  const heading = page.locator('h3').filter({ hasText: exactly(text) });
  const link = page.getByRole('link', { name: text, exact: true });
  const email = page.locator('[data-testid="member-email"]').filter({ hasText: exactly(text) });
  return listItems(world).filter({ has: heading.or(link).or(email) });
}

/** The titles of the rows of the list, for failure messages. */
async function listTitles(world) {
  const items = listItems(world);
  const count = await items.count();
  const titles = [];
  for (let i = 0; i < Math.min(count, 25); i++) {
    const item = items.nth(i);
    const title = await item.locator('h3, td a, [data-testid="member-email"]').first().innerText().catch(() => '');
    titles.push(`"${title.replace(/\s+/g, ' ').trim()}"`);
  }
  return titles.length ? titles.join(', ') + (count > titles.length ? `, and ${count - titles.length} more` : '') : '(an empty list)';
}

/** Wait until the list screen has rendered its rows or its empty state. */
async function waitForList(world) {
  const page = world.page;
  await page.locator('[data-testid="posts-page"], [data-testid="tags-page"], [data-testid="members-page"], main h1').first()
    .waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
  await smartSettle(page, 1500);
}

/** The notifications (toasts) of the admin. */
function notifications(world) {
  return world.page.locator('[data-sonner-toast]');
}

/**
 * The open dialog of the admin: a dialog, an alert dialog (the confirmations)
 * or a panel of the settings (staff profile, navigation, announcement bar),
 * which is a `section` marked `data-testid="...-modal"` without a dialog role.
 */
function dialog(world) {
  return world.page.locator('[role="alertdialog"]:visible, [role="dialog"]:visible, section[data-testid$="-modal"]:visible');
}

// ---------------------------------------------------------------------------
// Admin: the editor
// ---------------------------------------------------------------------------

const EDITOR_HINT = 'This step works in the editor of a post or a page. Open it first: When I start a new post, or When I open the editor of the post "...".';

/** The title field of the editor; fails when the page is not the editor. */
async function editorTitle(world) {
  const title = world.page.getByTestId('editor-title-input');
  try {
    await title.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (error) {
    throw fail(`The editor is not open: no title field at ${world.page.url()}.`, EDITOR_HINT);
  }
  return title;
}

/** The body of the editor (the root of the rich text). */
function editorBody(world) {
  return world.page.locator('[data-testid="editor-body"] [data-lexical-editor="true"]').first();
}

/**
 * The header of the editor hides while somebody types and returns when the
 * pointer moves: move it, the way a person reaches for the buttons.
 */
async function revealEditorHeader(world) {
  const page = world.page;
  await page.mouse.move(40, 300);
  await page.mouse.move(60, 320);
  await page.getByTestId('editor-header-actions').waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
}

/** A button of the editor header (Preview, Publish, Update, Unpublish, Save). */
function editorAction(world, name) {
  return world.page.getByTestId('editor-header-actions').getByRole('button', { name, exact: true });
}

/** The text of the status in the editor header ("Draft - Saved", "Published", ...). */
async function editorStatus(world) {
  return (await world.page.getByTestId('editor-status').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
}

/**
 * Wait until the editor has saved: the status no longer says it is saving and
 * the post has an address of its own (a new post gets one with its first save).
 */
async function waitForEditorSaved(world) {
  // A title is saved when its field is left: leave it the way a person does.
  const inTitle = await world.page.evaluate(() => !!document.activeElement && document.activeElement.getAttribute('data-testid') === 'editor-title-input').catch(() => false);
  if (inTitle) await world.page.keyboard.press('Tab');
  await revealEditorHeader(world);
  const result = await poll(async () => ({ status: await editorStatus(world), route: currentRoute(world) }),
    (state) => state.status !== '' && !/saving|^new$/i.test(state.status) && /^editor\/(post|page)\/[^/]+/.test(state.route), budget(world) * 2);
  if (!result.ok) {
    const state = result.value || {};
    throw fail(`The editor did not finish saving: its status is "${state.status || '(none)'}" at ${world.page.url()}.`,
      'A post is saved a moment after its title or text changes. Check the notifications for an error and that the user may save this post.');
  }
  return result.value.status;
}

/** The settings panel of the editor; opens it when it is closed. */
async function postSettings(world) {
  const page = world.page;
  await editorTitle(world);
  const panel = page.getByTestId('post-settings-sidebar');
  if (!(await panel.isVisible().catch(() => false))) {
    await revealEditorHeader(world);
    await page.getByTestId('settings-menu-toggle').click({ timeout: budget(world) });
    try {
      await panel.waitFor({ state: 'visible', timeout: budget(world) });
    } catch (error) {
      throw fail('The settings panel of the editor did not open.', 'It opens from the "Settings" button at the top right of the editor.');
    }
  }
  return panel;
}

// The cards of the editor: the name in the card menu and the type the card has
// in the document (`data-kg-card`).
const CARD_TYPES = {
  'image': 'image', 'divider': 'horizontalrule', 'button': 'button', 'bookmark': 'bookmark', 'gallery': 'gallery',
  'public preview': 'paywall', 'call to action': 'call-to-action', 'email content': 'email', 'callout': 'callout',
  'signup': 'signup', 'header': 'header', 'toggle': 'toggle', 'video': 'video', 'audio': 'audio', 'file': 'file',
  'product': 'product', 'html': 'html', 'markdown': 'markdown',
};

function cardType(name) {
  const key = String(name).trim().toLowerCase();
  return CARD_TYPES[key] || key;
}

/** The cards of one type in the body of the editor. */
function editorCards(world, name) {
  return world.page.locator(`[data-testid="editor-body"] [data-kg-card="${cardType(name)}"]`);
}

/** Put the cursor in an empty paragraph at the end of the body. */
async function focusEndOfBody(world) {
  const page = world.page;
  const body = editorBody(world);
  await body.waitFor({ state: 'visible', timeout: budget(world) });
  const lastIsEmptyParagraph = await body.evaluate((root) => {
    const last = root.lastElementChild;
    return !!last && last.tagName === 'P' && last.textContent.trim() === '';
  });
  if (lastIsEmptyParagraph) {
    await body.locator(':scope > p').last().click();
    return;
  }
  await body.locator(':scope > *').last().click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
}

// ---------------------------------------------------------------------------
// Front end: the membership and search frames
// ---------------------------------------------------------------------------

/** The membership form (sign up, sign in, account): it renders in a frame of its own. */
function membershipFrame(world) {
  return world.page.frameLocator('iframe[data-testid="portal-popup-frame"]');
}

async function waitForMembershipForm(world) {
  try {
    await world.page.locator('iframe[data-testid="portal-popup-frame"]').waitFor({ state: 'visible', timeout: budget(world) });
    await membershipFrame(world).locator('body *').first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch (error) {
    throw fail('The membership form is not open.', 'Open it first: When I open the membership sign in form, or When I open the membership sign up form. Its script must be allowed to load and memberships must be on.');
  }
  return membershipFrame(world);
}

/** The search of the site: it renders in a frame of its own. */
function searchFrame(world) {
  return world.page.frameLocator('#sodo-search-root iframe');
}

async function waitForSiteSearch(world) {
  try {
    await searchFrame(world).getByRole('combobox').first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch (error) {
    throw fail('The search of the site is not open.', 'Open it first: When I open the site search. The theme needs a search button (data-ghost-search).');
  }
  return searchFrame(world);
}

/** The address of the mailbox that catches the mail of the test site (Mailpit). */
function mailUrl(world) {
  const url = world.parameters && world.parameters.mailUrl;
  if (!url) {
    throw fail('No mailbox is configured.', 'Set worldParameters.mailUrl in cucumber.js to the Mailpit of the test site, for example https://ghoststeps.ddev.site:8026.');
  }
  return String(url).replace(/\/+$/, '');
}

/** The newest e-mail to an address, once it has arrived. */
async function mailTo(world, address) {
  const request = world.page.context().request;
  const base = mailUrl(world);
  const result = await poll(async () => {
    const response = await request.get(`${base}/api/v1/search?query=${encodeURIComponent('to:' + address)}`, { failOnStatusCode: false });
    if (!response.ok()) throw new Error(`the mailbox answered ${response.status()}`);
    return (await response.json()).messages || [];
  }, (messages) => messages.length > 0, budget(world) * 2);
  if (!result.ok) {
    throw fail(`No e-mail to ${address} arrived in the mailbox at ${base} (${Array.isArray(result.value) ? 'it has none for that address' : result.value}).`,
      'The site must send its mail to this mailbox (the "mail" section of its configuration).');
  }
  const message = await (await request.get(`${base}/api/v1/message/${result.value[0].ID}`)).json();
  return { subject: message.Subject || '', text: message.Text || '', html: message.HTML || '' };
}

module.exports = {
  budget, supplied, escapeRegExp, exactly, fail, textsOf, assertPresence, poll,
  siteRoot, siteUrl, adminRoute, adminUrl, currentRoute, userMenuButton, adminShell, signInForm, waitForAdmin, openAdmin,
  resolveUser, adminApi, adminApiOrFail, nql,
  listItems, listItem, listTitles, waitForList, notifications, dialog,
  EDITOR_HINT, editorTitle, editorBody, revealEditorHeader, editorAction, editorStatus, waitForEditorSaved, postSettings,
  cardType, editorCards, focusEndOfBody,
  membershipFrame, waitForMembershipForm, searchFrame, waitForSiteSearch, mailUrl, mailTo,
};
