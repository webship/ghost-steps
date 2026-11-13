# ghost-steps

Cucumber step definitions for testing Ghost sites with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

`@webship-js/ghost-steps` covers the admin (signing in and out by account
handle, the admin menu and what each staff role may open, notifications,
dialogs, action menus and the admin search), the editor (title, text, cards,
the settings panel, feature image, preview, publish, schedule, unpublish,
update, delete), the lists of posts, pages, tags and members with their
filters, sorting and search, tags, members and labels, staff and roles, the
settings (title and description, navigation links, the announcement bar) and
the front end (the kind of page, archives and their pages, the post feed, the
navigation, the search of the site, the membership form with the link and the
code the site e-mails). The steps are written against the markup of Ghost 6
and its default theme.

No step phrase carries the name of the platform: `I am logged in to the admin
as "editor"`, `I publish the post`, `the page should be a tag archive`.

CI installs the real platform with [DDEV](https://ddev.com) on the runner,
seeds it through its Admin API and runs the whole suite against it on every
push and pull request; see
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (`webship-js` 2.0.10 or later)
- A Ghost 6 site to test. The front end steps read what the platform prints
  for any theme (`{{body_class}}`, `{{ghost_head}}`, the search and membership
  scripts); the reference features use the default theme.

## Install

```bash
npm install --save-dev @webship-js/ghost-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/ghost-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the site, name the staff accounts the suite signs in
   with (see [Accounts](#accounts)) and, for the membership steps, the mailbox
   that catches the mail of the test site:

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-site.example',
     mailUrl: process.env.MAIL_URL || 'https://your-site.example:8026',
     users: {
       owner: { email: 'owner@example.com', password: process.env.SITE_OWNER_PASSWORD },
       editor: { email: 'editor@example.com', password: process.env.SITE_EDITOR_PASSWORD },
     },
   },
   ```

   `launchUrl` must be the address the site itself is configured with: the
   admin refuses a session from another origin.

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and adjust the titles, tags and members to the content of your site.

4. Run the suite:

   ```bash
   npx cucumber-js
   ```

## What is included

| Path | Purpose |
| --- | --- |
| `tests/step-definitions/ghost.steps.js` | The admin as a whole: signing in and out, the session, the admin menu and its screens, the user menu, notifications, field errors, dialogs, action menus and the admin search. |
| `tests/step-definitions/ghost-editor.steps.js` | Posts and pages in the editor: title, text, cards, the settings panel (URL, tags, access, excerpt, featured), the feature image, preview, publish, schedule, unpublish, update and delete. |
| `tests/step-definitions/ghost-admin.steps.js` | The lists of posts, pages, tags and members with filters, sorting and search; tags; members and labels; staff users and roles; the settings, the navigation links and the announcement bar. |
| `tests/step-definitions/ghost-site.steps.js` | The front end: the kind of page, archives and their pages, the post feed, the navigation, the announcement bar, the search of the site, the membership form and the mailbox of the test site. |
| `tests/step-definitions/ghost-helpers.js` | Shared plumbing. It registers no step. |
| `tests/features/*.feature` | Reference features for the test site that `scripts/build-site.sh` builds. |
| `scripts/build-site.sh`, `scripts/seed-site.js` | Build the test site in one DDEV project and fill it with the accounts and the content the features expect. |

The reference features use the titles, tags, members and accounts of that test
site ("Travel diary 8", the tag "Guides", "member@example.com"). When you copy
a feature, replace those values with the content of your site. The steps carry
no site data: every title, label and address is a parameter.

## Accounts

Feature files never carry a credential. The `users` registry of `cucumber.js`
maps a handle to a staff account, and the steps take the handle:

```gherkin
Given I am logged in to the admin as "editor"
Then I should be logged in to the admin as "editor"
```

The accounts are configuration, not test data. The site build creates them
once and a feature never creates, invites or deletes a staff user. Members that
a sign up scenario creates are content: the scenario removes them.

`cucumber.js` defines five handles, one per staff role. Each can be replaced
from the environment (`SITE_<HANDLE>_EMAIL`, `SITE_<HANDLE>_PASSWORD`).

| Handle | Role | May |
| --- | --- | --- |
| `owner` | Owner | everything, including the settings |
| `administrator` | Administrator | everything |
| `editor` | Editor | every post and page, tags, the staff below them |
| `author` | Author | write and publish their own posts |
| `contributor` | Contributor | write their own drafts; cannot publish |

The steps sign in through the sign in form. A site that asks a new device for
an e-mailed code cannot be signed in to by a suite: the test site sets
`security.staffDeviceVerification` to `false`.

## A test site

[`scripts/build-site.sh`](scripts/build-site.sh) installs the platform the
official way (its command line installer) inside one DDEV project, with MySQL
from DDEV and the mail going to the Mailpit of the project, so no e-mail leaves
the machine. [`scripts/seed-site.js`](scripts/seed-site.js) then completes the
setup through the Admin API: the five staff accounts, 14 published posts and 3
drafts, 2 pages, 3 tags, 3 members with labels and the navigation. It is what
CI runs.

```bash
SITE_DIR=$HOME/ghoststeps scripts/build-site.sh
```

The site answers at `https://ghoststeps.ddev.site`, the address `cucumber.js`
uses when `LAUNCH_URL` is not set; its mailbox is at
`https://ghoststeps.ddev.site:8026`. With another `PROJECT_NAME`, set
`LAUNCH_URL=https://<project name>.ddev.site`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `GHOST_VERSION` | `6.77.0` | The release to install. |
| `NODE_VERSION` | `22.23.5` | The Node.js version of the container. |
| `PROJECT_NAME` | `ghoststeps` | The DDEV project name. |
| `SITE_DIR` | a temporary folder | The project folder. |

The update check, the avatar lookup and the directory ping are switched off; no
payment or hosted service is connected. Remove the site with
`ddev delete -Oy ghoststeps`.

## Steps

Every Then step reads both polarities from one phrase (`should` or `should
not`) where both make sense. Every When and Then step takes `I`, `we` or no
pronoun. Every failure is a message with a hint, not a Playwright stack.
Assertions wait on their locator for the `minWaitTime.page` budget (at least 10
seconds); nothing sleeps for a fixed time. The admin is a single-page app: the
steps wait on what it renders itself (the user menu, a list, the status of the
editor, a notification, a dialog).

The JSDoc block above each step in the files of
[`tests/step-definitions/`](tests/step-definitions/) holds its regular
expression and five Gherkin examples; `npm run test:examples` checks every
example and every feature step against the definitions. This is the summary.

### The admin: session, menu, notifications, dialogs, search

`tests/step-definitions/ghost.steps.js`

| Step | Type |
| --- | --- |
| `I am logged in to the admin as "<handle>"` | Given |
| `I try to log in to the admin with the email "<email>" and the password "<password>"` | When |
| `I should see the sign in error "<message>"` | Then |
| `I log out of the admin` | When |
| `I should( not) be logged in to the admin( as "<handle>")` | Then |
| `I (go to\|am on) the admin screen "<name>"` | When |
| `I should( not) be on the admin screen "<name>"` | Then |
| `the admin screen "<name>" should not be available` | Then |
| `I should( not) see "<name>" in the admin menu` | Then |
| `I click "<name>" in the admin menu` | When |
| `the user menu should show "<text>"` | Then |
| `I should( not) see the notification "<text>"` | Then |
| `I dismiss the notifications` | When |
| `I should( not) see the field error "<text>"` | Then |
| `I should( not) see the dialog "<text>"` | Then |
| `I answer the dialog with "<name>"` | When |
| `I choose "<item>" from the "<name>" menu` | When |
| `I search the admin for "<query>"` | When |
| `I should( not) see the admin search result "<title>"` | Then |
| `I open the admin search result "<title>"` | When |

### The editor and the publish flow

`tests/step-definitions/ghost-editor.steps.js`

| Step | Type |
| --- | --- |
| `I start a new (post\|page)` | When |
| `I open the editor of the (post\|page) "<title>"` | When |
| `I leave the editor` | When |
| `I set the editor title to "<title>"` | When |
| `I write "<text>" in the editor` | When |
| `I add a(n) "<name>" card( with the text "<text>") to the editor` | When |
| `I add an image card to the editor from the file "<file>"` | When |
| `the editor should have <count> "<name>" card(s)` | Then |
| `the editor title should be "<title>"` | Then |
| `the editor should( not) contain "<text>"` | Then |
| `I wait for the editor to save` | When |
| `the editor status should be "<status>"` | Then |
| `the editor should( not) offer "<name>"` | Then |
| `I (open\|close) the (post\|page) settings` | When |
| `the (post\|page) settings should( not) offer "<label>"` | Then |
| `I set the (post\|page) URL to "<slug>"` | When |
| `the (post\|page) URL should be "<slug>"` | Then |
| `I add the tag "<name>" to the (post\|page)` | When |
| `I remove the tag "<name>" from the (post\|page)` | When |
| `the (post\|page) should( not) have the tag "<name>"` | Then |
| `I set the (post\|page) access to "<access>"` | When |
| `the (post\|page) access should be "<access>"` | Then |
| `I set the excerpt to "<text>"` | When |
| `the excerpt should be "<text>"` | Then |
| `I (feature\|stop featuring) the (post\|page)` | When |
| `the (post\|page) should( not) be featured` | Then |
| `I set the feature image to the file "<file>"` | When |
| `I remove the feature image` | When |
| `the (post\|page) should( not) have a feature image` | Then |
| `I preview the (post\|page)` | When |
| `the preview should( not) show "<text>"` | Then |
| `I close the preview` | When |
| `I open the publish dialog` | When |
| `the publish dialog should say "<text>"` | Then |
| `I close the publish dialog` | When |
| `I publish the (post\|page)` | When |
| `the publish confirmation should say "<text>"` | Then |
| `I close the publish confirmation` | When |
| `I schedule the (post\|page) for "<YYYY-MM-DD>" at "<HH:mm>"` | When |
| `I unpublish the (post\|page)` | When |
| `I update the (post\|page)` | When |
| `I delete the (post\|page) from the editor` | When |
| `there is no (post\|page) titled "<title>"` | Given |

### Lists, tags, members, staff and settings

`tests/step-definitions/ghost-admin.steps.js`

| Step | Type |
| --- | --- |
| `I should( not) see the (post\|page\|tag\|member) "<title>" in the list` | Then |
| `the (post\|page) "<title>" should have the status "<status>" in the list` | Then |
| `the list should have <count> (items\|posts\|pages\|tags\|members)` | Then |
| `the first row of the list should be "<title>"` | Then |
| `I filter the list by "<name>"( with "<value>")` | When |
| `I clear the list filters` | When |
| `I sort the list by "<order>"` | When |
| `I open the (tag\|member) "<name>" from the list` | When |
| `I set the tag (name\|slug\|description) to "<value>"` | When |
| `the tag (name\|slug\|description) should be "<value>"` | Then |
| `I save the tag` | When |
| `I delete the tag` | When |
| `the tag "<name>" should have <count> post(s)` | Then |
| `there is no tag named "<name>"` | Given |
| `I search the members for "<query>"` | When |
| `I set the member (name\|email\|note) to "<value>"` | When |
| `I add the label "<name>" to the member` | When |
| `the member should( not) have the label "<name>"` | Then |
| `the member should( not) be ready to save` | Then |
| `I save the member` | When |
| `I delete the member` | When |
| `there is no member with the email "<email>"` | Given |
| `I should( not) see the staff user "<name>" with the role "<role>"` | Then |
| `I open the staff user "<name>"` | When |
| `the staff user (email\|role\|full name\|slug) should be "<value>"` | Then |
| `I close the staff user` | When |
| `the staff invitation should( not) offer the role "<role>"` | Then |
| `I go to the settings section "<title>"` | When |
| `the settings section "<title>" should( not) show "<text>"` | Then |
| `I press "<name>" in the settings section "<title>"` | When |
| `I set "<label>" to "<value>" in the settings section "<title>"` | When |
| `I open the navigation settings` | When |
| `I add the navigation link "<label>" with the address "<address>"` | When |
| `I remove the navigation link "<label>"` | When |
| `the navigation settings should( not) list the link "<label>"` | Then |
| `I save the navigation settings` | When |
| `the navigation has no link "<label>"` | Given |
| `I announce "<text>" to "<audience>"` | When |
| `I clear the announcement` | When |
| `there is no announcement` | Given |

### The front end, the membership form and the mailbox

`tests/step-definitions/ghost-site.steps.js`

| Step | Type |
| --- | --- |
| `the page generator should start with "<prefix>"` | Then |
| `the page should( not) be (the home page\|a post\|a page\|a tag archive\|an author archive)` | Then |
| `the page should be the (tag\|author) archive of "<slug>"` | Then |
| `the archive should be on page <number>` | Then |
| `the archive should( not) have a (next\|previous) page` | Then |
| `I go to the (next\|previous) page of the archive` | When |
| `I should( not) see the post "<title>" in the post feed` | Then |
| `the post feed should have <count> post(s)` | Then |
| `I should( not) see "<label>" in the site navigation` | Then |
| `I should( not) see the announcement "<text>"` | Then |
| `I open the site search` | When |
| `I search the site for "<query>"` | When |
| `I should( not) see the site search result "<title>"` | Then |
| `I open the site search result "<title>"` | When |
| `I close the site search` | When |
| `I open the membership (sign in\|sign up\|account) form` | When |
| `I fill in "<label>" with "<value>" in the membership form` | When |
| `I submit the membership form` | When |
| `the membership form should( not) show "<text>"` | Then |
| `I close the membership form` | When |
| `I should( not) see a subscribe button` | Then |
| `the post should( not) be restricted to members` | Then |
| `I should( not) be signed in as (a member\|the member "<email>")` | Then |
| `I sign out as a member` | When |
| `the mailbox is empty` | Given |
| `an e-mail with the subject "<subject>" should have been sent to "<address>"` | Then |
| `I follow the link e-mailed to "<address>"` | When |
| `I enter the code e-mailed to "<address>" in the membership form` | When |
| `the membership notification should say "<text>"` | Then |

## Notes

- The settings of an Owner or an Administrator and the editor are screens of
  their own without the admin menu; `I log out of the admin` returns to the
  posts first.
- The items of the action menus ("Actions", "Tag actions", "Member actions",
  the user menu) are menu items, which the click steps of webship-js do not
  reach: use `I choose "<item>" from the "<name>" menu`.
- Publishing closes the editor: the confirmation ("Boom! It's out there.")
  shows over the list of posts.
- The membership form and the search of the site render in frames of their own;
  the steps look inside them.
- `the response status code should be <n>` and the REST and API request steps
  of webship-js work on a local HTTPS site since webship-js 2.0.10.
- The steps that start with `there is no ...` and `the navigation has no link`
  clean up through the Admin API with the session of the browser: sign in
  first.

## Development

```bash
npm ci
npx playwright install chromium
scripts/build-site.sh            # builds https://ghoststeps.ddev.site
npm run test:examples            # every example and feature step resolves to one definition
npx cucumber-js --dry-run        # no undefined, no ambiguous step
npx cucumber-js                  # the whole suite, against the real site
```

`FEATURES=tests/features/tags.feature npx cucumber-js` runs one feature;
`CUCUMBER_TAGS=@critical npx cucumber-js` runs a lane.

## License

MIT
