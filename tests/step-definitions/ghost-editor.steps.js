'use strict';

// Posts and pages in the editor: the title and the text, cards, the settings
// panel (address, tags, access, excerpt, feature image, featured), preview, and
// the publish flow (publish, schedule, update, unpublish, delete).
//
// The editor saves by itself a moment after a change and shows it in its
// status ("Draft - Saved"); its header hides while somebody types and returns
// when the pointer moves. The steps wait on that status and move the pointer
// before they reach for a header button.

const path = require('path');
const fs = require('fs');
const { Given, When, Then } = require('@cucumber/cucumber');
const { smartSettle } = require('webship-js/tests/step-definitions/webship');
const {
  budget, exactly, fail, textsOf, assertPresence, poll,
  currentRoute, waitForAdmin, openAdmin, adminApiOrFail, nql,
  listItem, listTitles, waitForList, dialog,
  EDITOR_HINT, editorTitle, editorBody, revealEditorHeader, editorAction, editorStatus, waitForEditorSaved, postSettings,
  cardType, editorCards, focusEndOfBody,
} = require('./ghost-helpers');

/** A file of the project by its path from the project root; fails when it is missing. */
function projectFile(file) {
  const resolved = path.resolve(process.cwd(), file);
  if (!fs.existsSync(resolved)) {
    throw fail(`The file "${file}" does not exist (looked for ${resolved}).`, 'Give the path from the folder the suite runs in, for example "tests/fixtures/feature.png".');
  }
  return resolved;
}

/** Press a header button of the editor; fail with the buttons the header has. */
async function pressEditorAction(world, name) {
  await editorTitle(world);
  await revealEditorHeader(world);
  const button = editorAction(world, name);
  const result = await poll(() => button.count(), (count) => count > 0, 5000);
  if (!result.ok) {
    throw fail(`The editor has no "${name}" button. Its header has: ${await textsOf(world.page.getByTestId('editor-header-actions').getByRole('button'))}; the status is "${await editorStatus(world)}".`,
      'A draft has Preview and Publish (a Contributor has Save instead of Publish); a published post has Unpublish and Update.');
  }
  await button.first().click({ timeout: budget(world) });
}

// ---------------------------------------------------------------------------
// Opening the editor
// ---------------------------------------------------------------------------

/**
 * Open the editor for a new post or a new page and wait for its title field.
 *
 * Example #1: When I start a new post
 * Example #2: When I start a new page
 * Example #3: When we start a new post
 * Example #4: Given I start a new post
 * Example #5: And we start a new page
 *
 */
When(/^(?:I |we )?start a new (post|page)$/, async function (type) {
  if ((await openAdmin(this, 'editor/' + type)) === 'signin') {
    throw fail(`Could not start a new ${type}: the admin asks to sign in.`, 'Sign in first: Given I am logged in to the admin as "author".');
  }
  await editorTitle(this);
});

/**
 * Open the editor of an existing post or page from its list, by its exact
 * title, the way a person does.
 *
 * Example #1: When I open the editor of the post "Welcome to the test site"
 * Example #2: When I open the editor of the page "Contact"
 * Example #3: When we open the editor of the post "An unfinished draft"
 * Example #4: Given I open the editor of the post "Travel diary 1"
 * Example #5: And I open the editor of the page "About"
 *
 */
When(/^(?:I |we )?open the editor of the (post|page) "([^"]*)"$/, async function (type, title) {
  if ((await openAdmin(this, type + 's')) === 'signin') {
    throw fail(`Could not open the editor of the ${type} "${title}": the admin asks to sign in.`, 'Sign in first: Given I am logged in to the admin as "editor".');
  }
  await waitForList(this);
  const item = listItem(this, title);
  try {
    await item.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The ${type}s list has no ${type} titled "${title}". It lists: ${await listTitles(this)}.`,
      'An Author and a Contributor see only their own posts. Check the title and the signed-in user.');
  }
  await item.first().locator('a').first().click();
  const field = await editorTitle(this);
  const result = await poll(() => field.inputValue(), (value) => value.trim() === title, budget(this));
  if (!result.ok) {
    throw fail(`The editor opened, but its title is "${result.value}" instead of "${title}".`, EDITOR_HINT);
  }
});

/**
 * Leave the editor for the list it belongs to, with the link at its top left.
 *
 * Example #1: When I leave the editor
 * Example #2: When we leave the editor
 * Example #3: And I leave the editor
 * Example #4: Then I leave the editor
 * Example #5: When leave the editor
 *
 */
When(/^(?:I |we )?leave the editor$/, async function () {
  await editorTitle(this);
  await revealEditorHeader(this);
  await this.page.locator('main a[href="#/posts"], main a[href="#/pages"]').first().click({ timeout: budget(this) });
  const result = await poll(async () => currentRoute(this), (route) => /^(posts|pages)(\?|$)/.test(route), budget(this));
  if (!result.ok) {
    throw fail(`The editor did not close: the admin is still on "${result.value}".`, 'An unsaved change asks for a confirmation: answer the dialog first.');
  }
  await waitForList(this);
});

// ---------------------------------------------------------------------------
// Title, text and cards
// ---------------------------------------------------------------------------

/**
 * Type the title of the post or page in the editor.
 *
 * Example #1: When I set the editor title to "A post from the suite"
 * Example #2: When I set the editor title to "Another title"
 * Example #3: When we set the editor title to "A page from the suite"
 * Example #4: And I set the editor title to "Changed title"
 * Example #5: When I set the editor title to ""
 *
 */
When(/^(?:I |we )?set the editor title to "([^"]*)"$/, async function (title) {
  const field = await editorTitle(this);
  await field.fill(title);
});

/**
 * Type a paragraph at the end of the text of the post or page.
 *
 * Example #1: When I write "The first paragraph." in the editor
 * Example #2: When I write "Another paragraph." in the editor
 * Example #3: When we write "Text from the suite." in the editor
 * Example #4: And I write "More text." in the editor
 * Example #5: When I write "Last words." in the editor
 *
 */
When(/^(?:I |we )?write "([^"]*)" in the editor$/, async function (text) {
  await editorTitle(this);
  await focusEndOfBody(this);
  await this.page.keyboard.type(text);
  await assertPresence(editorBody(this).getByText(text).first(), null, {
    label: `"${text}" in the text of the editor`,
    hint: 'The text is typed in a new paragraph at the end of the post.',
    timeout: budget(this),
  });
});

/**
 * Add a card at the end of the text through the card menu (type "/" and pick
 * the card): Divider, Callout, Toggle, Button, HTML, Markdown and the others
 * the menu lists. With a text, the text is typed into the new card (a Callout
 * or a Toggle heading).
 *
 * Example #1: When I add a "Divider" card to the editor
 * Example #2: When I add a "Callout" card to the editor
 * Example #3: When I add a "Callout" card with the text "Mind the gap." to the editor
 * Example #4: When we add a "Toggle" card with the text "A question" to the editor
 * Example #5: And I add a "Button" card to the editor
 *
 */
When(/^(?:I |we )?add an? "([^"]*)" card(?: with the text "([^"]*)")? to the editor$/, async function (name, text) {
  const page = this.page;
  await editorTitle(this);
  const cards = editorCards(this, name);
  const before = await cards.count();
  await focusEndOfBody(this);
  await page.keyboard.type('/');
  const menu = page.locator('[data-kg-slash-menu]');
  const item = menu.locator(`[data-kg-card-menu-item="${name.replace(/"/g, '')}" i]`);
  try {
    await item.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The card menu of the editor has no "${name}" card. It has: ${(await menu.locator('[data-kg-card-menu-item]').evaluateAll((items) => items.map((entry) => entry.getAttribute('data-kg-card-menu-item')).join(', '))) || '(no menu)'}.`, 'Use the name the card menu shows, for example "Divider", "Callout" or "Toggle".');
  }
  await item.first().click();
  const added = await poll(() => cards.count(), (count) => count === before + 1, budget(this));
  if (!added.ok) {
    throw fail(`The "${name}" card was not added: the editor has ${added.value} such card(s), ${before} before.`, `A card of this kind is marked data-kg-card="${cardType(name)}" in the text.`);
  }
  if (text) {
    await page.keyboard.type(text);
    await assertPresence(cards.last().getByText(text).first(), null, {
      label: `"${text}" in the new "${name}" card`,
      hint: 'The text is typed where the cursor is after the card is added; only cards with a text of their own take it.',
      timeout: budget(this),
    });
  }
});

/**
 * Add an image card at the end of the text and upload a file of the project
 * into it. The step waits until the site has stored the image.
 *
 * Example #1: When I add an image card to the editor from the file "tests/fixtures/feature.png"
 * Example #2: When we add an image card to the editor from the file "tests/fixtures/feature.png"
 * Example #3: And I add an image card to the editor from the file "tests/fixtures/photo.jpg"
 * Example #4: When I add an image card to the editor from the file "fixtures/logo.png"
 * Example #5: When add an image card to the editor from the file "tests/fixtures/feature.png"
 *
 */
When(/^(?:I |we )?add an image card to the editor from the file "([^"]*)"$/, async function (file) {
  const page = this.page;
  const resolved = projectFile(file);
  await editorTitle(this);
  const cards = editorCards(this, 'image');
  const before = await cards.count();
  await focusEndOfBody(this);
  await page.keyboard.type('/');
  const item = page.locator('[data-kg-slash-menu] [data-kg-card-menu-item="Image"]');
  await item.waitFor({ state: 'visible', timeout: budget(this) });
  // The image card asks for a file as soon as it is added.
  const chooser = page.waitForEvent('filechooser', { timeout: budget(this) }).catch(() => null);
  await item.click();
  const dialogOfFiles = await chooser;
  if (dialogOfFiles) {
    await dialogOfFiles.setFiles(resolved);
  } else {
    await cards.last().locator('input[type="file"]').first().setInputFiles(resolved);
  }
  const stored = await poll(async () => ({ count: await cards.count(), src: await cards.last().locator('img').first().getAttribute('src').catch(() => '') }),
    (state) => state.count === before + 1 && /\/content\/images\//.test(state.src || ''), budget(this) * 2);
  if (!stored.ok) {
    throw fail(`The image card did not receive "${file}": ${JSON.stringify(stored.value)}.`, 'The site stores uploads under /content/images/; check the notifications for an upload error.');
  }
});

/**
 * How many cards of a kind the text of the editor has. The kind is the name
 * of the card menu ("Divider", "Callout", "Image").
 *
 * Example #1: Then the editor should have 1 "Divider" card
 * Example #2: Then the editor should have 2 "Callout" cards
 * Example #3: Then the editor should have 1 "Image" card
 * Example #4: And the editor should have 0 "Toggle" cards
 * Example #5: Then the editor should have 3 "Divider" cards
 *
 */
Then(/^the editor should have (\d+) "([^"]*)" cards?$/, async function (count, name) {
  await editorTitle(this);
  const wanted = Number(count);
  const cards = editorCards(this, name);
  const result = await poll(() => cards.count(), (found) => found === wanted, budget(this));
  if (!result.ok) {
    const kinds = await this.page.locator('[data-testid="editor-body"] [data-kg-card]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-kg-card')).join(', '));
    throw fail(`Expected ${wanted} "${name}" card(s) in the editor, found ${result.value}. The cards of the text: ${kinds || '(none)'}.`, `A "${name}" card is marked data-kg-card="${cardType(name)}".`);
  }
});

/**
 * The title the editor shows.
 *
 * Example #1: Then the editor title should be "Welcome to the test site"
 * Example #2: Then the editor title should be "A post from the suite"
 * Example #3: Then the editor title should be "Contact"
 * Example #4: And the editor title should be "Changed title"
 * Example #5: Then the editor title should be ""
 *
 */
Then(/^the editor title should be "([^"]*)"$/, async function (title) {
  const field = await editorTitle(this);
  const result = await poll(() => field.inputValue(), (value) => value === title, budget(this));
  if (!result.ok) throw fail(`Expected the editor title "${title}", found "${result.value}".`, 'The title is the first field of the editor; check which post is open.');
});

/**
 * A text in (or, with "not", absent from) the body of the post or page in the
 * editor.
 *
 * Example #1: Then the editor should contain "This is the welcome post."
 * Example #2: Then the editor should contain "The first paragraph."
 * Example #3: Then the editor should not contain "Lorem ipsum"
 * Example #4: And the editor should contain "A second heading"
 * Example #5: Then the editor should not contain "deleted words"
 *
 */
Then(/^the editor should( not)? contain "([^"]*)"$/, async function (notCase, text) {
  await editorTitle(this);
  const body = editorBody(this);
  await assertPresence(body.getByText(text).first(), notCase, {
    label: `"${text}" in the text of the editor`,
    hint: 'The step reads the body of the post, not its title or settings.',
    timeout: notCase ? 3000 : budget(this),
    found: async () => `the text "${(await body.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)}"`,
  });
});

// ---------------------------------------------------------------------------
// Saving and the status
// ---------------------------------------------------------------------------

/**
 * Wait until the editor has saved the post or page: its status no longer says
 * "Saving" and the post has an address of its own.
 *
 * Example #1: When I wait for the editor to save
 * Example #2: When we wait for the editor to save
 * Example #3: And I wait for the editor to save
 * Example #4: Then I wait for the editor to save
 * Example #5: When wait for the editor to save
 *
 */
When(/^(?:I |we )?wait for the editor to save$/, async function () {
  await editorTitle(this);
  await waitForEditorSaved(this);
});

/**
 * The status in the header of the editor: "Draft - Saved", "Published",
 * "Scheduled". A part of the status is enough ("Draft").
 *
 * Example #1: Then the editor status should be "Draft"
 * Example #2: Then the editor status should be "Draft - Saved"
 * Example #3: Then the editor status should be "Published"
 * Example #4: And the editor status should be "Scheduled"
 * Example #5: Then the editor status should be "Saved"
 *
 */
Then(/^the editor status should be "([^"]*)"$/, async function (status) {
  await editorTitle(this);
  await revealEditorHeader(this);
  const result = await poll(() => editorStatus(this), (found) => found.toLowerCase().includes(status.toLowerCase()), budget(this));
  if (!result.ok) {
    throw fail(`Expected the editor status "${status}", found "${result.value || '(none)'}".`, 'The status is at the top of the editor, next to the link back to the list.');
  }
});

/**
 * Whether the header of the editor offers a button: "Publish", "Preview",
 * "Update", "Unpublish" or, for a Contributor, "Save".
 *
 * Example #1: Then the editor should offer "Publish"
 * Example #2: Then the editor should offer "Preview"
 * Example #3: Then the editor should not offer "Publish"
 * Example #4: And the editor should offer "Save"
 * Example #5: Then the editor should offer "Unpublish"
 *
 */
Then(/^the editor should( not)? offer "([^"]*)"$/, async function (notCase, name) {
  await editorTitle(this);
  await revealEditorHeader(this);
  // The header is drawn once the post has loaded: let it settle before a "not".
  await this.page.getByTestId('editor-header-actions').getByRole('button').first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
  await assertPresence(editorAction(this, name), notCase, {
    label: `the "${name}" button in the header of the editor`,
    hint: 'A new post shows its buttons once it has a title or a text. What the header offers depends on the role of the user and on the status of the post.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(this.page.getByTestId('editor-header-actions').getByRole('button')),
  });
});

// ---------------------------------------------------------------------------
// The settings panel
// ---------------------------------------------------------------------------

/**
 * Open or close the settings panel of the editor (the "Settings" button at
 * its top right).
 *
 * Example #1: When I open the post settings
 * Example #2: When I close the post settings
 * Example #3: When we open the post settings
 * Example #4: And I open the page settings
 * Example #5: And I close the page settings
 *
 */
When(/^(?:I |we )?(open|close) the (?:post|page) settings$/, async function (action) {
  if (action === 'open') {
    await postSettings(this);
    return;
  }
  const panel = this.page.getByTestId('post-settings-sidebar');
  if (await panel.isVisible().catch(() => false)) {
    await revealEditorHeader(this);
    await this.page.getByTestId('settings-menu-toggle').click({ timeout: budget(this) });
    await panel.waitFor({ state: 'hidden', timeout: budget(this) }).catch(() => {});
  }
});

/**
 * Whether the settings panel offers a setting, by its label: "Tags", "Post
 * access", "Authors", "Feature this post", "Excerpt". What it offers depends
 * on the role of the user.
 *
 * Example #1: Then the post settings should offer "Tags"
 * Example #2: Then the post settings should offer "Post access"
 * Example #3: Then the post settings should not offer "Post access"
 * Example #4: And the post settings should not offer "Authors"
 * Example #5: Then the page settings should offer "Excerpt"
 *
 */
Then(/^the (?:post|page) settings should( not)? offer "([^"]*)"$/, async function (notCase, label) {
  const panel = await postSettings(this);
  await assertPresence(panel.locator('label, button').filter({ hasText: exactly(label) }), notCase, {
    label: `the setting "${label}" in the settings panel`,
    hint: 'A Contributor has no tags, access, authors and featured settings; an Author has no access, authors and featured settings.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(panel.locator('label'), 20),
  });
});

/**
 * Set the last part of the address of the post or page (its slug) in the
 * settings panel.
 *
 * Example #1: When I set the post URL to "a-post-from-the-suite"
 * Example #2: When I set the page URL to "a-page-from-the-suite"
 * Example #3: When we set the post URL to "suite-post"
 * Example #4: And I set the post URL to "another-address"
 * Example #5: When I set the post URL to "news-2026"
 *
 */
When(/^(?:I |we )?set the (?:post|page) URL to "([^"]*)"$/, async function (slug) {
  const panel = await postSettings(this);
  const field = panel.getByTestId('settings-slug-input');
  await field.fill(slug);
  await field.press('Tab');
});

/**
 * The last part of the address of the post or page, as the settings panel
 * shows it.
 *
 * Example #1: Then the post URL should be "welcome-to-the-test-site"
 * Example #2: Then the page URL should be "contact"
 * Example #3: Then the post URL should be "a-post-from-the-suite"
 * Example #4: And the post URL should be "suite-post"
 * Example #5: Then the page URL should be "about"
 *
 */
Then(/^the (?:post|page) URL should be "([^"]*)"$/, async function (slug) {
  const panel = await postSettings(this);
  const field = panel.getByTestId('settings-slug-input');
  const result = await poll(() => field.inputValue(), (value) => value === slug, budget(this));
  if (!result.ok) throw fail(`Expected the post URL "${slug}", found "${result.value}".`, 'The site turns the title into the address when the post is first saved, and makes it unique.');
});

/**
 * Add a tag to the post or page in the settings panel: an existing tag is
 * picked from the list, a new name creates the tag.
 *
 * Example #1: When I add the tag "News" to the post
 * Example #2: When I add the tag "Guides" to the post
 * Example #3: When we add the tag "Travel" to the post
 * Example #4: And I add the tag "A tag from the suite" to the post
 * Example #5: When I add the tag "News" to the page
 *
 */
When(/^(?:I |we )?add the tag "([^"]*)" to the (?:post|page)$/, async function (name) {
  const page = this.page;
  const panel = await postSettings(this);
  const input = panel.getByRole('combobox', { name: 'Tags' });
  if (!(await input.count())) {
    throw fail('The settings panel has no Tags field for this user.', 'A Contributor may not tag a post.');
  }
  await input.click();
  await input.fill(name);
  const option = page.getByRole('option').filter({ hasText: new RegExp('^\\s*(Create [“"])?' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[”"]?\\s*$') });
  try {
    await option.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch (error) {
    throw fail(`The Tags field offers no "${name}". It offers: ${await textsOf(page.getByRole('option'))}.`, 'The tag may be on the post already.');
  }
  await option.first().click();
  await assertPresence(panel.getByTestId('settings-tags-field').getByRole('button', { name: `Remove ${name}`, exact: true }), null, {
    label: `the tag "${name}" on the post`,
    hint: 'A chosen tag shows as a chip in the Tags field.',
    timeout: budget(this),
  });
  await page.keyboard.press('Escape');
});

/**
 * Remove a tag from the post or page in the settings panel.
 *
 * Example #1: When I remove the tag "News" from the post
 * Example #2: When I remove the tag "Guides" from the post
 * Example #3: When we remove the tag "Travel" from the post
 * Example #4: And I remove the tag "A tag from the suite" from the post
 * Example #5: When I remove the tag "News" from the page
 *
 */
When(/^(?:I |we )?remove the tag "([^"]*)" from the (?:post|page)$/, async function (name) {
  const panel = await postSettings(this);
  const field = panel.getByTestId('settings-tags-field');
  const chip = field.getByRole('button', { name: `Remove ${name}`, exact: true });
  if (!(await chip.count())) {
    throw fail(`The post has no tag "${name}". Its tags: ${await textsOf(field.getByRole('button'))}.`, 'Use the name the Tags field shows.');
  }
  await chip.first().click();
  await chip.first().waitFor({ state: 'detached', timeout: budget(this) }).catch(() => {});
});

/**
 * Whether the post or page has a tag, as the settings panel shows it.
 *
 * Example #1: Then the post should have the tag "News"
 * Example #2: Then the post should have the tag "Guides"
 * Example #3: Then the post should not have the tag "Travel"
 * Example #4: And the page should not have the tag "News"
 * Example #5: Then the post should have the tag "A tag from the suite"
 *
 */
Then(/^the (?:post|page) should( not)? have the tag "([^"]*)"$/, async function (notCase, name) {
  const panel = await postSettings(this);
  const field = panel.getByTestId('settings-tags-field');
  await assertPresence(field.getByRole('button', { name: `Remove ${name}`, exact: true }), notCase, {
    label: `the tag "${name}" on the post`,
    hint: 'The tags of a post are the chips of the Tags field in the settings panel.',
    timeout: notCase ? 3000 : budget(this),
    found: () => textsOf(field.getByRole('button')),
  });
});

/**
 * Choose who may read the post or page in the settings panel: "Public",
 * "Members only", "Paid-members only" or "Specific tier(s)".
 *
 * Example #1: When I set the post access to "Members only"
 * Example #2: When I set the post access to "Public"
 * Example #3: When we set the post access to "Paid-members only"
 * Example #4: And I set the page access to "Members only"
 * Example #5: When I set the page access to "Public"
 *
 */
When(/^(?:I |we )?set the (?:post|page) access to "([^"]*)"$/, async function (access) {
  const page = this.page;
  const panel = await postSettings(this);
  const select = panel.getByTestId('settings-visibility-select');
  if (!(await select.count())) {
    throw fail('The settings panel has no access setting for this user.', 'Only Editors, Administrators and the Owner choose who may read a post.');
  }
  await select.click();
  const option = page.getByRole('option', { name: access, exact: true });
  if (!(await option.count())) {
    throw fail(`The access setting has no "${access}". It has: ${await textsOf(page.getByRole('option'))}.`, 'Use the name the list shows.');
  }
  await option.click();
  await assertPresence(select.filter({ hasText: exactly(access) }), null, { label: `the access "${access}"`, hint: 'The chosen access shows in the field.', timeout: budget(this) });
});

/**
 * Who may read the post or page, as the settings panel shows it.
 *
 * Example #1: Then the post access should be "Public"
 * Example #2: Then the post access should be "Members only"
 * Example #3: Then the page access should be "Public"
 * Example #4: And the post access should be "Paid-members only"
 * Example #5: Then the page access should be "Members only"
 *
 */
Then(/^the (?:post|page) access should be "([^"]*)"$/, async function (access) {
  const panel = await postSettings(this);
  const select = panel.getByTestId('settings-visibility-select');
  const result = await poll(async () => (await select.innerText()).trim(), (value) => value === access, budget(this));
  if (!result.ok) throw fail(`Expected the access "${access}", found "${result.value}".`, 'The access is the "Post access" (or "Page access") field of the settings panel.');
});

/**
 * Type the excerpt of the post or page in the settings panel.
 *
 * Example #1: When I set the excerpt to "A short summary."
 * Example #2: When I set the excerpt to "What this post is about."
 * Example #3: When we set the excerpt to "From the suite."
 * Example #4: And I set the excerpt to ""
 * Example #5: When I set the excerpt to "Another summary."
 *
 */
When(/^(?:I |we )?set the excerpt to "([^"]*)"$/, async function (text) {
  const panel = await postSettings(this);
  const field = panel.getByTestId('settings-excerpt-input');
  await field.fill(text);
  await field.press('Tab');
});

/**
 * The excerpt of the post or page, as the settings panel shows it.
 *
 * Example #1: Then the excerpt should be "The first post of the test site."
 * Example #2: Then the excerpt should be "A short summary."
 * Example #3: Then the excerpt should be ""
 * Example #4: And the excerpt should be "From the suite."
 * Example #5: Then the excerpt should be "Another summary."
 *
 */
Then(/^the excerpt should be "([^"]*)"$/, async function (text) {
  const panel = await postSettings(this);
  const field = panel.getByTestId('settings-excerpt-input');
  const result = await poll(() => field.inputValue(), (value) => value === text, budget(this));
  if (!result.ok) throw fail(`Expected the excerpt "${text}", found "${result.value}".`, 'The excerpt is the "Excerpt" field of the settings panel.');
});

/**
 * Turn the "Feature this post" switch of the settings panel on or off.
 *
 * Example #1: When I feature the post
 * Example #2: When I stop featuring the post
 * Example #3: When we feature the post
 * Example #4: And I feature the page
 * Example #5: And we stop featuring the page
 *
 */
When(/^(?:I |we )?(feature|stop featuring) the (?:post|page)$/, async function (action) {
  const panel = await postSettings(this);
  const toggle = panel.getByTestId('settings-featured-toggle');
  if (!(await toggle.count())) {
    throw fail('The settings panel has no featured switch for this user.', 'Only Editors, Administrators and the Owner feature a post.');
  }
  const wanted = action === 'feature' ? 'true' : 'false';
  if ((await toggle.getAttribute('aria-checked')) !== wanted) await toggle.click();
  const result = await poll(() => toggle.getAttribute('aria-checked'), (value) => value === wanted, budget(this));
  if (!result.ok) throw fail(`The featured switch did not change: aria-checked is "${result.value}".`, 'The switch is "Feature this post" in the settings panel.');
});

/**
 * Whether the post or page is featured, as the switch of the settings panel
 * shows it.
 *
 * Example #1: Then the post should be featured
 * Example #2: Then the post should not be featured
 * Example #3: Then the page should be featured
 * Example #4: And the page should not be featured
 * Example #5: And the post should be featured
 *
 */
Then(/^the (?:post|page) should( not)? be featured$/, async function (notCase) {
  const panel = await postSettings(this);
  const toggle = panel.getByTestId('settings-featured-toggle');
  const wanted = notCase ? 'false' : 'true';
  const result = await poll(() => toggle.getAttribute('aria-checked'), (value) => value === wanted, budget(this));
  if (!result.ok) throw fail(`Expected the post ${notCase ? 'not ' : ''}to be featured, but the featured switch has aria-checked="${result.value}".`, 'The switch is "Feature this post" in the settings panel.');
});

/**
 * Upload the feature image of the post or page (the image above the title)
 * from a file of the project.
 *
 * Example #1: When I set the feature image to the file "tests/fixtures/feature.png"
 * Example #2: When we set the feature image to the file "tests/fixtures/feature.png"
 * Example #3: And I set the feature image to the file "tests/fixtures/photo.jpg"
 * Example #4: When I set the feature image to the file "fixtures/cover.png"
 * Example #5: When set the feature image to the file "tests/fixtures/feature.png"
 *
 */
When(/^(?:I |we )?set the feature image to the file "([^"]*)"$/, async function (file) {
  const page = this.page;
  const resolved = projectFile(file);
  await editorTitle(this);
  const area = page.getByTestId('editor-feature-image');
  // The upload area is a drop zone around a file input named "Add feature image".
  const input = area.locator('input[type="file"]');
  if (!(await input.count())) {
    throw fail('The post already has a feature image.', 'Remove it first: When I remove the feature image.');
  }
  await input.first().setInputFiles(resolved);
  const result = await poll(() => area.locator('img').first().getAttribute('src'), (src) => /\/content\/images\//.test(src || ''), budget(this) * 2);
  if (!result.ok) throw fail(`The feature image "${file}" was not stored: ${result.value}.`, 'The site stores uploads under /content/images/; check the notifications for an upload error.');
});

/**
 * Remove the feature image of the post or page in the editor.
 *
 * Example #1: When I remove the feature image
 * Example #2: When we remove the feature image
 * Example #3: And I remove the feature image
 * Example #4: Then I remove the feature image
 * Example #5: When remove the feature image
 *
 */
When(/^(?:I |we )?remove the feature image$/, async function () {
  await editorTitle(this);
  const area = this.page.getByTestId('editor-feature-image');
  const image = area.locator('img').first();
  if (!(await image.count())) throw fail('The post has no feature image to remove.', 'Set one first: When I set the feature image to the file "...".');
  await image.hover();
  await area.getByRole('button', { name: 'Remove feature image' }).click({ timeout: budget(this) });
  await image.waitFor({ state: 'detached', timeout: budget(this) }).catch(() => {});
});

/**
 * Whether the post or page in the editor has a feature image.
 *
 * Example #1: Then the post should have a feature image
 * Example #2: Then the post should not have a feature image
 * Example #3: Then the page should have a feature image
 * Example #4: And the page should not have a feature image
 * Example #5: And the post should have a feature image
 *
 */
Then(/^the (?:post|page) should( not)? have a feature image$/, async function (notCase) {
  await editorTitle(this);
  await assertPresence(this.page.locator('[data-testid="editor-feature-image"] img[src*="/content/images/"], [data-testid="editor-feature-image"] img[src^="http"]'), notCase, {
    label: 'a feature image above the title',
    hint: 'The feature image sits above the title in the editor.',
    timeout: notCase ? 3000 : budget(this),
  });
});

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function previewDialog(world) {
  return world.page.getByRole('dialog', { name: 'Preview' });
}

/**
 * Open the preview of the post or page from the editor and wait for the
 * preview frame.
 *
 * Example #1: When I preview the post
 * Example #2: When I preview the page
 * Example #3: When we preview the post
 * Example #4: And I preview the post
 * Example #5: And we preview the page
 *
 */
When(/^(?:I |we )?preview the (?:post|page)$/, async function () {
  await pressEditorAction(this, 'Preview');
  const frame = previewDialog(this).locator('iframe[data-testid="post-preview-browser-frame"]');
  try {
    await frame.waitFor({ state: 'visible', timeout: budget(this) * 2 });
    await frame.contentFrame().locator('body').waitFor({ state: 'visible', timeout: budget(this) * 2 });
  } catch (error) {
    throw fail('The preview did not open.', 'The preview needs a saved post: When I wait for the editor to save.');
  }
});

/**
 * A text in the preview of the post or page: the preview shows the post as
 * the theme of the site renders it.
 *
 * Example #1: Then the preview should show "A post from the suite"
 * Example #2: Then the preview should show "The first paragraph."
 * Example #3: Then the preview should not show "Lorem ipsum"
 * Example #4: And the preview should show "Test site"
 * Example #5: Then the preview should show "Mind the gap."
 *
 */
Then(/^the preview should( not)? show "([^"]*)"$/, async function (notCase, text) {
  const preview = previewDialog(this);
  if (!(await preview.isVisible().catch(() => false))) {
    throw fail('The preview is not open.', 'Open it first: When I preview the post.');
  }
  const body = preview.locator('iframe[data-testid="post-preview-browser-frame"]').contentFrame().locator('body');
  await assertPresence(body.getByText(text).first(), notCase, {
    label: `"${text}" in the preview`,
    hint: 'The preview is the page of the post as a visitor would see it.',
    timeout: notCase ? 3000 : budget(this) * 2,
    found: async () => `the text "${(await body.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)}"`,
  });
});

/**
 * Close the preview and return to the editor.
 *
 * Example #1: When I close the preview
 * Example #2: When we close the preview
 * Example #3: And I close the preview
 * Example #4: Then I close the preview
 * Example #5: When close the preview
 *
 */
When(/^(?:I |we )?close the preview$/, async function () {
  const preview = previewDialog(this);
  if (!(await preview.isVisible().catch(() => false))) throw fail('The preview is not open.', 'Open it first: When I preview the post.');
  await preview.getByRole('button', { name: 'Close', exact: true }).click();
  await preview.waitFor({ state: 'hidden', timeout: budget(this) });
});

// ---------------------------------------------------------------------------
// The publish flow
// ---------------------------------------------------------------------------

function publishDialog(world) {
  return world.page.getByRole('dialog', { name: 'Publish', exact: true });
}

async function openPublishDialog(world) {
  const flow = publishDialog(world);
  if (!(await flow.isVisible().catch(() => false))) {
    await waitForEditorSaved(world);
    await pressEditorAction(world, 'Publish');
    await flow.waitFor({ state: 'visible', timeout: budget(world) });
  }
  return flow;
}

/** The dialog that follows a publication: it links to the post and offers to share it. */
function publishedDialog(world) {
  return world.page.getByRole('dialog').filter({ has: world.page.getByRole('button', { name: 'Copy link' }) });
}

/**
 * Open the publish dialog of the editor (the "Publish" button) without
 * confirming, to read what it is about to do.
 *
 * Example #1: When I open the publish dialog
 * Example #2: When we open the publish dialog
 * Example #3: And I open the publish dialog
 * Example #4: Then I open the publish dialog
 * Example #5: When open the publish dialog
 *
 */
When(/^(?:I |we )?open the publish dialog$/, async function () {
  await openPublishDialog(this);
});

/**
 * What the publish dialog reports: its settings ("Publish", "Right now",
 * "Not sent as newsletter") and, after "Continue", the summary of what will
 * happen. The step moves on to the final review when the text is only there.
 *
 * Example #1: Then the publish dialog should say "Ready, set, publish."
 * Example #2: Then the publish dialog should say "Right now"
 * Example #3: Then the publish dialog should say "Your post will be published on your site."
 * Example #4: And the publish dialog should say "Not sent as newsletter"
 * Example #5: Then the publish dialog should say "Your page will be published on your site."
 *
 */
Then(/^the publish dialog should say "([^"]*)"$/, async function (text) {
  const flow = publishDialog(this);
  if (!(await flow.isVisible().catch(() => false))) throw fail('The publish dialog is not open.', 'Open it first: When I open the publish dialog.');
  const wanted = flow.getByText(text).first();
  if (!(await wanted.isVisible().catch(() => false))) {
    const next = flow.getByTestId('publish-continue');
    if (await next.isVisible().catch(() => false)) {
      const before = (await flow.innerText()).replace(/\s+/g, ' ');
      if (!before.includes(text)) await next.click();
    }
  }
  await assertPresence(wanted, null, {
    label: `"${text}" in the publish dialog`,
    hint: 'The dialog first lists its settings, then, after "Continue, final review", what will happen.',
    timeout: budget(this),
    found: async () => `the text "${(await flow.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}"`,
  });
});

/**
 * Close the publish dialog without publishing.
 *
 * Example #1: When I close the publish dialog
 * Example #2: When we close the publish dialog
 * Example #3: And I close the publish dialog
 * Example #4: Then I close the publish dialog
 * Example #5: When close the publish dialog
 *
 */
When(/^(?:I |we )?close the publish dialog$/, async function () {
  const flow = publishDialog(this);
  if (!(await flow.isVisible().catch(() => false))) throw fail('The publish dialog is not open.', 'Open it first: When I open the publish dialog.');
  await flow.getByRole('button', { name: 'Close', exact: true }).click();
  await flow.waitFor({ state: 'hidden', timeout: budget(this) });
});

/**
 * Publish the post or page that is open in the editor, right now: the publish
 * dialog, its final review and the confirmation. The step ends on the dialog
 * that reports the publication.
 *
 * Example #1: When I publish the post
 * Example #2: When I publish the page
 * Example #3: When we publish the post
 * Example #4: And I publish the post
 * Example #5: And we publish the page
 *
 */
When(/^(?:I |we )?publish the (?:post|page)$/, async function () {
  const flow = await openPublishDialog(this);
  const next = flow.getByTestId('publish-continue');
  if (await next.isVisible().catch(() => false)) await next.click();
  await flow.getByTestId('publish-confirm').click({ timeout: budget(this) });
  try {
    await publishedDialog(this).first().waitFor({ state: 'visible', timeout: budget(this) * 2 });
  } catch (error) {
    throw fail(`The post was not published: no confirmation appeared. The publish dialog says: "${(await flow.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}".`,
      'Check the notifications for an error, and that the user may publish (a Contributor may not).');
  }
});

/**
 * What the dialog after a publication reports: its headline and the post it
 * links to.
 *
 * Example #1: Then the publish confirmation should say "It’s out there"
 * Example #2: Then the publish confirmation should say "A post from the suite"
 * Example #3: Then the publish confirmation should say "posts published"
 * Example #4: And the publish confirmation should say "Test site"
 * Example #5: Then the publish confirmation should say "A page from the suite"
 *
 */
Then(/^the publish confirmation should say "([^"]*)"$/, async function (text) {
  const confirmation = publishedDialog(this);
  if (!(await confirmation.first().isVisible().catch(() => false))) {
    throw fail('No publish confirmation is open.', 'It follows: When I publish the post. Assert it before closing it.');
  }
  await assertPresence(confirmation.getByText(text).first(), null, {
    label: `"${text}" in the publish confirmation`,
    hint: 'The confirmation has a headline, the title and excerpt of the post, and links to share it.',
    timeout: budget(this),
    found: async () => `the text "${(await confirmation.first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}"`,
  });
});

/**
 * Close the dialog that reports a publication.
 *
 * Example #1: When I close the publish confirmation
 * Example #2: When we close the publish confirmation
 * Example #3: And I close the publish confirmation
 * Example #4: Then I close the publish confirmation
 * Example #5: When close the publish confirmation
 *
 */
When(/^(?:I |we )?close the publish confirmation$/, async function () {
  const confirmation = publishedDialog(this);
  if (!(await confirmation.first().isVisible().catch(() => false))) throw fail('No publish confirmation is open.', 'It follows: When I publish the post.');
  await confirmation.getByRole('button', { name: 'Close', exact: true }).first().click();
  await confirmation.first().waitFor({ state: 'hidden', timeout: budget(this) });
});

/**
 * Schedule the post or page that is open in the editor for a date
 * (YYYY-MM-DD) and a time (HH:mm, in the time zone of the site), through the
 * publish dialog.
 *
 * Example #1: When I schedule the post for "2031-05-01" at "09:30"
 * Example #2: When I schedule the page for "2031-05-01" at "09:30"
 * Example #3: When we schedule the post for "2032-01-15" at "18:00"
 * Example #4: And I schedule the post for "2031-12-31" at "23:45"
 * Example #5: When I schedule the post for "2033-03-03" at "03:33"
 *
 */
When(/^(?:I |we )?schedule the (?:post|page) for "(\d{4}-\d{2}-\d{2})" at "(\d{2}:\d{2})"$/, async function (date, time) {
  const page = this.page;
  const flow = await openPublishDialog(this);
  const when = flow.getByTestId('publish-setting-publish-at');
  const later = flow.getByRole('radio', { name: 'Schedule for later' });
  if (!(await later.isVisible().catch(() => false))) await when.getByRole('button').first().click();
  await later.click({ timeout: budget(this) });
  const dateField = flow.getByTestId('publish-schedule-date');
  await dateField.fill(date);
  await dateField.press('Tab');
  const timeField = flow.getByTestId('publish-schedule-time');
  await timeField.fill(time);
  await timeField.press('Tab');
  await flow.getByTestId('publish-continue').click();
  await flow.getByTestId('publish-confirm').click({ timeout: budget(this) });
  const result = await poll(async () => ({ open: await flow.isVisible().catch(() => false), error: await textsOf(flow.locator('[role="alert"]')) }), (state) => !state.open, budget(this) * 2);
  if (!result.ok) {
    throw fail(`The post was not scheduled for ${date} ${time}: the publish dialog is still open (${result.value.error}).`, 'The date must be in the future, in the time zone of the site.');
  }
  await smartSettle(page, 1500);
});

/**
 * Take a published or scheduled post or page back to a draft, through the
 * "Unpublish" (or "Unschedule") button of the editor and its confirmation.
 *
 * Example #1: When I unpublish the post
 * Example #2: When I unpublish the page
 * Example #3: When we unpublish the post
 * Example #4: And I unpublish the post
 * Example #5: And we unpublish the page
 *
 */
When(/^(?:I |we )?unpublish the (?:post|page)$/, async function () {
  await editorTitle(this);
  await revealEditorHeader(this);
  const actions = this.page.getByTestId('editor-header-actions');
  const button = actions.getByRole('button', { name: /^(Unpublish|Unschedule)$/ });
  const present = await poll(() => button.count(), (count) => count > 0, 5000);
  if (!present.ok) {
    throw fail(`The editor has no "Unpublish" button. Its header has: ${await textsOf(actions.getByRole('button'))}; the status is "${await editorStatus(this)}".`, 'Only a published or scheduled post can be taken back to a draft.');
  }
  await button.first().click();
  await this.page.getByTestId('publish-revert-to-draft').click({ timeout: budget(this) });
  await revealEditorHeader(this);
  const result = await poll(() => editorStatus(this), (status) => /draft/i.test(status), budget(this) * 2);
  if (!result.ok) throw fail(`The post did not return to a draft: its status is "${result.value}".`, 'Check the notifications for an error.');
});

/**
 * Save the changes of a published post or page with the "Update" button of
 * the editor (or, for a Contributor's draft, the "Save" button).
 *
 * Example #1: When I update the post
 * Example #2: When I update the page
 * Example #3: When we update the post
 * Example #4: And I update the post
 * Example #5: And we update the page
 *
 */
When(/^(?:I |we )?update the (?:post|page)$/, async function () {
  await editorTitle(this);
  await revealEditorHeader(this);
  const actions = this.page.getByTestId('editor-header-actions');
  const button = actions.getByRole('button', { name: /^(Update|Save)$/ });
  if (!(await button.count())) {
    throw fail(`The editor has no "Update" button. Its header has: ${await textsOf(actions.getByRole('button'))}.`, 'A published post has "Update"; a draft saves by itself.');
  }
  const enabled = await poll(() => button.first().isEnabled(), (value) => value, budget(this));
  if (!enabled.ok) throw fail('The "Update" button is disabled: the post has no unsaved change.', 'Change the title, the text or a setting first.');
  await button.first().click();
  const result = await poll(async () => ({ status: await editorStatus(this), enabled: await button.first().isEnabled().catch(() => false) }), (state) => !/saving/i.test(state.status) && !state.enabled, budget(this) * 2);
  if (!result.ok) throw fail(`The post was not updated: the status is "${result.value.status}" and "Update" is still waiting.`, 'Check the notifications for an error.');
});

/**
 * Delete the post or page that is open in the editor: the "Delete" button of
 * the settings panel and its confirmation. The step ends on the list.
 *
 * Example #1: When I delete the post from the editor
 * Example #2: When I delete the page from the editor
 * Example #3: When we delete the post from the editor
 * Example #4: And I delete the post from the editor
 * Example #5: And we delete the page from the editor
 *
 */
When(/^(?:I |we )?delete the (?:post|page) from the editor$/, async function () {
  const panel = await postSettings(this);
  await panel.getByTestId('settings-delete-button').click();
  const confirmation = this.page.getByTestId('settings-delete-dialog');
  await confirmation.getByRole('button', { name: 'Delete', exact: true }).click({ timeout: budget(this) });
  const result = await poll(async () => currentRoute(this), (route) => /^(posts|pages)(\?|$)/.test(route), budget(this) * 2);
  if (!result.ok) throw fail(`The post was not deleted: the admin is still on "${result.value}".`, 'Check the notifications for an error, and that the user may delete this post.');
  await waitForList(this);
});

// ---------------------------------------------------------------------------
// Cleaning up
// ---------------------------------------------------------------------------

/**
 * Make sure no post or page with a title exists, whatever its status: for the
 * start of a scenario that creates one and for cleaning up after it. It asks
 * the Admin API with the session of the browser, so somebody who may delete
 * the post must be signed in. It passes when there is nothing to delete.
 *
 * Example #1: Given there is no post titled "A post from the suite"
 * Example #2: Given there is no page titled "A page from the suite"
 * Example #3: And there is no post titled "Changed title"
 * Example #4: Then there is no post titled "A scheduled post from the suite"
 * Example #5: Given there is no page titled "Another page"
 *
 */
Given(/^there is no (post|page) titled "([^"]*)"$/, async function (type, title) {
  const found = await adminApiOrFail(this, 'GET', `/${type}s/?limit=all&fields=id,title&filter=${encodeURIComponent('title:' + nql(title) + '+status:[draft,published,scheduled,sent]')}`, undefined, `look for the ${type} "${title}"`);
  for (const item of found.json[type + 's'] || []) {
    await adminApiOrFail(this, 'DELETE', `/${type}s/${item.id}/`, undefined, `delete the ${type} "${title}"`);
  }
  // A list that is on the screen still shows what was just deleted: refresh it.
  if (/^(posts|pages)(\?|$)/.test(currentRoute(this)) && (found.json[type + 's'] || []).length) {
    await this.page.reload();
    await waitForAdmin(this);
    await waitForList(this);
  }
});
