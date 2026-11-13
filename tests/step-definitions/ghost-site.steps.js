'use strict';

// The front end of the site, as the platform renders it for any theme: the
// kind of page (home, post, page, tag and author archives), the pages of an
// archive, the post feed, the navigation, the announcement bar, the search of
// the site, the membership form (sign up, sign in, account) and the mailbox
// the test site sends its mail to.
//
// The steps read what the platform itself puts on the page whatever the theme:
// the classes of <body>, the links of <head>, the data attributes that open the
// search and the membership form, and the frames those two render in.

const { Given, When, Then } = require('@cucumber/cucumber');
const { gotoUrl, smartSettle } = require('webship-js/tests/step-definitions/webship');
const {
  budget, exactly, fail, textsOf, assertPresence, poll, siteRoot,
  membershipFrame, waitForMembershipForm, searchFrame, waitForSiteSearch, mailUrl, mailTo,
} = require('./ghost-helpers');

async function bodyClasses(world) {
  return (await world.page.locator('body').getAttribute('class').catch(() => '')) || '';
}

// ---------------------------------------------------------------------------
// The kind of page
// ---------------------------------------------------------------------------

/**
 * The beginning of the generator the page declares in its
 * `<meta name="generator">`: the platform and its version.
 *
 * Example #1: Then the page generator should start with "Ghost"
 * Example #2: Then the page generator should start with "Ghost 6"
 * Example #3: Then the page generator should start with "Ghost 6.77"
 * Example #4: And the page generator should start with "Ghost 6."
 * Example #5: But the page generator should start with "Ghost "
 *
 */
Then(/^the page generator should start with "([^"]*)"$/, async function (prefix) {
  const meta = this.page.locator('meta[name="generator"]');
  const result = await poll(async () => ((await meta.count()) ? await meta.first().getAttribute('content') : null), (content) => typeof content === 'string' && content.startsWith(prefix), budget(this));
  if (!result.ok) {
    throw fail(`Expected the generator of the page to start with "${prefix}", found ${result.value === null ? 'no <meta name="generator">' : `"${result.value}"`} at ${this.page.url()}.`, 'The front end declares its generator in <head>; the admin does not.');
  }
});

const PAGE_KINDS = {
  'the home page': 'home-template',
  'a post': 'post-template',
  'a page': 'page-template',
  'a tag archive': 'tag-template',
  'an author archive': 'author-template',
};

/**
 * The kind of page the front end rendered: the home page, a post, a page, a
 * tag archive or an author archive. Read from the classes the platform puts
 * on `<body>` for every theme.
 *
 * Example #1: Then the page should be the home page
 * Example #2: Then the page should be a post
 * Example #3: Then the page should be a page
 * Example #4: Then the page should be a tag archive
 * Example #5: Then the page should not be an author archive
 *
 */
Then(/^the page should( not)? be (the home page|a post|a page|a tag archive|an author archive)$/, async function (notCase, kind) {
  const wanted = PAGE_KINDS[kind];
  const result = await poll(() => bodyClasses(this), (classes) => classes.split(/\s+/).includes(wanted) === !notCase, notCase ? 3000 : budget(this));
  if (!result.ok) {
    throw fail(`Expected the page ${notCase ? 'not ' : ''}to be ${kind} (class "${wanted}" on <body>), but <body> has "${result.value}" at ${this.page.url()}.`, 'The theme must print {{body_class}} on <body>, as every theme does.');
  }
});

/**
 * The archive the front end rendered: the tag archive or the author archive
 * of a slug.
 *
 * Example #1: Then the page should be the tag archive of "guides"
 * Example #2: Then the page should be the author archive of "arthur"
 * Example #3: Then the page should be the tag archive of "news"
 * Example #4: And the page should be the author archive of "edith"
 * Example #5: And the page should be the tag archive of "travel"
 *
 */
Then(/^the page should be the (tag|author) archive of "([^"]*)"$/, async function (type, slug) {
  const wanted = [`${type}-template`, `${type}-${slug}`];
  const result = await poll(() => bodyClasses(this), (classes) => wanted.every((name) => classes.split(/\s+/).includes(name)), budget(this));
  if (!result.ok) {
    throw fail(`Expected the ${type} archive of "${slug}" (classes "${wanted.join(' ')}" on <body>), but <body> has "${result.value}" at ${this.page.url()}.`, `The archive is at /${type}/${slug}/.`);
  }
});

// ---------------------------------------------------------------------------
// The pages of an archive
// ---------------------------------------------------------------------------

async function archiveLink(world, direction) {
  const link = world.page.locator(`head link[rel="${direction === 'next' ? 'next' : 'prev'}"]`);
  return (await link.count()) ? link.first().getAttribute('href') : null;
}

/**
 * The page of the archive (the home page, a tag or an author archive) the
 * visitor is on: page 1 is the archive itself, the later pages are at
 * `/page/N/`.
 *
 * Example #1: Then the archive should be on page 1
 * Example #2: Then the archive should be on page 2
 * Example #3: Then the archive should be on page 3
 * Example #4: And the archive should be on page 2
 * Example #5: And the archive should be on page 1
 *
 */
Then(/^the archive should be on page (\d+)$/, async function (number) {
  const wanted = Number(number);
  const read = async () => {
    const match = /\/page\/(\d+)\/?$/.exec(new URL(this.page.url()).pathname);
    return { page: match ? Number(match[1]) : 1, paged: (await bodyClasses(this)).split(/\s+/).includes('paged') };
  };
  const result = await poll(read, (state) => state.page === wanted && state.paged === (wanted > 1), budget(this));
  if (!result.ok) {
    throw fail(`Expected page ${wanted} of the archive, but the address is ${this.page.url()} (page ${result.value.page}) and <body> is ${result.value.paged ? '' : 'not '}marked "paged".`, 'The pages after the first are at /page/N/ and carry the class "paged" on <body>.');
  }
});

/**
 * Whether the archive has a next or a previous page, as the page declares it
 * in `<head>` (`<link rel="next">`, `<link rel="prev">`).
 *
 * Example #1: Then the archive should have a next page
 * Example #2: Then the archive should have a previous page
 * Example #3: Then the archive should not have a next page
 * Example #4: Then the archive should not have a previous page
 * Example #5: And the archive should have a next page
 *
 */
Then(/^the archive should( not)? have a (next|previous) page$/, async function (notCase, direction) {
  const result = await poll(() => archiveLink(this, direction), (href) => (notCase ? !href : !!href), notCase ? 3000 : budget(this));
  if (!result.ok) {
    throw fail(notCase ? `Expected no ${direction} page of the archive, but the page links to ${result.value}.` : `Expected a ${direction} page of the archive, but ${this.page.url()} declares none.`,
      'An archive has more pages when it has more posts than the theme shows per page.');
  }
});

/**
 * Go to the next or the previous page of the archive, by the address the
 * page declares in `<head>`.
 *
 * Example #1: When I go to the next page of the archive
 * Example #2: When I go to the previous page of the archive
 * Example #3: When we go to the next page of the archive
 * Example #4: And I go to the previous page of the archive
 * Example #5: And we go to the next page of the archive
 *
 */
When(/^(?:I |we )?go to the (next|previous) page of the archive$/, async function (direction) {
  const href = await archiveLink(this, direction);
  if (!href) throw fail(`The archive at ${this.page.url()} has no ${direction} page.`, 'An archive has more pages when it has more posts than the theme shows per page.');
  await gotoUrl(this.page, href);
  await smartSettle(this.page, 1500);
});

// ---------------------------------------------------------------------------
// The post feed, the navigation and the announcement bar
// ---------------------------------------------------------------------------

function feedPosts(world) {
  return world.page.locator('article').filter({ has: world.page.locator('h1, h2, h3, h4') });
}

/**
 * A post in the post feed of the page (the home page or an archive), by its
 * exact title. A post of the feed is an `<article>` with a heading.
 *
 * Example #1: Then I should see the post "Welcome to the test site" in the post feed
 * Example #2: Then I should see the post "A guide to writing" in the post feed
 * Example #3: Then I should not see the post "An unfinished draft" in the post feed
 * Example #4: And we should see the post "Travel diary 8" in the post feed
 * Example #5: And I should not see the post "News from the north" in the post feed
 *
 */
Then(/^(?:I |we )?should( not)? see the post "([^"]*)" in the post feed$/, async function (notCase, title) {
  const posts = feedPosts(this);
  await assertPresence(posts.filter({ has: this.page.locator('h1, h2, h3, h4').filter({ hasText: exactly(title) }) }), notCase, {
    label: `the post "${title}" in the post feed`,
    hint: 'The feed lists published posts, newest first, a page at a time.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(posts.locator('h1, h2, h3, h4'), 30),
  });
});

/**
 * How many posts the post feed of the page lists.
 *
 * Example #1: Then the post feed should have 2 posts
 * Example #2: Then the post feed should have 10 posts
 * Example #3: Then the post feed should have 1 post
 * Example #4: And the post feed should have 5 posts
 * Example #5: And the post feed should have 0 posts
 *
 */
Then(/^the post feed should have (\d+) posts?$/, async function (count) {
  const wanted = Number(count);
  const posts = feedPosts(this);
  const result = await poll(() => posts.count(), (found) => found === wanted, budget(this));
  if (!result.ok) {
    throw fail(`Expected ${wanted} post(s) in the post feed, found ${result.value}: ${await textsOf(posts.locator('h1, h2, h3, h4'), 30)}.`, 'The feed lists the published posts of the archive, a page at a time.');
  }
});

/**
 * A link of the navigation of the site, by its exact label. The navigation is
 * what the theme prints inside `<nav>` or the page header.
 *
 * Example #1: Then I should see "Home" in the site navigation
 * Example #2: Then I should see "About" in the site navigation
 * Example #3: Then I should not see "Docs" in the site navigation
 * Example #4: And we should see "Docs" in the site navigation
 * Example #5: And I should not see "Elsewhere" in the site navigation
 *
 */
Then(/^(?:I |we )?should( not)? see "([^"]*)" in the site navigation$/, async function (notCase, label) {
  const links = this.page.locator('nav a:visible, header a:visible');
  await assertPresence(links.filter({ hasText: exactly(label) }), notCase, {
    label: `the link "${label}" in the navigation of the site`,
    hint: 'The links come from the navigation settings; on a narrow screen the theme may fold them into a menu.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(links, 30),
  });
});

/**
 * The announcement bar at the top of the front end, by a part of its text.
 *
 * Example #1: Then I should see the announcement "A sale from the suite"
 * Example #2: Then I should not see the announcement "A sale from the suite"
 * Example #3: Then we should see the announcement "Back soon"
 * Example #4: And I should see the announcement "New season"
 * Example #5: And I should not see the announcement "Thank you"
 *
 */
Then(/^(?:I |we )?should( not)? see the announcement "([^"]*)"$/, async function (notCase, text) {
  const bar = this.page.locator('#announcement-bar-root .gh-announcement-bar');
  await assertPresence(bar.filter({ hasText: text }), notCase, {
    label: `the announcement "${text}"`,
    hint: 'The announcement bar shows to the groups chosen in its settings; a visitor who closed it does not see it again in the same session.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(bar),
  });
});

// ---------------------------------------------------------------------------
// The search of the site
// ---------------------------------------------------------------------------

/**
 * Open the search of the site with the search button of the theme
 * (`data-ghost-search`).
 *
 * Example #1: When I open the site search
 * Example #2: When we open the site search
 * Example #3: And I open the site search
 * Example #4: Given I open the site search
 * Example #5: When open the site search
 *
 */
When(/^(?:I |we )?open the site search$/, async function () {
  const button = this.page.locator('[data-ghost-search]:visible');
  try {
    await button.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The page has no visible search button at ${this.page.url()}.`, 'The theme opens the search from an element marked data-ghost-search.');
  }
  await button.first().click();
  await waitForSiteSearch(this);
});

/**
 * Type a query in the search of the site; the step opens the search when it
 * is closed. The results are posts, tags and authors.
 *
 * Example #1: When I search the site for "Travel diary 3"
 * Example #2: When I search the site for "Guides"
 * Example #3: When we search the site for "Arthur"
 * Example #4: And I search the site for "nothing like this"
 * Example #5: And we search the site for "welcome"
 *
 */
When(/^(?:I |we )?search the site for "([^"]*)"$/, async function (query) {
  if (!(await this.page.locator('#sodo-search-root iframe').count())) {
    await this.page.locator('[data-ghost-search]:visible').first().click({ timeout: budget(this) });
  }
  const search = await waitForSiteSearch(this);
  await search.getByRole('combobox').first().fill(query);
  await smartSettle(this.page, 1500);
});

/**
 * A result of the search of the site, by its exact title or name.
 *
 * Example #1: Then I should see the site search result "Travel diary 3"
 * Example #2: Then I should see the site search result "Guides"
 * Example #3: Then I should not see the site search result "An unfinished draft"
 * Example #4: And we should see the site search result "Arthur Author"
 * Example #5: And I should not see the site search result "Travel diary 4"
 *
 */
Then(/^(?:I |we )?should( not)? see the site search result "([^"]*)"$/, async function (notCase, title) {
  const search = await waitForSiteSearch(this);
  const results = search.getByRole('option');
  const titles = async () => results.evaluateAll((options) => options.map((option) => (([...option.children].find((child) => child.getAttribute('aria-hidden') !== 'true') || option).textContent || '').replace(/\s+/g, ' ').trim()));
  const result = await poll(titles, (found) => found.includes(title) === !notCase, notCase ? 3000 : budget(this));
  if (!result.ok) {
    throw fail(`Expected ${notCase ? 'no' : 'a'} site search result "${title}". The results: ${(result.value || []).map((name) => `"${name}"`).join(', ') || '(none)'}.`, 'The search matches the titles and the text of published posts, and the names of tags and authors.');
  }
});

/**
 * Open a result of the search of the site, by its exact title or name.
 *
 * Example #1: When I open the site search result "Travel diary 3"
 * Example #2: When I open the site search result "Guides"
 * Example #3: When we open the site search result "Arthur Author"
 * Example #4: And I open the site search result "Welcome to the test site"
 * Example #5: And we open the site search result "News"
 *
 */
When(/^(?:I |we )?open the site search result "([^"]*)"$/, async function (title) {
  const search = await waitForSiteSearch(this);
  const results = search.getByRole('option');
  await results.first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
  const index = await results.evaluateAll((options, wanted) => options.findIndex((option) => (([...option.children].find((child) => child.getAttribute('aria-hidden') !== 'true') || option).textContent || '').replace(/\s+/g, ' ').trim() === wanted), title);
  if (index < 0) throw fail(`The site search has no result "${title}". It has: ${await textsOf(results)}.`, 'Search first: When I search the site for "...".');
  await results.nth(index).click();
  await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  await smartSettle(this.page, 1500);
});

/**
 * Close the search of the site.
 *
 * Example #1: When I close the site search
 * Example #2: When we close the site search
 * Example #3: And I close the site search
 * Example #4: Then I close the site search
 * Example #5: When close the site search
 *
 */
When(/^(?:I |we )?close the site search$/, async function () {
  const search = await waitForSiteSearch(this);
  await search.getByRole('combobox').first().press('Escape');
  await this.page.locator('#sodo-search-root iframe').waitFor({ state: 'detached', timeout: budget(this) }).catch(() => {});
  if (await this.page.locator('#sodo-search-root iframe').count()) throw fail('The search of the site did not close.', 'It closes with the Escape key or its "Cancel" button.');
});

// ---------------------------------------------------------------------------
// The membership form
// ---------------------------------------------------------------------------

const MEMBERSHIP_PAGES = { 'sign in': 'signin', 'sign up': 'signup', 'account': 'account' };

/**
 * Open the membership form of the site: the sign in form, the sign up form
 * or the account of the signed-in member. The step presses the button the
 * theme offers for it (`data-portal`), or asks for the form by its address
 * when the theme has none.
 *
 * Example #1: When I open the membership sign in form
 * Example #2: When I open the membership sign up form
 * Example #3: When I open the membership account form
 * Example #4: When we open the membership sign in form
 * Example #5: And I open the membership sign up form
 *
 */
When(/^(?:I |we )?open the membership (sign in|sign up|account) form$/, async function (which) {
  const page = this.page;
  const target = MEMBERSHIP_PAGES[which];
  const trigger = page.locator(`[data-portal="${target}"]:visible`);
  await trigger.first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  if (await trigger.count()) {
    await trigger.first().click();
  } else {
    await page.evaluate((name) => { window.location.hash = '#/portal/' + name; }, target);
  }
  await waitForMembershipForm(this);
});

/**
 * Fill in a field of the membership form, by its label ("Name", "Email").
 *
 * Example #1: When I fill in "Email" with "member@example.com" in the membership form
 * Example #2: When I fill in "Name" with "Nora Newcomer" in the membership form
 * Example #3: When we fill in "Email" with "newcomer@example.com" in the membership form
 * Example #4: And I fill in "Email" with "not-an-address" in the membership form
 * Example #5: And I fill in "Name" with "" in the membership form
 *
 */
When(/^(?:I |we )?fill in "([^"]*)" with "([^"]*)" in the membership form$/, async function (label, value) {
  const form = await waitForMembershipForm(this);
  const field = form.getByRole('textbox', { name: label, exact: true });
  if (!(await field.count())) throw fail(`The membership form has no field "${label}". It has: ${(await form.getByRole('textbox').evaluateAll((fields) => fields.map((field) => field.getAttribute('aria-label') || field.name).join(', '))) || '(no fields)'}.`, 'The sign in form has "Email"; the sign up form has "Name" and "Email".');
  await field.fill(value);
});

/**
 * Submit the membership form with its main button ("Continue", "Sign up").
 *
 * Example #1: When I submit the membership form
 * Example #2: When we submit the membership form
 * Example #3: And I submit the membership form
 * Example #4: Then I submit the membership form
 * Example #5: When submit the membership form
 *
 */
When(/^(?:I |we )?submit the membership form$/, async function () {
  const form = await waitForMembershipForm(this);
  await form.locator('button[type="submit"]').first().click({ timeout: budget(this) });
  await smartSettle(this.page, 1500);
});

/**
 * A text in (or, with "not", absent from) the membership form: its heading,
 * a validation message, or what it reports after it was submitted.
 *
 * Example #1: Then the membership form should show "Sign in"
 * Example #2: Then the membership form should show "Enter your email address"
 * Example #3: Then the membership form should show "Now check your email!"
 * Example #4: Then the membership form should not show "Now check your email!"
 * Example #5: And the membership form should show "Your account"
 *
 */
Then(/^the membership form should( not)? show "([^"]*)"$/, async function (notCase, text) {
  const form = await waitForMembershipForm(this);
  await assertPresence(form.getByText(text).first(), notCase, {
    label: `"${text}" in the membership form`,
    hint: 'The form validates its fields when it is submitted and reports what it did in the same frame.',
    timeout: notCase ? 3000 : budget(this),
    found: async () => `the text "${(await form.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}"`,
  });
});

/**
 * Close the membership form.
 *
 * Example #1: When I close the membership form
 * Example #2: When we close the membership form
 * Example #3: And I close the membership form
 * Example #4: Then I close the membership form
 * Example #5: When close the membership form
 *
 */
When(/^(?:I |we )?close the membership form$/, async function () {
  const form = await waitForMembershipForm(this);
  await form.getByRole('button', { name: 'Close popup' }).click();
  await this.page.locator('iframe[data-testid="portal-popup-frame"]').waitFor({ state: 'detached', timeout: budget(this) }).catch(() => {});
});

/**
 * Whether the front end offers to subscribe: a visible button or link that
 * opens the sign up form (`data-portal="signup"`).
 *
 * Example #1: Then I should see a subscribe button
 * Example #2: Then I should not see a subscribe button
 * Example #3: Then we should see a subscribe button
 * Example #4: And I should see a subscribe button
 * Example #5: And we should not see a subscribe button
 *
 */
Then(/^(?:I |we )?should( not)? see a subscribe button$/, async function (notCase) {
  await assertPresence(this.page.locator('[data-portal="signup"]:visible'), notCase, {
    label: 'a subscribe button (data-portal="signup")',
    hint: 'Themes show it to visitors and hide it from signed-in members.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Whether the post on the page is held back for members: the platform prints
 * a call to subscribe in place of the text a visitor may not read.
 *
 * Example #1: Then the post should be restricted to members
 * Example #2: Then the post should not be restricted to members
 * Example #3: And the post should be restricted to members
 * Example #4: And the post should not be restricted to members
 * Example #5: But the post should not be restricted to members
 *
 */
Then(/^the post should( not)? be restricted to members$/, async function (notCase) {
  await assertPresence(this.page.locator('.gh-post-upgrade-cta'), notCase, {
    label: 'the call to subscribe that replaces the text of a members-only post',
    hint: 'A post with the access "Members only" shows it to visitors; a signed-in member reads the text instead.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Whether the visitor is signed in as a member, asked from the site with the
 * session of the browser. With an address, the signed-in member is compared
 * with it.
 *
 * Example #1: Then I should be signed in as a member
 * Example #2: Then I should not be signed in as a member
 * Example #3: Then I should be signed in as the member "member@example.com"
 * Example #4: And we should not be signed in as a member
 * Example #5: And I should be signed in as the member "vera@example.com"
 *
 */
Then(/^(?:I |we )?should( not)? be signed in as (?:a member|the member "([^"]*)")$/, async function (notCase, email) {
  const request = this.page.context().request;
  const read = async () => {
    const response = await request.get(siteRoot(this) + '/members/api/member/', { failOnStatusCode: false });
    if (response.status() !== 200) return null;
    return (await response.json().catch(() => null)) || null;
  };
  const result = await poll(read, (member) => (notCase ? !member : !!member && (!email || member.email === email)), budget(this));
  if (!result.ok) {
    const who = result.value && result.value.email ? `the member ${result.value.email} is signed in` : 'nobody is signed in';
    throw fail(`Expected ${notCase ? 'no member' : email ? `the member ${email}` : 'a member'} to be signed in, but ${who}.`, 'A member signs in with the link the site e-mails: When I follow the link e-mailed to "...".');
  }
});

/**
 * Sign out as a member, from the account of the membership form.
 *
 * Example #1: When I sign out as a member
 * Example #2: When we sign out as a member
 * Example #3: And I sign out as a member
 * Example #4: Then I sign out as a member
 * Example #5: When sign out as a member
 *
 */
When(/^(?:I |we )?sign out as a member$/, async function () {
  const page = this.page;
  if (!(await page.locator('iframe[data-testid="portal-popup-frame"]').count())) {
    await page.evaluate(() => { window.location.hash = '#/portal/account'; });
  }
  const form = await waitForMembershipForm(this);
  const out = form.getByRole('button', { name: /sign out|logout/i });
  try {
    await out.first().click({ timeout: budget(this) });
  } catch (error) {
    throw fail('The membership form has no "Sign out" button: nobody is signed in as a member.', 'Sign in first with the link the site e-mails.');
  }
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await smartSettle(page, 1500);
});

// ---------------------------------------------------------------------------
// The mailbox of the test site
// ---------------------------------------------------------------------------

/**
 * Empty the mailbox that catches the mail of the test site
 * (`worldParameters.mailUrl`, a Mailpit), so the next e-mail is the one the
 * scenario caused.
 *
 * Example #1: Given the mailbox is empty
 * Example #2: And the mailbox is empty
 * Example #3: When the mailbox is empty
 * Example #4: But the mailbox is empty
 * Example #5: * the mailbox is empty
 *
 */
Given(/^the mailbox is empty$/, async function () {
  const response = await this.page.context().request.delete(mailUrl(this) + '/api/v1/messages', { failOnStatusCode: false });
  if (!response.ok()) throw fail(`The mailbox at ${mailUrl(this)} answered ${response.status()} when asked to empty.`, 'worldParameters.mailUrl must be the address of the Mailpit of the test site.');
});

/**
 * An e-mail the site sent to an address, by a part of its subject. The step
 * waits for the e-mail to arrive in the mailbox of the test site.
 *
 * Example #1: Then an e-mail with the subject "Sign in to Test site" should have been sent to "member@example.com"
 * Example #2: Then an e-mail with the subject "Complete your sign up" should have been sent to "newcomer@example.com"
 * Example #3: Then an e-mail with the subject "Sign in" should have been sent to "vera@example.com"
 * Example #4: And an e-mail with the subject "Test site" should have been sent to "member@example.com"
 * Example #5: And an e-mail with the subject "sign up" should have been sent to "nora@example.com"
 *
 */
Then(/^an e-mail with the subject "([^"]*)" should have been sent to "([^"]*)"$/, async function (subject, address) {
  const mail = await mailTo(this, address);
  if (!mail.subject.toLowerCase().includes(subject.toLowerCase())) {
    throw fail(`Expected an e-mail to ${address} with "${subject}" in its subject; the newest one is "${mail.subject}".`, 'Empty the mailbox before the action that sends the e-mail: Given the mailbox is empty.');
  }
});

/**
 * Follow the link of the newest e-mail the site sent to an address: the sign
 * in link of a member, or the link that completes a sign up. The e-mail is
 * read from the mailbox of the test site, never from a real one.
 *
 * Example #1: When I follow the link e-mailed to "member@example.com"
 * Example #2: When I follow the link e-mailed to "newcomer@example.com"
 * Example #3: When we follow the link e-mailed to "vera@example.com"
 * Example #4: And I follow the link e-mailed to "member@example.com"
 * Example #5: And we follow the link e-mailed to "nora@example.com"
 *
 */
When(/^(?:I |we )?follow the link e-mailed to "([^"]*)"$/, async function (address) {
  const mail = await mailTo(this, address);
  const root = siteRoot(this).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(root + '/members/\\?token=[^\\s"\'<>)]+').exec(mail.text) || new RegExp(root + '/members/\\?token=[^\\s"\'<>)]+').exec(mail.html.replace(/&amp;/g, '&'));
  if (!match) {
    throw fail(`The e-mail "${mail.subject}" to ${address} has no membership link of ${siteRoot(this)}.`, 'The sign in and sign up e-mails link to /members/?token=...');
  }
  await gotoUrl(this.page, match[0]);
  await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  await smartSettle(this.page, 1500);
});

/**
 * Sign in as a member with the code of the sign in e-mail instead of its
 * link: the step reads the six digits from the newest e-mail to the address,
 * types them in the "Code" field of the membership form and submits it. The
 * form closes once the code is accepted.
 *
 * Example #1: When I enter the code e-mailed to "member@example.com" in the membership form
 * Example #2: When I enter the code e-mailed to "vera@example.com" in the membership form
 * Example #3: When we enter the code e-mailed to "noel@example.com" in the membership form
 * Example #4: And I enter the code e-mailed to "member@example.com" in the membership form
 * Example #5: When I enter the code e-mailed to "suite.member@example.com" in the membership form
 *
 */
When(/^(?:I |we )?enter the code e-mailed to "([^"]*)" in the membership form$/, async function (address) {
  const form = await waitForMembershipForm(this);
  const field = form.getByRole('textbox', { name: 'Code', exact: true });
  if (!(await field.isVisible().catch(() => false))) {
    throw fail('The membership form has no "Code" field.', 'It shows after the sign in form is submitted: When I fill in "Email" with "..." in the membership form, and When I submit the membership form.');
  }
  const mail = await mailTo(this, address);
  const match = /code\D{0,40}(\d{6})\b/i.exec(mail.subject) || /code\D{0,40}(\d{6})\b/i.exec(mail.text);
  if (!match) {
    throw fail(`The e-mail "${mail.subject}" to ${address} carries no six-digit code.`, 'The sign in e-mail has the code in its subject and its text; the sign up e-mail has a link only: When I follow the link e-mailed to "...".');
  }
  await field.fill(match[1]);
  // The form submits by itself once six digits are in; press the button when it is still there.
  await form.locator('button[type="submit"]').first().click({ timeout: 2000 }).catch(() => {});
  const frame = this.page.locator('iframe[data-testid="portal-popup-frame"]');
  const result = await poll(async () => (await frame.count()) === 0 || !(await field.isVisible().catch(() => false)), (closed) => closed, budget(this) * 2);
  if (!result.ok) {
    const said = (await form.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
    throw fail(`The code ${match[1]} e-mailed to ${address} was not accepted. The form says: "${said}".`, 'A code works once and for the newest sign in request only: empty the mailbox before asking for it.');
  }
  await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  await smartSettle(this.page, 1500);
});

/**
 * The short notification the membership script shows at the top of the page
 * after a sign up or sign in link was followed. It renders in a frame of its
 * own and disappears after a few seconds.
 *
 * Example #1: Then the membership notification should say "You've successfully subscribed to"
 * Example #2: Then the membership notification should say "successfully subscribed"
 * Example #3: Then the membership notification should say "Test site"
 * Example #4: And the membership notification should say "You've successfully signed in"
 * Example #5: Then the membership notification should say "subscribed"
 *
 */
Then(/^the membership notification should say "([^"]*)"$/, async function (text) {
  const frame = this.page.frameLocator('iframe[data-testid="portal-notification-frame"]');
  const body = frame.locator('body');
  const result = await poll(async () => (await body.innerText()).replace(/\s+/g, ' ').trim(), (said) => said.includes(text), budget(this));
  if (!result.ok) {
    throw fail(`Expected the membership notification to say "${text}", found ${typeof result.value === 'string' && result.value && !/Timeout|locator/.test(result.value) ? `"${result.value}"` : 'no notification'} at ${this.page.url()}.`,
      'The notification follows a sign up or sign in link (When I follow the link e-mailed to "...") and goes away after a few seconds: assert it right after.');
  }
});
