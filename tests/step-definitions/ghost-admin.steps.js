'use strict';

// The management screens of the admin: the lists of posts, pages, tags and
// members with their filters, sorting and search; tags; members and their
// labels; staff users and their roles; and the settings (sections, navigation
// links, the announcement bar).
//
// Staff accounts are configuration: no step here creates or deletes a staff
// user. Tags, members, navigation links and the announcement a scenario makes
// are removed with the "there is no ..." steps, which ask the Admin API with
// the session of the browser.

const { Given, When, Then } = require('@cucumber/cucumber');
const { smartSettle } = require('webship-js/tests/step-definitions/webship');
const {
  budget, supplied, exactly, fail, textsOf, assertPresence, poll,
  currentRoute, waitForAdmin, openAdmin, adminApiOrFail, nql,
  listItems, listItem, listTitles, waitForList, dialog,
} = require('./ghost-helpers');

const SIGNED_IN_HINT = 'Sign in first with a user who may open this screen: Given I am logged in to the admin as "owner".';

async function openOrFail(world, route, what) {
  if ((await openAdmin(world, route)) === 'signin') {
    throw fail(`Could not open ${what}: the admin asks to sign in.`, SIGNED_IN_HINT);
  }
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/**
 * A row of the list on the screen, by the exact title of the post or page,
 * the name of the tag, or the name or e-mail address of the member.
 *
 * Example #1: Then I should see the post "Welcome to the test site" in the list
 * Example #2: Then I should not see the post "A post from the suite" in the list
 * Example #3: Then I should see the page "Contact" in the list
 * Example #4: Then we should see the tag "Guides" in the list
 * Example #5: And I should see the member "member@example.com" in the list
 *
 */
Then(/^(?:I |we )?should( not)? see the (post|page|tag|member) "([^"]*)" in the list$/, async function (notCase, type, title) {
  await waitForList(this);
  await assertPresence(listItem(this, title), notCase, {
    label: `the ${type} "${title}" in the list`,
    hint: 'The list shows what the filters and the role of the user allow: an Author and a Contributor see only their own posts.',
    timeout: notCase ? 3000 : budget(this),
    found: () => listTitles(this),
  });
});

/**
 * The status the list shows for a post or page: "Draft", "Published" or
 * "Scheduled".
 *
 * Example #1: Then the post "Welcome to the test site" should have the status "Published" in the list
 * Example #2: Then the post "An unfinished draft" should have the status "Draft" in the list
 * Example #3: Then the page "Contact" should have the status "Published" in the list
 * Example #4: And the post "A post from the suite" should have the status "Scheduled" in the list
 * Example #5: Then the page "A page from the suite" should have the status "Draft" in the list
 *
 */
Then(/^the (post|page) "([^"]*)" should have the status "([^"]*)" in the list$/, async function (type, title, status) {
  await waitForList(this);
  const item = listItem(this, title);
  try {
    await item.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The list has no ${type} titled "${title}". It lists: ${await listTitles(this)}.`, 'Check the title, the filters and the signed-in user.');
  }
  const statuses = item.first().locator('p');
  const result = await poll(() => statuses.allInnerTexts(), (texts) => texts.some((text) => text.trim().toLowerCase().startsWith(status.toLowerCase())), budget(this));
  if (!result.ok) {
    throw fail(`Expected the ${type} "${title}" to have the status "${status}" in the list, found: ${result.value.map((text) => `"${text.trim()}"`).join(', ')}.`, 'The status is the last line of the row: Draft, Published or Scheduled.');
  }
});

/**
 * How many rows the list on the screen has, once it has loaded.
 *
 * Example #1: Then the list should have 3 posts
 * Example #2: Then the list should have 2 pages
 * Example #3: Then the list should have 3 tags
 * Example #4: Then the list should have 1 member
 * Example #5: And the list should have 0 posts
 *
 */
Then(/^the list should have (\d+) (?:items?|posts?|pages?|tags?|members?)$/, async function (count) {
  await waitForList(this);
  const wanted = Number(count);
  const result = await poll(() => listItems(this).count(), (found) => found === wanted, budget(this));
  if (!result.ok) {
    throw fail(`Expected ${wanted} row(s) in the list, found ${result.value}: ${await listTitles(this)}.`, 'The list shows what the filters and the role of the user allow; a long list loads more rows as it scrolls.');
  }
});

/**
 * The first row of the list, by its title or name: for checking the sorting.
 *
 * Example #1: Then the first row of the list should be "Welcome to the test site"
 * Example #2: Then the first row of the list should be "Travel diary 8"
 * Example #3: Then the first row of the list should be "Guides"
 * Example #4: And the first row of the list should be "Contact"
 * Example #5: Then the first row of the list should be "Mary Member"
 *
 */
Then(/^the first row of the list should be "([^"]*)"$/, async function (title) {
  await waitForList(this);
  const first = listItems(this).first();
  const read = async () => (await first.locator('h3, td a').first().innerText()).replace(/\s+/g, ' ').trim();
  const result = await poll(read, (found) => found === title, budget(this));
  if (!result.ok) {
    throw fail(`Expected the first row of the list to be "${title}", found "${result.value}". The list: ${await listTitles(this)}.`, 'Check the sorting: When I sort the list by "Oldest first".');
  }
});

/**
 * Add a filter to the list of posts, pages or members: the name of the
 * filter ("Post type", "Access", "Author", "Tag", "Label") and the value to
 * pick ("Draft posts", "Members-only", "Arthur Author", "News"). A filter
 * without a value, such as "Featured", takes no value.
 *
 * Example #1: When I filter the list by "Tag" with "News"
 * Example #2: When I filter the list by "Author" with "Arthur Author"
 * Example #3: When I filter the list by "Access" with "Members-only"
 * Example #4: When I filter the list by "Post type" with "Draft posts"
 * Example #5: When we filter the list by "Featured"
 *
 */
When(/^(?:I |we )?filter the list by "([^"]*)"(?: with "([^"]*)")?$/, async function (name, value) {
  const page = this.page;
  await waitForList(this);
  const add = page.locator('main').getByRole('button', { name: /^(Filter|Add filter)$/ });
  if (!(await add.count())) throw fail('This screen has no filters.', 'Posts, pages and members have a "Filter" button above the list.');
  await add.first().click();
  const options = page.getByRole('option');
  const filter = page.getByRole('option', { name, exact: true });
  try {
    await filter.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The list has no filter "${name}". It has: ${await textsOf(options, 20)}.`, 'Use the name the filter menu shows.');
  }
  await filter.first().click();
  // "Featured" has no list of values: it applies as it is chosen.
  if (supplied(value)) {
    const choice = page.getByRole('option', { name: value, exact: true });
    try {
      await choice.first().waitFor({ state: 'visible', timeout: budget(this) });
    } catch (error) {
      throw fail(`The filter "${name}" has no value "${value}". It has: ${await textsOf(options, 20)}.`, 'Use the name the list of values shows, for example "Draft posts" or "Members-only".');
    }
    await choice.first().click();
  }
  // The list of values stays open for more choices: close it.
  if (await options.first().isVisible().catch(() => false)) await page.keyboard.press('Escape');
  await smartSettle(page, 1500);
  await waitForList(this);
});

/**
 * Remove every filter of the list with its "Clear" button.
 *
 * Example #1: When I clear the list filters
 * Example #2: When we clear the list filters
 * Example #3: And I clear the list filters
 * Example #4: Then I clear the list filters
 * Example #5: When clear the list filters
 *
 */
When(/^(?:I |we )?clear the list filters$/, async function () {
  const clear = this.page.locator('main').getByRole('button', { name: 'Clear', exact: true });
  if (!(await clear.count())) throw fail('The list has no filter to clear.', 'The "Clear" button shows next to the filters once one is set.');
  await clear.first().click();
  await clear.first().waitFor({ state: 'hidden', timeout: budget(this) }).catch(() => {});
  await smartSettle(this.page, 1500);
});

/**
 * Sort the list of posts or pages: "Newest first", "Oldest first" or
 * "Recently updated".
 *
 * Example #1: When I sort the list by "Oldest first"
 * Example #2: When I sort the list by "Newest first"
 * Example #3: When we sort the list by "Recently updated"
 * Example #4: And I sort the list by "Oldest first"
 * Example #5: And we sort the list by "Newest first"
 *
 */
When(/^(?:I |we )?sort the list by "([^"]*)"$/, async function (order) {
  const page = this.page;
  await waitForList(this);
  const sort = page.getByRole('combobox', { name: /^Sort/ });
  if (!(await sort.count())) throw fail('This screen has no sorting.', 'Posts and pages have a "Sort" field above the list.');
  await sort.first().click();
  const option = page.getByRole('option', { name: order, exact: true });
  if (!(await option.count())) {
    throw fail(`The list cannot be sorted by "${order}". It offers: ${await textsOf(page.getByRole('option'))}.`, 'Use the name the list shows.');
  }
  await option.click();
  await assertPresence(sort.filter({ hasText: exactly(order) }), null, { label: `the sorting "${order}"`, hint: 'The chosen order shows in the Sort field.', timeout: budget(this) });
  await smartSettle(page, 1500);
});

/**
 * Open a tag or a member from its list, by the name of the tag or the name or
 * e-mail address of the member.
 *
 * Example #1: When I open the tag "Guides" from the list
 * Example #2: When I open the member "member@example.com" from the list
 * Example #3: When we open the tag "News" from the list
 * Example #4: And I open the member "Vera Visitor" from the list
 * Example #5: And I open the tag "A tag from the suite" from the list
 *
 */
When(/^(?:I |we )?open the (tag|member) "([^"]*)" from the list$/, async function (type, name) {
  await waitForList(this);
  const item = listItem(this, name);
  try {
    await item.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The list has no ${type} "${name}". It lists: ${await listTitles(this)}.`, `Open the list first: When I go to the admin screen "${type === 'tag' ? 'Tags' : 'Members'}".`);
  }
  await item.first().getByRole('link').first().click();
  const result = await poll(async () => currentRoute(this), (route) => new RegExp('^' + type + 's/[^/?]+').test(route), budget(this));
  if (!result.ok) throw fail(`The ${type} "${name}" did not open: the admin is on "${result.value}".`, 'The name in the row links to the detail screen.');
  await smartSettle(this.page, 1500);
});

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

async function tagField(world, label) {
  const names = { name: 'Name', slug: 'Slug', description: 'Description' };
  const form = world.page.getByTestId('tag-detail-form');
  try {
    await form.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (error) {
    throw fail(`No tag is open (the admin is on "${currentRoute(world)}").`, 'Open one first: When I go to the admin screen "New tag", or When I open the tag "..." from the list.');
  }
  return form.getByRole('textbox', { name: names[label], exact: true });
}

/**
 * Fill in a field of the tag that is open: its name, slug or description.
 *
 * Example #1: When I set the tag name to "A tag from the suite"
 * Example #2: When I set the tag slug to "suite-tag"
 * Example #3: When I set the tag description to "Made by the suite."
 * Example #4: When we set the tag name to ""
 * Example #5: And I set the tag description to "Another description."
 *
 */
When(/^(?:I |we )?set the tag (name|slug|description) to "([^"]*)"$/, async function (label, value) {
  const field = await tagField(this, label);
  await field.fill(value);
  await field.press('Tab');
});

/**
 * A field of the tag that is open: its name, slug or description.
 *
 * Example #1: Then the tag name should be "Guides"
 * Example #2: Then the tag slug should be "guides"
 * Example #3: Then the tag description should be "How to do things."
 * Example #4: And the tag slug should be "a-tag-from-the-suite"
 * Example #5: Then the tag name should be "A tag from the suite"
 *
 */
Then(/^the tag (name|slug|description) should be "([^"]*)"$/, async function (label, value) {
  const field = await tagField(this, label);
  const result = await poll(() => field.inputValue(), (found) => found === value, budget(this));
  if (!result.ok) throw fail(`Expected the tag ${label} "${value}", found "${result.value}".`, 'The slug follows the name until it is set by hand.');
});

/**
 * Save the tag that is open. The step waits for the answer of the site and
 * leaves the outcome (the tag screen, or a field error) to the next step.
 *
 * Example #1: When I save the tag
 * Example #2: When we save the tag
 * Example #3: And I save the tag
 * Example #4: Then I save the tag
 * Example #5: When save the tag
 *
 */
When(/^(?:I |we )?save the tag$/, async function () {
  await tagField(this, 'name');
  const save = this.page.locator('main').getByRole('button', { name: 'Save', exact: true });
  await save.first().click({ timeout: budget(this) });
  await smartSettle(this.page, 1500);
});

/**
 * Delete the tag that is open, through its actions menu and the confirmation.
 * The step ends on the list of tags.
 *
 * Example #1: When I delete the tag
 * Example #2: When we delete the tag
 * Example #3: And I delete the tag
 * Example #4: Then I delete the tag
 * Example #5: When delete the tag
 *
 */
When(/^(?:I |we )?delete the tag$/, async function () {
  const page = this.page;
  await tagField(this, 'name');
  const actions = page.getByRole('button', { name: 'Tag actions' });
  if (!(await actions.count())) throw fail('The tag has no actions menu: it is not saved yet.', 'Save it first: When I save the tag.');
  await actions.click();
  await page.getByRole('menuitem', { name: 'Delete tag' }).click({ timeout: budget(this) });
  await dialog(this).getByRole('button', { name: 'Delete', exact: true }).click({ timeout: budget(this) });
  const result = await poll(async () => currentRoute(this), (route) => /^tags(\?|$)/.test(route), budget(this) * 2);
  if (!result.ok) throw fail(`The tag was not deleted: the admin is still on "${result.value}".`, 'Check the notifications for an error.');
  await waitForList(this);
});

/**
 * How many posts the list of tags reports for a tag.
 *
 * Example #1: Then the tag "Guides" should have 2 posts
 * Example #2: Then the tag "Travel" should have 10 posts
 * Example #3: Then the tag "News" should have 5 posts
 * Example #4: And the tag "A tag from the suite" should have 0 posts
 * Example #5: Then the tag "Guides" should have 1 post
 *
 */
Then(/^the tag "([^"]*)" should have (\d+) posts?$/, async function (name, count) {
  await waitForList(this);
  const row = listItem(this, name);
  try {
    await row.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The list of tags has no tag "${name}". It lists: ${await listTitles(this)}.`, 'Open it first: When I go to the admin screen "Tags".');
  }
  const cell = row.first().getByRole('cell').last();
  const wanted = Number(count);
  const result = await poll(async () => (await cell.innerText()).trim(), (text) => Number((/^(\d+)/.exec(text) || [])[1]) === wanted, budget(this));
  if (!result.ok) throw fail(`Expected the tag "${name}" to have ${wanted} post(s), the list says "${result.value}".`, 'The last column of the list of tags counts the posts of each tag.');
});

/**
 * Make sure no tag with a name exists: for the start of a scenario that
 * creates one and for cleaning up after it. It asks the Admin API with the
 * session of the browser and passes when there is nothing to delete.
 *
 * Example #1: Given there is no tag named "A tag from the suite"
 * Example #2: Given there is no tag named "Another tag"
 * Example #3: And there is no tag named "Suite"
 * Example #4: Then there is no tag named "A tag from the suite"
 * Example #5: Given there is no tag named "Temporary"
 *
 */
Given(/^there is no tag named "([^"]*)"$/, async function (name) {
  const found = await adminApiOrFail(this, 'GET', `/tags/?limit=all&filter=${encodeURIComponent('name:' + nql(name))}`, undefined, `look for the tag "${name}"`);
  for (const tag of found.json.tags || []) {
    await adminApiOrFail(this, 'DELETE', `/tags/${tag.id}/`, undefined, `delete the tag "${name}"`);
  }
  if (/^tags(\?|$)/.test(currentRoute(this)) && (found.json.tags || []).length) {
    await this.page.reload();
    await waitForAdmin(this);
    await waitForList(this);
  }
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

async function memberForm(world) {
  const form = world.page.getByTestId('member-detail-form');
  try {
    await form.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (error) {
    throw fail(`No member is open (the admin is on "${currentRoute(world)}").`, 'Open one first: When I go to the admin screen "New member", or When I open the member "..." from the list.');
  }
  return form;
}

/**
 * Search the list of members by a name or an e-mail address.
 *
 * Example #1: When I search the members for "Vera"
 * Example #2: When I search the members for "member@example.com"
 * Example #3: When we search the members for "Noel"
 * Example #4: And I search the members for "nobody at all"
 * Example #5: When I search the members for "example.com"
 *
 */
When(/^(?:I |we )?search the members for "([^"]*)"$/, async function (query) {
  const page = this.page;
  if (!/^members(\?|$)/.test(currentRoute(this))) await openOrFail(this, 'members', 'the members');
  await waitForList(this);
  const box = page.locator('main').getByRole('textbox', { name: /search/i }).or(page.locator('main input[type="search"], main input[placeholder*="Search" i]'));
  if (!(await box.first().isVisible().catch(() => false))) {
    await page.locator('main').getByRole('button', { name: 'Search members' }).click({ timeout: budget(this) });
  }
  await box.first().fill(query);
  const result = await poll(async () => currentRoute(this), (route) => route.includes('search='), budget(this));
  if (!result.ok) throw fail(`The members were not searched for "${query}": the admin is on "${result.value}".`, 'The search field opens from the "Search members" button above the list.');
  await smartSettle(page, 1500);
});

/**
 * Fill in a field of the member that is open: the name, the e-mail address
 * or the note.
 *
 * Example #1: When I set the member name to "Suite Member"
 * Example #2: When I set the member email to "suite.member@example.com"
 * Example #3: When I set the member note to "Made by the suite."
 * Example #4: When we set the member email to "not-an-address"
 * Example #5: And I set the member name to "Another Name"
 *
 */
When(/^(?:I |we )?set the member (name|email|note) to "([^"]*)"$/, async function (label, value) {
  const names = { name: /^Name$/, email: /^Email$/, note: /^Note/ };
  const form = await memberForm(this);
  const field = form.getByRole('textbox', { name: names[label] });
  await field.fill(value);
  await field.press('Tab');
});

/**
 * Add a label to the member that is open: an existing label is picked from
 * the list, a new name creates the label.
 *
 * Example #1: When I add the label "Reader" to the member
 * Example #2: When I add the label "Friend" to the member
 * Example #3: When we add the label "Reader" to the member
 * Example #4: And I add the label "Friend" to the member
 * Example #5: And we add the label "Supporter" to the member
 *
 */
When(/^(?:I |we )?add the label "([^"]*)" to the member$/, async function (name) {
  const page = this.page;
  const form = await memberForm(this);
  const input = form.getByRole('combobox', { name: 'Labels' });
  await input.click();
  await input.fill(name);
  const option = page.getByRole('option').filter({ hasText: new RegExp('^\\s*(Create [“"])?' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[”"]?\\s*$') });
  try {
    await option.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The Labels field offers no "${name}". It offers: ${await textsOf(page.getByRole('option'))}.`, 'The label may be on the member already.');
  }
  await option.first().click();
  await assertPresence(form.getByRole('button', { name: `Remove ${name}`, exact: true }), null, { label: `the label "${name}" on the member`, hint: 'A chosen label shows as a chip in the Labels field.', timeout: budget(this) });
  await page.keyboard.press('Escape');
});

/**
 * Whether the member that is open has a label.
 *
 * Example #1: Then the member should have the label "Reader"
 * Example #2: Then the member should have the label "Friend"
 * Example #3: Then the member should not have the label "Friend"
 * Example #4: And the member should not have the label "Reader"
 * Example #5: And the member should have the label "Supporter"
 *
 */
Then(/^the member should( not)? have the label "([^"]*)"$/, async function (notCase, name) {
  const form = await memberForm(this);
  const field = form.getByTestId('member-labels-field');
  await assertPresence(field.getByRole('button', { name: `Remove ${name}`, exact: true }), notCase, {
    label: `the label "${name}" on the member`,
    hint: 'The labels of a member are the chips of the Labels field.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(field.getByRole('button')),
  });
});

/**
 * Whether the member that is open can be saved: the "Save" button is disabled
 * until the form has a change and a valid e-mail address.
 *
 * Example #1: Then the member should be ready to save
 * Example #2: Then the member should not be ready to save
 * Example #3: And the member should be ready to save
 * Example #4: And the member should not be ready to save
 * Example #5: But the member should not be ready to save
 *
 */
Then(/^the member should( not)? be ready to save$/, async function (notCase) {
  await memberForm(this);
  const save = this.page.locator('main').getByRole('button', { name: 'Save', exact: true }).first();
  const result = await poll(() => save.isEnabled(), (enabled) => (notCase ? !enabled : enabled), budget(this));
  if (!result.ok) {
    throw fail(notCase ? 'Expected the "Save" button of the member to be disabled, but it is enabled.' : 'Expected the "Save" button of the member to be enabled, but it is disabled.',
      'The button is enabled once the form has a change and the e-mail address is valid.');
  }
});

/**
 * Save the member that is open and wait for the site to confirm it.
 *
 * Example #1: When I save the member
 * Example #2: When we save the member
 * Example #3: And I save the member
 * Example #4: Then I save the member
 * Example #5: When save the member
 *
 */
When(/^(?:I |we )?save the member$/, async function () {
  await memberForm(this);
  const save = this.page.locator('main').getByRole('button', { name: 'Save', exact: true }).first();
  const enabled = await poll(() => save.isEnabled(), (value) => value, budget(this));
  if (!enabled.ok) throw fail('The member cannot be saved: the "Save" button is disabled.', 'It needs a change and a valid e-mail address.');
  await save.click();
  const result = await poll(async () => ({ route: currentRoute(this), enabled: await save.isEnabled().catch(() => false) }), (state) => /^members\/(?!new)[^/?]+/.test(state.route) && !state.enabled, budget(this) * 2);
  if (!result.ok) throw fail(`The member was not saved: the admin is on "${result.value.route}".`, 'Check the notifications for an error (an e-mail address can belong to one member only).');
});

/**
 * Delete the member that is open, through the actions menu and the
 * confirmation. The step ends on the list of members.
 *
 * Example #1: When I delete the member
 * Example #2: When we delete the member
 * Example #3: And I delete the member
 * Example #4: Then I delete the member
 * Example #5: When delete the member
 *
 */
When(/^(?:I |we )?delete the member$/, async function () {
  const page = this.page;
  await memberForm(this);
  const actions = page.locator('main').getByRole('button', { name: 'Actions', exact: true });
  if (!(await actions.count())) throw fail('The member has no actions menu: it is not saved yet.', 'Save it first: When I save the member.');
  await actions.click();
  await page.getByRole('menuitem', { name: 'Delete member' }).click({ timeout: budget(this) });
  await dialog(this).getByRole('button', { name: 'Delete member', exact: true }).click({ timeout: budget(this) });
  const result = await poll(async () => currentRoute(this), (route) => /^members(\?|$)/.test(route), budget(this) * 2);
  if (!result.ok) throw fail(`The member was not deleted: the admin is still on "${result.value}".`, 'Check the notifications for an error.');
  await waitForList(this);
});

/**
 * Make sure no member with an e-mail address exists: for the start of a
 * scenario that creates one and for cleaning up after it. It asks the Admin
 * API with the session of the browser and passes when there is nothing to
 * delete.
 *
 * Example #1: Given there is no member with the email "suite.member@example.com"
 * Example #2: Given there is no member with the email "newcomer@example.com"
 * Example #3: And there is no member with the email "another@example.com"
 * Example #4: Then there is no member with the email "suite.member@example.com"
 * Example #5: Given there is no member with the email "temporary@example.com"
 *
 */
Given(/^there is no member with the email "([^"]*)"$/, async function (email) {
  const found = await adminApiOrFail(this, 'GET', `/members/?limit=all&filter=${encodeURIComponent('email:' + nql(email))}`, undefined, `look for the member ${email}`);
  for (const member of found.json.members || []) {
    await adminApiOrFail(this, 'DELETE', `/members/${member.id}/`, undefined, `delete the member ${email}`);
  }
  if (/^members(\?|$)/.test(currentRoute(this)) && (found.json.members || []).length) {
    await this.page.reload();
    await waitForAdmin(this);
    await waitForList(this);
  }
});

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const STAFF_TABS = { administrator: 'Administrators', editor: 'Editors', author: 'Authors', contributor: 'Contributors' };

async function staffSection(world) {
  const section = world.page.getByTestId('users');
  if (!(await section.isVisible().catch(() => false))) {
    await openOrFail(world, 'settings/staff', 'the staff settings');
    try {
      await section.waitFor({ state: 'visible', timeout: budget(world) });
    } catch (error) {
      throw fail(`The staff settings did not open (the admin is on "${currentRoute(world)}").`, 'Only the Owner, Administrators and Editors see the staff.');
    }
  }
  return section;
}

/**
 * A staff user in the staff settings, under the role the settings list them
 * with: Owner, Administrator, Editor, Author or Contributor.
 *
 * Example #1: Then I should see the staff user "Arthur Author" with the role "Author"
 * Example #2: Then I should see the staff user "Olivia Owner" with the role "Owner"
 * Example #3: Then I should see the staff user "Edith Editor" with the role "Editor"
 * Example #4: Then I should not see the staff user "Arthur Author" with the role "Editor"
 * Example #5: And I should see the staff user "Connie Contributor" with the role "Contributor"
 *
 */
Then(/^(?:I |we )?should( not)? see the staff user "([^"]*)" with the role "([^"]*)"$/, async function (notCase, name, role) {
  const section = await staffSection(this);
  const key = role.trim().toLowerCase();
  let people;
  if (key === 'owner') {
    people = section.getByTestId('owner-user');
  } else if (STAFF_TABS[key]) {
    await section.getByRole('tab', { name: new RegExp('^' + STAFF_TABS[key]) }).click();
    people = section.getByRole('tabpanel').getByTestId('user-list-item');
  } else {
    throw fail(`"${role}" is not a staff role.`, 'The roles are Owner, Administrator, Editor, Author and Contributor.');
  }
  await assertPresence(people.filter({ hasText: name }), notCase, {
    label: `the staff user "${name}" with the role "${role}"`,
    hint: 'The staff settings list the users under a tab per role; the Owner is shown above the tabs.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(people),
  });
});

/**
 * Open the profile of a staff user from the staff settings, by their name.
 *
 * Example #1: When I open the staff user "Arthur Author"
 * Example #2: When I open the staff user "Edith Editor"
 * Example #3: When we open the staff user "Connie Contributor"
 * Example #4: And I open the staff user "Adam Administrator"
 * Example #5: And we open the staff user "Olivia Owner"
 *
 */
When(/^(?:I |we )?open the staff user "([^"]*)"$/, async function (name) {
  const section = await staffSection(this);
  const person = () => section.locator('[data-testid="owner-user"], [data-testid="user-list-item"]').filter({ hasText: name });
  if (!(await person().count())) {
    for (const tab of Object.values(STAFF_TABS)) {
      await section.getByRole('tab', { name: new RegExp('^' + tab) }).click();
      if (await person().count()) break;
    }
  }
  if (!(await person().count())) throw fail(`The staff settings list no user "${name}".`, 'Use the full name the staff settings show.');
  await person().first().click();
  await assertPresence(this.page.getByTestId('user-detail-modal'), null, { label: `the profile of the staff user "${name}"`, hint: 'The profile opens over the settings.', timeout: budget(this) });
});

/**
 * A field of the staff profile that is open: the e-mail address, the role,
 * the full name or the slug.
 *
 * Example #1: Then the staff user email should be "author@example.com"
 * Example #2: Then the staff user role should be "Author"
 * Example #3: Then the staff user full name should be "Arthur Author"
 * Example #4: Then the staff user slug should be "arthur"
 * Example #5: And the staff user role should be "Editor"
 *
 */
Then(/^the staff user (email|role|full name|slug) should be "([^"]*)"$/, async function (label, value) {
  const profile = this.page.getByTestId('user-detail-modal');
  if (!(await profile.isVisible().catch(() => false))) throw fail('No staff profile is open.', 'Open one first: When I open the staff user "...".');
  const names = { email: 'Email', 'full name': 'Full name', slug: 'Slug' };
  const read = label === 'role'
    ? async () => (await profile.getByRole('combobox', { name: 'Role' }).innerText()).trim()
    : () => profile.getByRole('textbox', { name: names[label], exact: true }).inputValue();
  const result = await poll(read, (found) => found === value, budget(this));
  if (!result.ok) throw fail(`Expected the staff user ${label} "${value}", found "${result.value}".`, 'The fields are on the "Profile" tab of the staff profile.');
});

/**
 * Close the staff profile without saving.
 *
 * Example #1: When I close the staff user
 * Example #2: When we close the staff user
 * Example #3: And I close the staff user
 * Example #4: Then I close the staff user
 * Example #5: When close the staff user
 *
 */
When(/^(?:I |we )?close the staff user$/, async function () {
  const profile = this.page.getByTestId('user-detail-modal');
  if (!(await profile.isVisible().catch(() => false))) throw fail('No staff profile is open.', 'Open one first: When I open the staff user "...".');
  await profile.getByRole('button', { name: 'Close', exact: true }).click();
  await profile.waitFor({ state: 'hidden', timeout: budget(this) });
});

/**
 * The roles the staff invitation offers to the signed-in user. The step opens
 * the invitation dialog and reads it; it sends nothing. Close the dialog with
 * "I answer the dialog with "Close"".
 *
 * Example #1: Then the staff invitation should offer the role "Contributor"
 * Example #2: Then the staff invitation should offer the role "Author"
 * Example #3: Then the staff invitation should offer the role "Editor"
 * Example #4: Then the staff invitation should offer the role "Administrator"
 * Example #5: And the staff invitation should not offer the role "Administrator"
 *
 */
Then(/^the staff invitation should( not)? offer the role "([^"]*)"$/, async function (notCase, role) {
  const invitation = this.page.getByRole('dialog', { name: 'Invite a new staff user' });
  if (!(await invitation.isVisible().catch(() => false))) {
    const section = await staffSection(this);
    await section.getByRole('button', { name: 'Invite people' }).click();
    await invitation.waitFor({ state: 'visible', timeout: budget(this) });
  }
  await assertPresence(invitation.getByRole('radio', { name: role, exact: true }), notCase, {
    label: `the role "${role}" in the staff invitation`,
    hint: 'An Editor may invite Authors and Contributors only.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(invitation.getByRole('radiogroup').locator('label, [role="radio"]')),
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** The section of the settings with a heading, such as "Title & description". */
async function settingsSection(world, title) {
  const page = world.page;
  if (!/^settings/.test(currentRoute(world))) await openOrFail(world, 'settings', 'the settings');
  const heading = page.locator('h5').filter({ hasText: exactly(title) });
  try {
    await heading.first().waitFor({ state: 'attached', timeout: budget(world) });
  } catch (error) {
    throw fail(`The settings have no section "${title}". They have: ${await textsOf(page.locator('h5'), 40)}.`, 'Use the heading the settings show. Only the Owner and Administrators see all the settings.');
  }
  const section = heading.first().locator('xpath=ancestor::*[@data-testid][1]');
  await section.scrollIntoViewIfNeeded().catch(() => {});
  return section;
}

/**
 * Go to a section of the settings through the menu of the settings, by the
 * name the menu shows: "Title & description", "Staff", "Navigation",
 * "Announcement bar", "Access".
 *
 * Example #1: When I go to the settings section "Title & description"
 * Example #2: When I go to the settings section "Navigation"
 * Example #3: When we go to the settings section "Announcement bar"
 * Example #4: And I go to the settings section "Staff"
 * Example #5: And we go to the settings section "Access"
 *
 */
When(/^(?:I |we )?go to the settings section "([^"]*)"$/, async function (title) {
  const page = this.page;
  if (!/^settings/.test(currentRoute(this))) await openOrFail(this, 'settings', 'the settings');
  const menu = page.getByTestId('sidebar');
  try {
    await menu.waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The settings did not open (the admin is on "${currentRoute(this)}").`, 'Only the Owner and Administrators see the settings.');
  }
  const entry = menu.locator('a, button, li').filter({ hasText: exactly(title) });
  if (!(await entry.count())) throw fail(`The menu of the settings has no "${title}". It has: ${await textsOf(menu.locator('a, button'), 50)}.`, 'Use the name the menu of the settings shows.');
  await entry.last().click();
  const section = await settingsSection(this, title);
  await assertPresence(section, null, { label: `the settings section "${title}"`, hint: 'The menu scrolls the settings to the section.', timeout: budget(this) });
});

/**
 * A text in (or, with "not", absent from) a section of the settings: the
 * values the section reports, such as the title of the site.
 *
 * Example #1: Then the settings section "Title & description" should show "Test site"
 * Example #2: Then the settings section "Title & description" should show "A site for automated tests"
 * Example #3: Then the settings section "Staff" should show "Olivia Owner"
 * Example #4: Then the settings section "Title & description" should not show "Another site"
 * Example #5: And the settings section "Navigation" should show "Set up primary and secondary menus"
 *
 */
Then(/^the settings section "([^"]*)" should( not)? show "([^"]*)"$/, async function (title, notCase, text) {
  const section = await settingsSection(this, title);
  const shown = section.getByText(text).first();
  const fieldWithValue = async () => {
    const values = await section.locator('input, textarea').evaluateAll((fields) => fields.map((field) => field.value));
    return values.some((value) => value.includes(text));
  };
  const result = await poll(async () => (await shown.isVisible().catch(() => false)) || (await fieldWithValue()), (present) => (notCase ? !present : present), notCase ? 3000 : budget(this));
  if (!result.ok) {
    const found = (await section.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
    throw fail(notCase ? `Expected the settings section "${title}" not to show "${text}", but it does.` : `Expected the settings section "${title}" to show "${text}". It shows: "${found}".`, 'A section shows its values, or its fields once "Edit" is pressed.');
  }
});

/**
 * Press a button of a section of the settings: "Edit", "Save", "Cancel",
 * "Customize".
 *
 * Example #1: When I press "Edit" in the settings section "Title & description"
 * Example #2: When I press "Save" in the settings section "Title & description"
 * Example #3: When I press "Cancel" in the settings section "Title & description"
 * Example #4: When we press "Customize" in the settings section "Navigation"
 * Example #5: And I press "Customize" in the settings section "Announcement bar"
 *
 */
When(/^(?:I |we )?press "([^"]*)" in the settings section "([^"]*)"$/, async function (name, title) {
  const section = await settingsSection(this, title);
  const button = section.getByRole('button', { name, exact: true });
  if (!(await button.count())) throw fail(`The settings section "${title}" has no button "${name}". It has: ${await textsOf(section.getByRole('button'))}.`, 'A section has "Edit" or "Customize"; once it is being edited it has "Save" and "Cancel".');
  if (!(await button.first().isEnabled())) throw fail(`The button "${name}" of the settings section "${title}" is disabled.`, '"Save" is enabled once a field of the section has changed.');
  await button.first().click();
  await smartSettle(this.page, 1500);
});

/**
 * Fill in a field of a section of the settings that is being edited, by the
 * label of the field.
 *
 * Example #1: When I set "Site title" to "" in the settings section "Title & description"
 * Example #2: When I set "Site title" to "Test site" in the settings section "Title & description"
 * Example #3: When I set "Site description" to "A site for automated tests" in the settings section "Title & description"
 * Example #4: When we set "Site description" to "Changed by the suite" in the settings section "Title & description"
 * Example #5: And I set "Site title" to "Another title" in the settings section "Title & description"
 *
 */
When(/^(?:I |we )?set "([^"]*)" to "([^"]*)" in the settings section "([^"]*)"$/, async function (label, value, title) {
  const section = await settingsSection(this, title);
  const field = section.getByRole('textbox', { name: label, exact: true });
  if (!(await field.count())) throw fail(`The settings section "${title}" has no field "${label}". It has: ${await textsOf(section.locator('label'))}.`, `Start editing first: When I press "Edit" in the settings section "${title}".`);
  await field.fill(value);
});

// ---------------------------------------------------------------------------
// Settings: the navigation links
// ---------------------------------------------------------------------------

function navigationModal(world) {
  return world.page.getByTestId('navigation-modal');
}

async function navigationEditor(world) {
  const modal = navigationModal(world);
  if (!(await modal.isVisible().catch(() => false))) {
    throw fail('The navigation settings are not open.', 'Open them first: When I open the navigation settings.');
  }
  return modal;
}

function navigationRow(modal, label) {
  return modal.getByTestId('navigation-item-editor').filter({ has: modal.page().locator(`input[value="${label.replace(/"/g, '\\"')}"]`) });
}

async function navigationLabels(modal) {
  const labels = await modal.getByTestId('navigation-item-editor').getByRole('textbox', { name: 'Label' }).evaluateAll((fields) => fields.map((field) => `"${field.value}"`));
  return labels.join(', ') || '(no links)';
}

/**
 * Open the dialog of the settings that edits the navigation links of the
 * site (the primary navigation).
 *
 * Example #1: When I open the navigation settings
 * Example #2: When we open the navigation settings
 * Example #3: And I open the navigation settings
 * Example #4: Given I open the navigation settings
 * Example #5: When open the navigation settings
 *
 */
When(/^(?:I |we )?open the navigation settings$/, async function () {
  await openOrFail(this, 'settings/navigation/edit', 'the navigation settings');
  await assertPresence(navigationModal(this), null, { label: 'the navigation settings', hint: 'Only the Owner and Administrators change the navigation.', timeout: budget(this) * 2 });
});

/**
 * Add a link to the primary navigation in the navigation settings: its label
 * and its address (a path of the site or a full URL). Save with "I save the
 * navigation settings".
 *
 * Example #1: When I add the navigation link "Docs" with the address "/docs/"
 * Example #2: When I add the navigation link "Contact" with the address "/contact/"
 * Example #3: When we add the navigation link "Guides" with the address "/tag/guides/"
 * Example #4: And I add the navigation link "Elsewhere" with the address "https://example.com/"
 * Example #5: And we add the navigation link "News" with the address "/tag/news/"
 *
 */
When(/^(?:I |we )?add the navigation link "([^"]*)" with the address "([^"]*)"$/, async function (label, address) {
  const modal = await navigationEditor(this);
  const blank = modal.getByTestId('new-navigation-item');
  await blank.getByRole('textbox', { name: 'Label' }).fill(label);
  const url = blank.getByRole('combobox', { name: 'URL' });
  await url.fill(address);
  await blank.getByTestId('add-button').click();
  await assertPresence(navigationRow(modal, label), null, { label: `the navigation link "${label}" in the navigation settings`, hint: 'A link needs a label; it joins the list above the empty row.', timeout: budget(this), found: () => navigationLabels(modal) });
});

/**
 * Remove a link from the primary navigation in the navigation settings, by
 * its label. Save with "I save the navigation settings".
 *
 * Example #1: When I remove the navigation link "Docs"
 * Example #2: When I remove the navigation link "Contact"
 * Example #3: When we remove the navigation link "Guides"
 * Example #4: And I remove the navigation link "Elsewhere"
 * Example #5: And we remove the navigation link "News"
 *
 */
When(/^(?:I |we )?remove the navigation link "([^"]*)"$/, async function (label) {
  const modal = await navigationEditor(this);
  const row = navigationRow(modal, label);
  if (!(await row.count())) throw fail(`The navigation settings have no link "${label}". They have: ${await navigationLabels(modal)}.`, 'Use the label the link has.');
  await row.first().getByRole('button', { name: 'Delete navigation item' }).click();
  await row.first().waitFor({ state: 'detached', timeout: budget(this) }).catch(() => {});
});

/**
 * Whether the navigation settings list a link, by its label.
 *
 * Example #1: Then the navigation settings should list the link "Home"
 * Example #2: Then the navigation settings should list the link "About"
 * Example #3: Then the navigation settings should not list the link "Docs"
 * Example #4: And the navigation settings should list the link "Docs"
 * Example #5: And the navigation settings should not list the link "Elsewhere"
 *
 */
Then(/^the navigation settings should( not)? list the link "([^"]*)"$/, async function (notCase, label) {
  const modal = await navigationEditor(this);
  await assertPresence(navigationRow(modal, label), notCase, { label: `the link "${label}" in the navigation settings`, hint: 'The links are the rows of the "Primary" tab.', timeout: notCase ? 3000 : budget(this), found: () => navigationLabels(modal) });
});

/**
 * Save the navigation settings and wait until the site has stored them: the
 * dialog closes.
 *
 * Example #1: When I save the navigation settings
 * Example #2: When we save the navigation settings
 * Example #3: And I save the navigation settings
 * Example #4: Then I save the navigation settings
 * Example #5: When save the navigation settings
 *
 */
When(/^(?:I |we )?save the navigation settings$/, async function () {
  const modal = await navigationEditor(this);
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  try {
    await modal.waitFor({ state: 'hidden', timeout: budget(this) * 2 });
  } catch (error) {
    throw fail(`The navigation settings were not saved: the dialog is still open. It says: ${await textsOf(modal.locator('[role="alert"]'))}.`, 'A link needs a label and a valid address.');
  }
});

/**
 * Make sure the primary navigation has no link with a label: for the start of
 * a scenario that adds one and for cleaning up after it. It asks the Admin
 * API with the session of the browser and passes when there is no such link.
 *
 * Example #1: Given the navigation has no link "Docs"
 * Example #2: Given the navigation has no link "Elsewhere"
 * Example #3: And the navigation has no link "Guides"
 * Example #4: Then the navigation has no link "Docs"
 * Example #5: Given the navigation has no link "Temporary"
 *
 */
Given(/^the navigation has no link "([^"]*)"$/, async function (label) {
  const settings = await adminApiOrFail(this, 'GET', '/settings/?group=site', undefined, 'read the navigation');
  const entry = (settings.json.settings || []).find((setting) => setting.key === 'navigation');
  let links = entry ? entry.value : [];
  if (typeof links === 'string') links = JSON.parse(links || '[]');
  const kept = (links || []).filter((link) => link.label !== label);
  if (kept.length !== (links || []).length) {
    await adminApiOrFail(this, 'PUT', '/settings/', { settings: [{ key: 'navigation', value: JSON.stringify(kept) }] }, `remove the navigation link "${label}"`);
  }
});

// ---------------------------------------------------------------------------
// Settings: the announcement bar
// ---------------------------------------------------------------------------

async function announcementEditor(world) {
  const modal = world.page.getByTestId('announcement-bar-modal');
  if (!(await modal.isVisible().catch(() => false))) {
    await openOrFail(world, 'settings/announcement-bar/edit', 'the announcement bar settings');
    try {
      await modal.waitFor({ state: 'visible', timeout: budget(world) * 2 });
    } catch (error) {
      throw fail(`The announcement bar settings did not open (the admin is on "${currentRoute(world)}").`, 'Only the Owner and Administrators change the announcement bar.');
    }
  }
  return modal;
}

async function saveAnnouncement(world, modal) {
  const page = world.page;
  const stored = page.waitForResponse((response) => /\/ghost\/api\/admin\/settings\//.test(response.url()) && response.request().method() === 'PUT', { timeout: budget(world) * 2 });
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await stored.catch(() => null);
  if (!response || !response.ok()) {
    throw fail(`The announcement was not saved${response ? `: the site answered ${response.status()}` : ': the site was not asked to store it'}.`, 'The "Save" button stores the announcement once its text or visibility has changed.');
  }
  await smartSettle(page, 1500);
}

/**
 * Write the announcement of the announcement bar, show it to a group of
 * visitors ("Public visitors", "Free members", "Paid members") and save. The
 * step opens the announcement bar settings when they are closed.
 *
 * Example #1: When I announce "A sale from the suite" to "Public visitors"
 * Example #2: When I announce "Members, read this" to "Free members"
 * Example #3: When we announce "Back soon" to "Public visitors"
 * Example #4: And I announce "New season" to "Public visitors"
 * Example #5: And we announce "Thank you" to "Free members"
 *
 */
When(/^(?:I |we )?announce "([^"]*)" to "([^"]*)"$/, async function (text, audience) {
  const page = this.page;
  const modal = await announcementEditor(this);
  const editor = modal.locator('[data-lexical-editor="true"]').first();
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type(text);
  const box = modal.getByRole('checkbox', { name: audience, exact: true });
  if (!(await box.count())) throw fail(`The announcement cannot be shown to "${audience}". The groups: ${await textsOf(modal.getByRole('group', { name: 'Visibility' }).locator('label'))}.`, 'Use the name of the checkbox under "Visibility".');
  await box.check();
  await saveAnnouncement(this, modal);
});

/**
 * Empty the announcement of the announcement bar, show it to nobody and save.
 *
 * Example #1: When I clear the announcement
 * Example #2: When we clear the announcement
 * Example #3: And I clear the announcement
 * Example #4: Then I clear the announcement
 * Example #5: When clear the announcement
 *
 */
When(/^(?:I |we )?clear the announcement$/, async function () {
  const page = this.page;
  const modal = await announcementEditor(this);
  const editor = modal.locator('[data-lexical-editor="true"]').first();
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  const boxes = modal.getByRole('group', { name: 'Visibility' }).getByRole('checkbox');
  for (let i = 0; i < await boxes.count(); i++) {
    if (await boxes.nth(i).isChecked()) await boxes.nth(i).uncheck();
  }
  await saveAnnouncement(this, modal);
});

/**
 * Make sure the announcement bar is empty and shown to nobody: for the start
 * of a scenario that announces something and for cleaning up after it. It
 * asks the Admin API with the session of the browser.
 *
 * Example #1: Given there is no announcement
 * Example #2: And there is no announcement
 * Example #3: Then there is no announcement
 * Example #4: But there is no announcement
 * Example #5: * there is no announcement
 *
 */
Given(/^there is no announcement$/, async function () {
  await adminApiOrFail(this, 'PUT', '/settings/', { settings: [{ key: 'announcement_content', value: null }, { key: 'announcement_visibility', value: '[]' }] }, 'clear the announcement');
});
