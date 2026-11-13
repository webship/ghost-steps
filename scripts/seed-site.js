'use strict';

// Completes the setup of a fresh Ghost install through its Admin API and fills
// it with the accounts and the content the suite expects. Runs inside the DDEV
// web container (scripts/build-site.sh calls it), against Ghost's own port, and
// reads the staff invitations from the Mailpit of the same container: nothing
// is e-mailed outside.
//
// It can run again on a site it has already seeded: what exists is left alone.

const fs = require('fs');
const path = require('path');

const SITE_URL = (process.env.SITE_URL || 'https://ghoststeps.ddev.site').replace(/\/+$/, '');
const GHOST = process.env.GHOST_INTERNAL_URL || 'http://127.0.0.1:2368';
const MAILPIT = process.env.MAILPIT_INTERNAL_URL || 'http://127.0.0.1:8025';
const API = GHOST + '/ghost/api/admin';

// The accounts of cucumber.js (worldParameters.users). One per staff role.
const OWNER = { name: 'Olivia Owner', email: 'owner@example.com', password: 'Owner-Test-Key-2026' };
const STAFF = [
  { name: 'Adam Administrator', email: 'administrator@example.com', password: 'Administrator-Test-Key-2026', role: 'Administrator' },
  { name: 'Edith Editor', email: 'editor@example.com', password: 'Editor-Test-Key-2026', role: 'Editor' },
  { name: 'Arthur Author', email: 'author@example.com', password: 'Author-Test-Key-2026', role: 'Author' },
  { name: 'Connie Contributor', email: 'contributor@example.com', password: 'Contributor-Test-Key-2026', role: 'Contributor' },
];

let cookie = '';

async function call(method, url, body, extraHeaders) {
  const headers = Object.assign({
    // Ghost sits behind the DDEV router: tell it the request was https, and
    // send the Origin its session check compares with the site address.
    'X-Forwarded-Proto': 'https',
    Origin: SITE_URL,
    'Accept-Version': 'v6.0',
  }, extraHeaders || {});
  if (cookie) headers.Cookie = cookie;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(url, { method, headers, body: payload, redirect: 'manual' });
  const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  for (const line of setCookie) {
    if (/^ghost-admin-api-session=/.test(line)) cookie = line.split(';')[0];
  }
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
  if (!response.ok) {
    throw new Error(`${method} ${url} answered ${response.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

const api = (method, endpoint, body) => call(method, API + endpoint, body);

async function signIn(account) {
  cookie = '';
  await api('POST', '/session/', { username: account.email, password: account.password });
}

async function setup() {
  const status = await api('GET', '/authentication/setup/');
  if (status.setup[0].status) {
    console.log('Setup: already done');
    return;
  }
  await api('POST', '/authentication/setup/', {
    setup: [{ name: OWNER.name, email: OWNER.email, password: OWNER.password, blogTitle: 'Test site' }],
  });
  console.log('Setup: done, owner ' + OWNER.email);
}

async function settings() {
  await api('PUT', '/settings/', {
    settings: [
      { key: 'title', value: 'Test site' },
      { key: 'description', value: 'A site for automated tests' },
      { key: 'timezone', value: 'Etc/UTC' },
      { key: 'navigation', value: JSON.stringify([{ label: 'Home', url: '/' }, { label: 'About', url: '/about/' }]) },
      { key: 'secondary_navigation', value: JSON.stringify([{ label: 'Sign up', url: '#/portal/' }]) },
      { key: 'explore_ping', value: false },
      { key: 'explore_ping_growth', value: false },
    ],
  });
  console.log('Settings: title, description, navigation');
}

async function mailFor(email, attempts) {
  for (let i = 0; i < (attempts || 30); i++) {
    const found = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + email)}`)).json();
    if (found.messages && found.messages.length) {
      return (await fetch(`${MAILPIT}/api/v1/message/${found.messages[0].ID}`)).json();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No e-mail for ${email} reached Mailpit at ${MAILPIT}. Is Ghost's mail transport pointed at it?`);
}

async function staff() {
  const roles = (await api('GET', '/roles/?limit=all')).roles;
  const users = (await api('GET', '/users/?limit=all&include=roles')).users;
  for (const person of STAFF) {
    if (users.find((user) => user.email === person.email)) {
      console.log(`Staff: ${person.email} exists`);
      continue;
    }
    const role = roles.find((candidate) => candidate.name === person.role);
    if (!role) throw new Error(`This Ghost has no "${person.role}" role; it has: ${roles.map((r) => r.name).join(', ')}`);
    const invites = (await api('GET', '/invites/?limit=all')).invites;
    if (!invites.find((invite) => invite.email === person.email)) {
      await api('POST', '/invites/', { invites: [{ email: person.email, role_id: role.id }] });
    }
    const mail = await mailFor(person.email);
    const match = /\/ghost\/(?:#\/)?signup\/([^/\s"'<>]+)/.exec(mail.Text || mail.HTML || '');
    if (!match) throw new Error(`The invitation e-mail for ${person.email} has no signup link.`);
    const session = cookie;
    cookie = '';
    await api('POST', '/authentication/invitation/', {
      invitation: [{ token: decodeURIComponent(match[1]), email: person.email, name: person.name, password: person.password }],
    });
    cookie = session;
    console.log(`Staff: ${person.email} (${person.role})`);
  }
  return (await api('GET', '/users/?limit=all&include=roles')).users;
}

async function featureImage() {
  const file = path.join(__dirname, 'feature.png');
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'image/png' }), 'feature.png');
  form.append('purpose', 'image');
  const uploaded = await call('POST', API + '/images/upload/', form);
  return uploaded.images[0].url;
}

async function content(users) {
  const id = (email) => users.find((user) => user.email === email).id;
  const existing = (await api('GET', '/posts/?limit=all&fields=slug')).posts.map((post) => post.slug);
  const image = await featureImage();
  const day = (n) => new Date(Date.UTC(2026, 0, n, 9, 0, 0)).toISOString();

  // Fourteen published posts: the default theme lists them on the home page and
  // the archives; with a small "posts per page" they also fill a second page.
  const posts = [
    { title: 'Welcome to the test site', slug: 'welcome-to-the-test-site', tags: ['News'], author: 'editor@example.com', featured: true, feature_image: image, feature_image_alt: 'Two colour bands', custom_excerpt: 'The first post of the test site.', html: '<p>This is the welcome post.</p><h2>A second heading</h2><p>It has two paragraphs and a heading.</p>' },
    { title: 'A guide to writing', slug: 'a-guide-to-writing', tags: ['Guides'], author: 'author@example.com', feature_image: image, html: '<p>Write the first draft quickly.</p>' },
    { title: 'A guide to editing', slug: 'a-guide-to-editing', tags: ['Guides'], author: 'editor@example.com', html: '<p>Edit the second draft slowly.</p>' },
    { title: 'News from the north', slug: 'news-from-the-north', tags: ['News', 'Travel'], author: 'author@example.com', html: '<p>The north reports snow.</p>' },
    { title: 'News from the south', slug: 'news-from-the-south', tags: ['News', 'Travel'], author: 'editor@example.com', html: '<p>The south reports sun.</p>' },
    { title: 'Members only notes', slug: 'members-only-notes', tags: ['News'], author: 'editor@example.com', visibility: 'members', html: '<p>These notes are for members.</p>' },
  ];
  for (let n = 1; n <= 8; n++) {
    posts.push({ title: `Travel diary ${n}`, slug: `travel-diary-${n}`, tags: ['Travel'], author: n % 2 ? 'author@example.com' : 'editor@example.com', html: `<p>Day ${n} of the journey.</p>` });
  }
  let n = 0;
  for (const post of posts) {
    n += 1;
    if (existing.includes(post.slug)) continue;
    await api('POST', '/posts/?source=html', {
      posts: [{
        title: post.title, slug: post.slug, html: post.html, status: 'published', published_at: day(n + 1),
        tags: post.tags.map((name) => ({ name })), authors: [{ id: id(post.author) }],
        featured: !!post.featured, feature_image: post.feature_image || null, feature_image_alt: post.feature_image_alt || null,
        custom_excerpt: post.custom_excerpt || null, visibility: post.visibility || 'public',
      }],
    });
  }
  const drafts = [
    { title: 'An unfinished draft', slug: 'an-unfinished-draft', author: 'editor@example.com', html: '<p>Not ready yet.</p>' },
    { title: 'A draft by the author', slug: 'a-draft-by-the-author', author: 'author@example.com', html: '<p>The author is still writing.</p>' },
    { title: 'A draft by the contributor', slug: 'a-draft-by-the-contributor', author: 'contributor@example.com', html: '<p>The contributor is still writing.</p>' },
  ];
  for (const draft of drafts) {
    if (existing.includes(draft.slug)) continue;
    await api('POST', '/posts/?source=html', {
      posts: [{ title: draft.title, slug: draft.slug, html: draft.html, status: 'draft', authors: [{ id: id(draft.author) }] }],
    });
  }
  const pages = (await api('GET', '/pages/?limit=all&fields=slug')).pages.map((page) => page.slug);
  if (!pages.includes('contact')) {
    await api('POST', '/pages/?source=html', {
      pages: [{ title: 'Contact', slug: 'contact', html: '<p>Write to the test site.</p>', status: 'published' }],
    });
  }
  if (!pages.includes('about')) {
    await api('POST', '/pages/?source=html', {
      pages: [{ title: 'About', slug: 'about', html: '<p>About the test site.</p>', status: 'published' }],
    });
  }
  // The tags get a description, which the tag archive shows.
  const tags = (await api('GET', '/tags/?limit=all')).tags;
  for (const tag of tags) {
    if (tag.name === 'Guides' && !tag.description) {
      await api('PUT', `/tags/${tag.id}/`, { tags: [{ description: 'How to do things.', updated_at: tag.updated_at }] });
    }
  }
  console.log(`Content: ${posts.length} posts, ${drafts.length} drafts, pages, tags`);
}

async function members() {
  const existing = (await api('GET', '/members/?limit=all')).members.map((member) => member.email);
  const people = [
    { name: 'Mary Member', email: 'member@example.com', labels: [{ name: 'Reader' }], note: 'Created by the site build.' },
    { name: 'Vera Visitor', email: 'vera@example.com', labels: [{ name: 'Reader' }, { name: 'Friend' }] },
    { name: 'Noel Newcomer', email: 'noel@example.com', labels: [] },
  ];
  for (const person of people) {
    if (existing.includes(person.email)) continue;
    await api('POST', '/members/', { members: [person] });
  }
  console.log(`Members: ${people.length}`);
}

(async () => {
  await setup();
  await signIn(OWNER);
  await settings();
  const users = await staff();
  await content(users);
  await members();
  // The invitations are used: empty the mailbox so the suite starts clean.
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
  console.log('Seeded ' + SITE_URL);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
