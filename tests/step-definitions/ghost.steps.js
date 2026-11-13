'use strict';

// The admin as a whole: signing in and out and the session, the admin menu and
// its screens, the user menu, the notifications, the dialogs and the search of
// the admin.
//
// The other step files: ghost-editor.steps.js (posts and pages in the editor,
// the settings panel, the publish flow), ghost-admin.steps.js (the lists and
// their filters, tags, members, staff, settings) and ghost-site.steps.js (the
// front end: archives, navigation, search, the membership form).
//
// Steps that webship-js already covers with its click, fill and see vocabulary
// are not repeated here. Every assertion waits on its locator, and every
// failure says what was expected, what was found and where to look.

const { Given, When, Then } = require('@cucumber/cucumber');
const { smartSettle } = require('webship-js/tests/step-definitions/webship');
const {
  budget, exactly, fail, textsOf, assertPresence, poll,
  adminRoute, currentRoute, userMenuButton, signInForm, waitForAdmin, openAdmin,
  resolveUser, adminApi, notifications, dialog,
} = require('./ghost-helpers');

const SIGN_IN_HINT = 'The accounts are those of worldParameters.users in cucumber.js; the site build creates them (scripts/seed-site.js). A new device must not be asked for a code: the test site sets security.staffDeviceVerification to false.';

/**
 * Fill in the sign in form of the admin and submit it. Leaves the outcome to
 * the caller.
 */
async function submitSignIn(world, email, password) {
  const page = world.page;
  // Somebody may be signed in already: end that session first, then load the
  // admin anew (a change of route alone would keep the app of the old session).
  await adminApi(world, 'DELETE', '/session/').catch(() => {});
  await openAdmin(world, 'signin');
  await page.reload();
  if ((await waitForAdmin(world)) !== 'signin') {
    throw fail(`The sign in form did not show at ${page.url()}: somebody is still signed in.`, 'The session of the browser could not be ended; check that the site answers at /ghost/api/admin/session/.');
  }
  await signInForm(world).first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').first().click();
}

async function signInAs(world, handle) {
  const user = resolveUser(world, handle);
  await submitSignIn(world, user.email, user.password);
  try {
    await userMenuButton(world).first().waitFor({ state: 'visible', timeout: budget(world) * 2 });
  } catch (error) {
    const message = await textsOf(world.page.locator('form p, form [role="alert"]'));
    throw fail(`Could not sign in to the admin as "${handle}" (${user.email}). The form says: ${message}.`, SIGN_IN_HINT);
  }
  await smartSettle(world.page, 1500);
}

// ---------------------------------------------------------------------------
// Signing in and out
// ---------------------------------------------------------------------------

/**
 * Sign in to the admin as a user of the users registry in cucumber.js, through
 * the sign in form. A session that is already open is ended first, so a
 * scenario can change users.
 *
 * Example #1: Given I am logged in to the admin as "owner"
 * Example #2: Given I am logged in to the admin as "editor"
 * Example #3: Given we are logged in to the admin as "author"
 * Example #4: When I log in to the admin as "contributor"
 * Example #5: When we log in to the admin as "administrator"
 *
 */
Given(/^(?:I |we )?(?:am |are )?log(?:ged)? in to the admin as "([^"]*)"$/, async function (handle) {
  await signInAs(this, handle);
});

/**
 * Submit the sign in form of the admin with an e-mail address and a password,
 * without expecting it to succeed: for the scenarios about a wrong password or
 * an unknown address.
 *
 * Example #1: When I try to log in to the admin with the email "owner@example.com" and the password "wrong"
 * Example #2: When I try to log in to the admin with the email "nobody@example.com" and the password "Some-Test-Key-1"
 * Example #3: When we try to log in to the admin with the email "editor@example.com" and the password "x"
 * Example #4: And I try to log in to the admin with the email "author@example.com" and the password "not the one"
 * Example #5: When I try to log in to the admin with the email "" and the password ""
 *
 */
When(/^(?:I |we )?try to log in to the admin with the email "([^"]*)" and the password "([^"]*)"$/, async function (email, password) {
  await submitSignIn(this, email, password);
  await smartSettle(this.page, 1500);
});

/**
 * The message the sign in form shows after a refused attempt.
 *
 * Example #1: Then I should see the sign in error "Your password is incorrect."
 * Example #2: Then I should see the sign in error "There is no user with that email address."
 * Example #3: Then we should see the sign in error "Please fill out the form to sign in."
 * Example #4: And I should see the sign in error "incorrect"
 * Example #5: Then I should see the sign in error "no user"
 *
 */
Then(/^(?:I |we )?should see the sign in error "([^"]*)"$/, async function (message) {
  if (!(await signInForm(this).first().isVisible().catch(() => false))) {
    throw fail(`Expected the sign in error "${message}", but the sign in form is not on the page (${this.page.url()}).`, 'The attempt may have succeeded. Use: When I try to log in to the admin with the email "..." and the password "...".');
  }
  const messages = this.page.locator('p, [role="alert"]');
  await assertPresence(messages.filter({ hasText: message }), null, {
    label: `the sign in error "${message}"`,
    hint: 'The message is shown under the sign in form after a refused attempt.',
    timeout: budget(this),
    found: () => textsOf(messages),
  });
});

/**
 * Sign out of the admin through the user menu, the way a person does, and wait
 * for the sign in form.
 *
 * Example #1: When I log out of the admin
 * Example #2: When we log out of the admin
 * Example #3: And I log out of the admin
 * Example #4: Then I log out of the admin
 * Example #5: When log out of the admin
 *
 */
When(/^(?:I |we )?log out of the admin$/, async function () {
  const page = this.page;
  if ((await waitForAdmin(this)) !== 'app') {
    throw fail('Could not log out of the admin: nobody is signed in.', 'Sign in first: Given I am logged in to the admin as "owner".');
  }
  // The settings and the editor have no user menu: go back to the app first.
  if (!(await userMenuButton(this).first().isVisible().catch(() => false))) {
    await openAdmin(this, 'posts');
    await userMenuButton(this).first().waitFor({ state: 'visible', timeout: budget(this) });
  }
  await userMenuButton(this).first().click();
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click({ timeout: budget(this) });
  await assertPresence(signInForm(this), null, {
    label: 'the sign in form after signing out',
    hint: 'Signing out is the last item of the user menu.',
    timeout: budget(this),
  });
});

/**
 * Whether somebody is signed in to the admin: asked from the Admin API with
 * the session of the browser, and, with a handle, compared with the account of
 * the users registry.
 *
 * Example #1: Then I should be logged in to the admin
 * Example #2: Then I should be logged in to the admin as "owner"
 * Example #3: Then we should be logged in to the admin as "editor"
 * Example #4: Then I should not be logged in to the admin
 * Example #5: And we should not be logged in to the admin
 *
 */
Then(/^(?:I |we )?should( not)? be logged in to the admin(?: as "([^"]*)")?$/, async function (notCase, handle) {
  const result = await poll(() => adminApi(this, 'GET', '/users/me/'), (answer) => (notCase ? answer.status !== 200 : answer.status === 200), budget(this));
  const me = result.value && result.value.json && result.value.json.users ? result.value.json.users[0] : null;
  if (notCase) {
    if (!result.ok) throw fail(`Expected nobody to be signed in to the admin, but ${me ? me.email : 'somebody'} is.`, 'Sign out with: When I log out of the admin.');
    return;
  }
  if (!result.ok) {
    throw fail(`Expected to be signed in to the admin, but the Admin API answered ${result.value && result.value.status} to "who am I".`, SIGN_IN_HINT);
  }
  if (handle) {
    const user = resolveUser(this, handle);
    if (me.email !== user.email) {
      throw fail(`Expected to be signed in to the admin as "${handle}" (${user.email}), but the session belongs to ${me.email}.`, 'Sign in as that user: Given I am logged in to the admin as "' + handle + '".');
    }
  }
});

// ---------------------------------------------------------------------------
// The admin menu and its screens
// ---------------------------------------------------------------------------

/**
 * Open a screen of the admin by its name (Analytics, Posts, Drafts, Scheduled,
 * Published, Pages, Tags, Members, Comments, Settings, Staff, New post, New
 * page, New tag, New member) or by its route after `/ghost/#/`.
 *
 * Example #1: When I go to the admin screen "Posts"
 * Example #2: When I go to the admin screen "Tags"
 * Example #3: When we go to the admin screen "Members"
 * Example #4: Given I am on the admin screen "Drafts"
 * Example #5: Given we are on the admin screen "settings/staff"
 *
 */
When(/^(?:I |we )?(?:go to|am on|are on) the admin screen "([^"]*)"$/, async function (name) {
  const state = await openAdmin(this, adminRoute(name));
  if (state === 'signin') {
    throw fail(`Could not open the admin screen "${name}": the admin asks to sign in.`, 'Sign in first: Given I am logged in to the admin as "owner".');
  }
});

/**
 * The screen of the admin that is open, by the same names as "I go to the
 * admin screen". The route after `/ghost/#/` is compared; with "not", the
 * step passes when the admin is anywhere else.
 *
 * Example #1: Then I should be on the admin screen "Posts"
 * Example #2: Then I should be on the admin screen "Tags"
 * Example #3: Then we should be on the admin screen "Drafts"
 * Example #4: Then I should not be on the admin screen "Settings"
 * Example #5: And I should be on the admin screen "sign in"
 *
 */
Then(/^(?:I |we )?should( not)? be on the admin screen "([^"]*)"$/, async function (notCase, name) {
  const wanted = adminRoute(name).replace(/\/$/, '');
  const matches = (route) => route === wanted || route.split('?')[0] === wanted;
  await waitForAdmin(this);
  const result = await poll(async () => currentRoute(this), (route) => (notCase ? !matches(route) : matches(route)), budget(this));
  if (!result.ok) {
    throw fail(notCase ? `Expected not to be on the admin screen "${name}", but the admin is on "${result.value}".` : `Expected to be on the admin screen "${name}" (route "${wanted}"), but the admin is on "${result.value}".`,
      'The admin sends a user to another screen when their role may not open the one that was asked for.');
  }
});

/**
 * A screen of the admin that the signed-in user may not open: the step asks
 * for it by name or route and passes when the admin sends the user somewhere
 * else instead.
 *
 * Example #1: Then the admin screen "Settings" should not be available
 * Example #2: Then the admin screen "Tags" should not be available
 * Example #3: Then the admin screen "Members" should not be available
 * Example #4: And the admin screen "settings/staff" should not be available
 * Example #5: Then the admin screen "Staff" should not be available
 *
 */
Then(/^the admin screen "([^"]*)" should not be available$/, async function (name) {
  const wanted = adminRoute(name).replace(/\/$/, '');
  if ((await openAdmin(this, wanted)) === 'signin') return;
  const result = await poll(async () => currentRoute(this), (route) => route !== wanted && route.split('?')[0] !== wanted, budget(this));
  if (!result.ok) {
    throw fail(`Expected the admin screen "${name}" not to be available to this user, but it opened (route "${result.value}").`,
      'Check the role of the signed-in user: Contributors and Authors have no tags, members and settings screens.');
  }
});

/**
 * The links of the admin menu (the navigation on the left), by their name.
 *
 * Example #1: Then I should see "Tags" in the admin menu
 * Example #2: Then I should see "Members" in the admin menu
 * Example #3: Then we should see "Settings" in the admin menu
 * Example #4: Then I should not see "Settings" in the admin menu
 * Example #5: And I should not see "Members" in the admin menu
 *
 */
Then(/^(?:I |we )?should( not)? see "([^"]*)" in the admin menu$/, async function (notCase, name) {
  await waitForAdmin(this);
  const menu = this.page.getByRole('navigation').first();
  await assertPresence(menu.getByRole('link', { name, exact: true }), notCase, {
    label: `the link "${name}" in the admin menu`,
    hint: 'The admin menu shows what the role of the signed-in user may open; a Contributor has no menu at all.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(menu.getByRole('link')),
  });
});

/**
 * Click a link of the admin menu by its name and wait for the screen.
 *
 * Example #1: When I click "Posts" in the admin menu
 * Example #2: When I click "Tags" in the admin menu
 * Example #3: When we click "Members" in the admin menu
 * Example #4: And I click "Pages" in the admin menu
 * Example #5: When I click "Drafts" in the admin menu
 *
 */
When(/^(?:I |we )?click "([^"]*)" in the admin menu$/, async function (name) {
  await waitForAdmin(this);
  const menu = this.page.getByRole('navigation').first();
  const link = menu.getByRole('link', { name, exact: true });
  if (!(await link.count())) {
    throw fail(`The admin menu has no link "${name}". It has: ${await textsOf(menu.getByRole('link'))}.`, 'Use the name the menu shows. A Contributor has no menu: use "I go to the admin screen" instead.');
  }
  await link.first().click();
  await smartSettle(this.page, 1500);
});

/**
 * What the user menu (bottom of the admin menu) shows once it is open: the
 * name and the e-mail address of the signed-in user and its items. The step
 * opens the menu when it is closed.
 *
 * Example #1: Then the user menu should show "owner@example.com"
 * Example #2: Then the user menu should show "Olivia Owner"
 * Example #3: Then the user menu should show "Sign out"
 * Example #4: And the user menu should show "Your profile"
 * Example #5: Then the user menu should show "editor@example.com"
 *
 */
Then(/^the user menu should show "([^"]*)"$/, async function (text) {
  const menu = this.page.getByRole('menu', { name: /user menu/i });
  if (!(await menu.isVisible().catch(() => false))) {
    await waitForAdmin(this);
    await userMenuButton(this).first().click();
  }
  await assertPresence(menu.getByText(text).first(), null, {
    label: `"${text}" in the user menu`,
    hint: 'The user menu opens from the button with the name of the user, at the bottom of the admin menu.',
    timeout: budget(this),
    found: () => textsOf(menu),
  });
});

// ---------------------------------------------------------------------------
// Notifications, field errors and dialogs
// ---------------------------------------------------------------------------

/**
 * A notification of the admin (the short message that appears at the bottom
 * after saving, deleting or a failure), by a part of its text.
 *
 * Example #1: Then I should see the notification "Post updated"
 * Example #2: Then I should see the notification "Member created"
 * Example #3: Then we should see the notification "Post reverted to a draft."
 * Example #4: Then I should not see the notification "Post updated"
 * Example #5: And I should see the notification "was deleted"
 *
 */
Then(/^(?:I |we )?should( not)? see the notification "([^"]*)"$/, async function (notCase, text) {
  await assertPresence(notifications(this).filter({ hasText: text }), notCase, {
    label: `the notification "${text}"`,
    hint: 'Notifications stay a few seconds: assert them right after the action that raises them.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(notifications(this)),
  });
});

/**
 * Close the notifications that are showing, so the next assertion does not
 * read an old one.
 *
 * Example #1: When I dismiss the notifications
 * Example #2: When we dismiss the notifications
 * Example #3: And I dismiss the notifications
 * Example #4: Then I dismiss the notifications
 * Example #5: When dismiss the notifications
 *
 */
When(/^(?:I |we )?dismiss the notifications$/, async function () {
  const toasts = notifications(this);
  for (let i = 0; i < 10 && (await toasts.count()); i++) {
    const toast = toasts.first();
    await toast.hover().catch(() => {});
    await toast.getByRole('button', { name: 'Close toast' }).click({ timeout: 2000 }).catch(() => {});
    await toast.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
  }
  await toasts.first().waitFor({ state: 'hidden', timeout: budget(this) }).catch(() => {});
});

/**
 * The error a form of the admin shows next to a field after a refused save.
 *
 * Example #1: Then I should see the field error "You must specify a name for the tag."
 * Example #2: Then I should see the field error "Please enter a site title."
 * Example #3: Then we should see the field error "site title"
 * Example #4: Then I should not see the field error "Please enter a site title."
 * Example #5: And I should see the field error "name for the tag"
 *
 */
Then(/^(?:I |we )?should( not)? see the field error "([^"]*)"$/, async function (notCase, text) {
  // Field errors are alerts next to the field (data-slot="field-error"); the notifications are not.
  const errors = this.page.locator('[role="alert"]:not([data-sonner-toast] *)');
  await assertPresence(errors.filter({ hasText: text }), notCase, {
    label: `the field error "${text}"`,
    hint: 'Field errors appear under the field once the form was saved or the field was left.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(errors),
  });
});

/**
 * The dialog the admin has open (a confirmation, the publish dialog, a
 * settings dialog), by its title or a part of its text.
 *
 * Example #1: Then I should see the dialog "Are you sure you want to delete this post?"
 * Example #2: Then I should see the dialog "Delete member account"
 * Example #3: Then we should see the dialog "Invite a new staff user"
 * Example #4: Then I should not see the dialog "Are you sure you want to delete this post?"
 * Example #5: And I should see the dialog "This is permanent"
 *
 */
Then(/^(?:I |we )?should( not)? see the dialog "([^"]*)"$/, async function (notCase, text) {
  await assertPresence(dialog(this).filter({ hasText: text }), notCase, {
    label: `the dialog "${text}"`,
    hint: 'A dialog opens after the button that asks for it; a confirmation names what it is about to do.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(dialog(this).locator('h1, h2, h3')),
  });
});

/**
 * Press a button of the open dialog by its name and wait for the admin to
 * settle: "Delete" to confirm, "Cancel" or "Close" to leave.
 *
 * Example #1: When I answer the dialog with "Delete"
 * Example #2: When I answer the dialog with "Cancel"
 * Example #3: When we answer the dialog with "Close"
 * Example #4: And I answer the dialog with "Delete member"
 * Example #5: When I answer the dialog with "Send invitation"
 *
 */
When(/^(?:I |we )?answer the dialog with "([^"]*)"$/, async function (name) {
  const open = dialog(this);
  try {
    await open.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`Could not answer the dialog with "${name}": no dialog is open.`, 'Open it first with the button that asks for it.');
  }
  const button = open.getByRole('button', { name, exact: true });
  if (!(await button.count())) {
    throw fail(`The open dialog has no button "${name}". It has: ${await textsOf(open.getByRole('button'))}.`, 'Use the name the button shows.');
  }
  await button.last().click();
  await smartSettle(this.page, 1500);
});

// ---------------------------------------------------------------------------
// The action menus
// ---------------------------------------------------------------------------

/**
 * Open a menu of the admin by the name of its button ("Actions" on a member,
 * "Tag actions" on a tag, "Member actions" above the members, "User menu")
 * and choose one of its items. The items are menu items, not buttons or
 * links, so the click steps of webship-js do not reach them.
 *
 * Example #1: When I choose "Delete member" from the "Actions" menu
 * Example #2: When I choose "Delete tag" from the "Tag actions" menu
 * Example #3: When we choose "View posts" from the "Tag actions" menu
 * Example #4: And I choose "Your profile" from the "User menu" menu
 * Example #5: When I choose "Export all members" from the "Member actions" menu
 *
 */
When(/^(?:I |we )?choose "([^"]*)" from the "([^"]*)" menu$/, async function (item, name) {
  const page = this.page;
  await waitForAdmin(this);
  const menu = page.getByRole('menu');
  if (!(await menu.first().isVisible().catch(() => false))) {
    const label = name.replace(/"/g, '');
    const button = page.locator(`button[aria-label="${label}"], button[aria-label="Open ${label.toLowerCase()}"]`).or(page.getByRole('button', { name, exact: true }));
    if (!(await button.first().isVisible().catch(() => false))) {
      throw fail(`The screen has no "${name}" menu button (the admin is on "${currentRoute(this)}").`, 'A member has "Actions", a tag "Tag actions" (once it is saved), the members list "Member actions", the admin menu "User menu".');
    }
    await button.first().click();
    try {
      await menu.first().waitFor({ state: 'visible', timeout: budget(this) });
    } catch (error) {
      throw fail(`The "${name}" button did not open a menu.`, 'Use the name of a button that opens a menu.');
    }
  }
  const entry = menu.getByRole('menuitem', { name: item, exact: true });
  if (!(await entry.count())) {
    throw fail(`The "${name}" menu has no item "${item}". It has: ${await textsOf(menu.getByRole('menuitem'))}.`, 'Use the name the menu shows.');
  }
  await entry.first().click();
  await smartSettle(page, 1500);
});

// ---------------------------------------------------------------------------
// The search of the admin
// ---------------------------------------------------------------------------

function adminSearch(world) {
  return world.page.getByRole('dialog', { name: 'Search site' });
}

/**
 * Open the search of the admin (the "Search site" button of the admin menu)
 * and type a query. The results are posts, pages, tags and staff users.
 *
 * Example #1: When I search the admin for "Travel diary 3"
 * Example #2: When I search the admin for "Guides"
 * Example #3: When we search the admin for "Contact"
 * Example #4: And I search the admin for "Arthur"
 * Example #5: When I search the admin for "nothing like this"
 *
 */
When(/^(?:I |we )?search the admin for "([^"]*)"$/, async function (query) {
  const page = this.page;
  await waitForAdmin(this);
  const search = adminSearch(this);
  if (!(await search.isVisible().catch(() => false))) {
    const button = page.getByRole('button', { name: /^Search site/ });
    if (!(await button.count())) {
      throw fail('The admin has no search button on this screen.', 'The search is in the admin menu; a Contributor has no menu and no search.');
    }
    await button.first().click();
  }
  const input = search.getByRole('combobox');
  await input.waitFor({ state: 'visible', timeout: budget(this) });
  await input.fill(query);
  await smartSettle(page, 1500);
});

/**
 * A result of the admin search, by its exact title.
 *
 * Example #1: Then I should see the admin search result "Travel diary 3"
 * Example #2: Then I should see the admin search result "Guides"
 * Example #3: Then we should see the admin search result "Contact"
 * Example #4: Then I should not see the admin search result "Travel diary 4"
 * Example #5: And I should not see the admin search result "An unfinished draft"
 *
 */
Then(/^(?:I |we )?should( not)? see the admin search result "([^"]*)"$/, async function (notCase, title) {
  const search = adminSearch(this);
  if (!(await search.isVisible().catch(() => false))) {
    throw fail('The search of the admin is not open.', 'Search first: When I search the admin for "...".');
  }
  await assertPresence(search.getByRole('option').filter({ hasText: exactly(title) }), notCase, {
    label: `the admin search result "${title}"`,
    hint: 'The search matches titles and names; a user sees only what their role may open.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(search.getByRole('option')),
  });
});

/**
 * Open a result of the admin search by its exact title.
 *
 * Example #1: When I open the admin search result "Travel diary 3"
 * Example #2: When I open the admin search result "Guides"
 * Example #3: When we open the admin search result "Contact"
 * Example #4: And I open the admin search result "Welcome to the test site"
 * Example #5: When I open the admin search result "News"
 *
 */
When(/^(?:I |we )?open the admin search result "([^"]*)"$/, async function (title) {
  const search = adminSearch(this);
  const option = search.getByRole('option').filter({ hasText: exactly(title) });
  try {
    await option.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The admin search has no result "${title}". It has: ${await textsOf(search.getByRole('option'))}.`, 'Search first: When I search the admin for "...".');
  }
  await option.first().click();
  await search.waitFor({ state: 'hidden', timeout: budget(this) }).catch(() => {});
  await smartSettle(this.page, 1500);
});
