# End-to-End Tests

This README provides guidelines for running, writing, and debugging end-to-end tests in the `pixiebrix-extension`
repository using [Playwright](https://playwright.dev/).

## Running Tests

Execute these steps from the project root to run tests:

One-time setup:

- Set up your .env file:
  - Copy `.env.example` to `.env.development`.
  - Fill in the required values:
    - The test user password `E2E_TEST_USER_PASSWORD_UNAFFILIATED`
    - Uncomment `REQUIRE_OPTIONAL_PERMISSIONS_IN_MANIFEST=1`
    - Uncomment `SHADOW_DOM=open`
    - Uncomment `DATADOG_CLIENT_TOKEN` (used for telemetry tests, can be set to a fake token, e.g. `secret123`)
    - Uncomment `DEV_EVENT_TELEMETRY` (used for telemetry tests, actual telemetry requests should be mocked during testing)
- Install browsers: Execute `npx playwright install chromium chrome msedge`.

1. Install dependencies: Run `npm install`
2. Build the extension: Run: `npm run watch`
3. Run the tests: Use the command `npm run test:e2e`.

- To run tests in interactive UI mode, use `npm run test:e2e -- --ui`. This view shows you the entire test suite and
  allows you to run individual tests in a specific browser.
  - If this is the first time you've run the tests in interactive mode, the tests may be filtered. Expand the collapsed section next to the Filter searchbox to see the filterable "projects"
  - For faster local development, you can filter out the setup projects to skip rerunning the authentication setup by unticking the `edgeSetup` and `chromeSetup` projects.
- You can also run specific test files in the CLI by providing a path matcher to the
  command: `npm run test:e2e -- smoke` (runs all tests with "smoke" in the path).
  - You can skip the auth setup by including the `--no-deps` flag.
  - See more cli arguments here: https://playwright.dev/docs/test-cli
- You can also run tests within the Intellij IDE by clicking on the play button next to the test definition. (
  until [this Jetbrains issue](https://youtrack.jetbrains.com/issue/AQUA-711/Provide-a-run-configuration-for-Playwright-tests-in-specs-with-fixture-imports-only)
  is resolved, you must include an unused playwright import as shown
  in [this test](https://github.com/pixiebrix/pixiebrix-extension/blob/7826c6549be0dbcbab32a8dfbaef472a3fdc22e9/end-to-end-tests/tests/workshopPageSmoke.spec.ts#L21)
  for the IDE to recognize the test)

## Writing Tests

Adhere to these principles, based on the [Playwright Best Practices](https://playwright.dev/docs/best-practices):

- Utilize `test` from `testBase.ts` for test environment setup and extension interaction.
- Employ page objects from `./end-to-end-tests/pageObjects` for web page interactions.
- Ensure tests are self-contained, leveraging [Playwright fixtures](https://playwright.dev/docs/test-fixtures) for shared setup/teardown.
- Use the [recommended built-in locator methods](https://playwright.dev/docs/locators#quick-guide) that have auto-waiting and retry features.

When testing mod functionality, use our testing playground website, https://pbx.vercel.app, for a consistent
environment. It is configured
as the base url for e2e tests. Ex. `await page.goto("/bootstrap-5");` will bring you to the bootstrap-5 page on the
playground.
The source for this website is: https://github.com/pixiebrix/playground

Focus on testing high-level user behavior and integration points, avoiding duplication of unit test coverage. Each
test should represent one full feature flow, which may include multiple steps and assertions. Avoid splitting
a single feature flow across multiple tests, preferring longer tests if necessary.

## Debugging Tests

If a test fails, use Playwright's tools:

- Insert `await page.pause()` inline in tests and run playwright in debug mode using `npm run test:e2e:debug` to
  activate Playwright's Inspector enabling you to inspect the browser and step through execution. You can also record
  steps and selectors in the Inspector for ease of debugging and writing new tests.
  - Use the UI mode in debug mode for easier test debugging selection `npm run test:e2e:debug -- --ui`.
- Slow down test execution: Execute `SLOWMO=1 npm run test:e2e`.
- Confirm element presence: Use `expect(page).toHaveSelector('.selector', { timeout: 5000 })`.
- Local failed test runs will automatically display reports with trace details in the browser.

### Troubleshooting

#### Test failed with `Timed out 5000ms waiting for expect(locator).toBeVisible()` when locator is hidden

Example error details:

```
Locator: getByRole('table').locator('.list-group-item').first()
    Expected: visible
    Received: hidden
```

This error arises when Playwright anticipates an element to be visible, but it's hidden. Playwright doesn't retry the
assertion if the element is hidden, leading to an immediate failure.

To resolve this, utilize the `ensureVisibility` helper function from `./utils.ts`. This function waits for the element
to become visible, even if it's initially hidden or unmounted.

## Test Infrastructure

The tests are configured to run the extension on both Chrome and Edge.

### Fixtures

Use the fixture file `./fixtures/testBase.ts` for test environment setup. It exports a `test` object that enhances
Playwright's built-in `test` object with extension-specific features.

### Playwright Configuration

Configure test execution via `.playwright.config.ts`, including timeout and retry options. The setup
projects run `./auth.setup.ts` which handles user authentication and saves the path to the logged in and linked profile
paths in `.auth`.

### GitHub CI Integration

End-to-end tests are integrated into the GitHub CI workflow, triggering on pull requests. The workflow steps are
detailed in `.github/workflows/ci.yml`.

If a test fails in CI, the test report is available in the GitHub Actions tab of the pull request. Download the
artifact and uncompress using 7zip, with [the password from 1password](https://start.1password.com/open/i?a=INRFJCYAHREKFCNIGK4M7FYRHM&h=pixiebrix.1password.com&i=tlcba2tv4w3uygsbhfxtcr6zfi&v=os4xtpugongs7htmnsbvoeaujm):
`7zz x -o./playwright-report ./playwright-report.7z`
(For context on why password encryption is necessary, see [this PR](https://github.com/pixiebrix/pixiebrix-extension/pull/8545))

To view the test report in the browser. Run: `npx playwright show-report <path-to-downloaded-report>` to
open the report in the playwright report viewer.

## Additional Resources

For comprehensive Playwright testing information, consult
the [Playwright Documentation](https://playwright.dev/docs/intro).
