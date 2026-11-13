module.exports = {
  default: {
    // The step timeout is webship-js's (45 s, set when it loads): WEBSHIP_STEP_TIMEOUT=<milliseconds> changes it; a `timeout` key here is ignored.
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions (auto HTML report on exit; disable: WEBSHIP_REPORT_DISABLE=1).
      // 'node_modules/webship-js/tests/step-definitions-diffy/**/*.js', // Diffy step definitions (optional).
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    // FEATURES=tests/features/a.feature,tests/features/b.feature runs a subset.
    paths: process.env.FEATURES ? process.env.FEATURES.split(',') : ['tests/features/**/*.feature'],
    // CUCUMBER_TAGS=@critical runs a lane; the default keeps work in progress out.
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @auth-setup',
    format: [
      '@cucumber/pretty-formatter',
      'json:tests/reports/cucumber_report.json',
    ],
    formatOptions: {
      colorsEnabled: true,
      theme: {
        'feature keyword': ['bold', 'blue'],
        'feature name': ['blue', 'underline'],
        'feature description': ['blueBright'],
        'scenario keyword': ['bold', 'magenta'],
        'scenario name': ['magenta', 'underline'],
        'step keyword': ['bold', 'green'],
        'step text': ['greenBright', 'italic'],
      },
    },
    worldParameters: {
      // The default is the local DDEV site that scripts/build-site.sh builds (project "ghoststeps"),
      // never a site of somebody else: the suite signs in with the accounts below and edits content.
      // LAUNCH_URL points it at another site; it must be the address the site itself is configured with.
      launchUrl: process.env.LAUNCH_URL || 'https://ghoststeps.ddev.site',
      // The mailbox that catches the mail of the test site (the Mailpit of the DDEV project): the
      // membership steps read the sign in link from it. No e-mail leaves the machine.
      mailUrl: process.env.MAIL_URL || (process.env.LAUNCH_URL || 'https://ghoststeps.ddev.site').replace(/\/+$/, '') + ':8026',
      // Video of the browser: 'off', 'on', 'on-failure' or 'tag' (scenarios tagged @video; @no-video opts out).
      video: { mode: process.env.WEBSHIP_VIDEO || 'off', dir: './videos', size: { width: 1280, height: 720 }, filenamePattern: '{datetime}.{feature_file}.{scenario}.{status}.{ext}' },
      // JavaScript errors the page raises: 'warn' reports them, 'fail' fails the scenario, 'off' ignores them; @js-fail, @js-warn and @js-off per scenario.
      // Off by default here: the admin app logs an error for every request a signed-out or restricted user is refused, which is what many scenarios are about.
      javascript: { mode: process.env.WEBSHIP_JS_ERROR_MODE || 'off', levels: ['error'], ignore: '', beforeScenario: false, afterScenario: true },
      // The staff accounts the steps sign in with, by handle. They are configuration, not test data:
      // the site build creates them once (scripts/seed-site.js) and a feature never creates or deletes
      // staff users. Point the suite at another site with the SITE_* variables.
      //   owner          Owner          everything, including the settings
      //   administrator  Administrator  everything
      //   editor         Editor         every post and page, tags, staff below them
      //   author         Author         writes and publishes their own posts
      //   contributor    Contributor    writes their own drafts, cannot publish
      users: {
        owner: { name: 'Olivia Owner', role: 'Owner', email: process.env.SITE_OWNER_EMAIL || 'owner@example.com', password: process.env.SITE_OWNER_PASSWORD || 'Owner-Test-Key-2026' },
        administrator: { name: 'Adam Administrator', role: 'Administrator', email: process.env.SITE_ADMINISTRATOR_EMAIL || 'administrator@example.com', password: process.env.SITE_ADMINISTRATOR_PASSWORD || 'Administrator-Test-Key-2026' },
        editor: { name: 'Edith Editor', role: 'Editor', email: process.env.SITE_EDITOR_EMAIL || 'editor@example.com', password: process.env.SITE_EDITOR_PASSWORD || 'Editor-Test-Key-2026' },
        author: { name: 'Arthur Author', role: 'Author', email: process.env.SITE_AUTHOR_EMAIL || 'author@example.com', password: process.env.SITE_AUTHOR_PASSWORD || 'Author-Test-Key-2026' },
        contributor: { name: 'Connie Contributor', role: 'Contributor', email: process.env.SITE_CONTRIBUTOR_EMAIL || 'contributor@example.com', password: process.env.SITE_CONTRIBUTOR_PASSWORD || 'Contributor-Test-Key-2026' },
      },
      minWaitTime: {
        page: 3000,
        before_scenario: 0,
        after_scenario: 0,
        before_step: 0,
        after_step: 0,
      },
      selectors: {
        css: {},
        xpath: {},
        filesPath: './tests/selectors/',
        files: [],
        offset: 60,
        breakpoints: {
          xs:   { width: 375,  height: 667  },
          sm:   { width: 576,  height: 800  },
          md:   { width: 768,  height: 1024 },
          lg:   { width: 992,  height: 768  },
          xl:   { width: 1200, height: 900, default: true },
          xxl:  { width: 1400, height: 900  },
          xxxl: { width: 1920, height: 1080 },
        },
      },
      screenshot: {
        dir: './screenshots',
        purge: false,
        onFailed: true,
        onEveryStep: false,
        alwaysFullscreen: false,
        failedPrefix: 'failed_',
        filenamePattern: '{datetime}.{feature_file}.feature_{step_line}.{ext}',
        filenamePatternFailed: '{failed_prefix}{datetime}.{feature_file}.feature_{step_line}.{ext}',
        infoTypes: '',
      },
      // Diffy visual-regression (optional). Uncomment and set apiKey / projectId to enable.
      // diffy: {
      //   apiKey: '',                                 // DIFFY_API_KEY
      //   projectId: 0,                               // DIFFY_PROJECT_ID
      //   breakpoints: '640,1200',                    // DIFFY_BREAKPOINTS
      //   windowHeight: 2000,                         // DIFFY_WINDOW_HEIGHT
      //   screenshotsDir: '',                         // DIFFY_SCREENSHOTS_DIR
      //   baseUrl: 'https://app.diffy.website/api/',  // DIFFY_API_BASE_URL
      //   maxWait: 30,                                // DIFFY_MAX_WAIT (seconds)
      //   env1Url: '',                                // DIFFY_ENV1_URL
      //   env2Url: '',                                // DIFFY_ENV2_URL
      // },
    },
  },
};
