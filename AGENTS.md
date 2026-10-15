# AGENTS.md — stora-utils

Instructions for AI coding agents working in this repository. Full handover documentation: [`docs/HANDOVER.md`](docs/HANDOVER.md).

## What this is

`@storatech/stora-utils`: the shared TypeScript library used by almost every Node service of Stora (stora.mn) and by some frontends. It provides logging (log4js), Express helpers and error types, a MongoDB wrapper, AWS SQS/SNS messaging, S3 file storage, Redis pub/sub, money calculation, validation, XML and small utilities. It is compiled with `tsc` to CommonJS and published to GitHub Packages from `dist/`. About 18 repos depend on it on both the 1.x and 2.x lines (consumer table in `docs/HANDOVER.md` §1).

## Commands

```bash
npm install          # public npm only, no token needed (package-lock.json is gitignored)
npm run build        # rm -rf dist && tsc -p . && cp package.json dist
npx ts-standard      # lint (no npm script; main currently has 5 known findings)
npm test             # ts-node src/test.ts — currently a no-op, the file is all comments
```

There is no automated test suite. `src/tests/*.ts` are manual scripts that need real AWS/Mongo. **Never run `npm run package`**: it publishes.

To try a change in a consumer without publishing:

```bash
npm run build && (cd dist && npm pack)    # creates dist/storatech-stora-utils-<version>.tgz
cd ../stora-api && pnpm add ../stora-utils/dist/storatech-stora-utils-<version>.tgz
# test it, then revert the consumer's package.json and lockfile; never commit this
```

## Map

- `src/utilities.ts` → `/utilities`: `isNil`, `isNonEmptyString`, `isNonEmptyValue`, `keyBy`, `uniqBy`, `combineUrls`, `escapeXml` (runs in browsers)
- `src/money/` → `/money`: `MoneyCalculator`, `CURRENCIES`, `NumberMoney`/`StringMoney` types (runs in browsers)
- `src/express/` → `/express`: `ApiRequest`/`ApiResponse` types, `ApiException`, `ApiErrorCode`, `HttpStatus`, `expressErrorHandler`, `expressNotFoundHandler`
- `src/logger/` → `/logger` (importing it configures log4js), `/logger/config`, `/logger/express`, `/logger/koa`, `/logger/axios`
- `src/database/` → `/database`: `Mongo(url, db)` wrapper with nested `withTransaction`, `MongoCollection<T>(name)`
- `src/messaging/` → `/messaging`: SQS `MessageQueue` (`produce`, `startConsume`, deprecated `consume`), SNS `MessageTopic`
- `src/redis/` → `/redis`: shared `redis` client (consumer connects it), `PubSubChannel<T>`
- `src/concurrency/` → `/concurrency`: `ThreadPool(size)` in-process async task pool
- `src/event/` → `/event`: `Topic<T>()` in-process EventEmitter pub/sub with timeouts
- `src/file-storage/` → `/file-storage`: `S3FileStorage({ bucket, cdnPath })`
- `src/analytics/` → `/analytics`: `sendAnalyticsEvent(event, data)` into a Mongo `analytics` collection
- `src/validation.ts` → `/validation`: registers extra validate.js validators on import, exports the `Constraint<T>` type
- `src/xml/` → `/xml`, `/xml/types`: typed sax-based XML parse and format
- `src/random/` → `/random` · `src/hash/` → `/hash` (MD5) · `src/transliterate/` → `/transliterate` (Mongolian Cyrillic to Latin)
- `src/index.ts`: root import only prints a warning. `src/test.ts`, `src/tests/`, `src/*/test.ts`: manual scripts (they are compiled and published too)

## Conventions

- ts-standard style: no semicolons, single quotes, 2 spaces, explicit return types. One `getLogger('<category>')` per file; no `console`.
- Modules are factory functions that return object literals (`MessageQueue(...)`, `Mongo(...)`, `S3FileStorage(...)`), with a type alias for the factory and a re-export in the folder's `index.ts`.
- There is no `exports` map, so **every file path under `src/` is public API**. Consumers import deep paths such as `logger/config`, `logger/axios`, `xml/types`, `money/money-calculator`, `concurrency/thread`, `file-storage/types` and `utilities.js`. Do not move or rename files.
- `utilities` and `money` are bundled by Next.js/React apps (stora-web, stora-logistics-web, stora-panels-hub, stora-hooks, store-for-good). Keep them free of Node and third-party imports.
- Third-party runtime packages are devDependencies here, so consumers install them themselves (peer-style). A new third-party import forces every consumer of that module to add a dependency. Prefer Node built-ins.
- Keep `tsconfig.json` on `target: es5` / `module: commonjs`. `src/logger/express.ts` only works because arrow functions compile to ES5 functions.

## Guardrails

- This is a shared library. Never remove or rename an export, file, parameter or enum value. Never change a default, log category, message format or retry/delete behaviour without a version bump and a note in `docs/HANDOVER.md`.
- Semver: patch for a fix with no API change, minor for additions, major for removals or behaviour changes. Every `^2.x` consumer picks up a new 2.x on its next install.
- **Every push to `main` publishes** the `version` in `package.json` (`.github/workflows/main.yml`). Bump `version` in the same PR, and never reuse a version (the publish step fails).
- 2.8.0 is already published, but its source is not in this repo (see `docs/HANDOVER.md` §5). The next version must be greater than 2.8.0, and the 2.8.0 additions must be restored first, or the next release will silently remove them.
- 1.x consumers (notification-core, stora-locker-api, stora-scripts) do not receive 2.x changes. Do not assume a fix reaches them.
- Don't publish, push, tag or trigger the workflow unless asked. Don't edit the GitHub Actions workflow without being asked.
- Secrets: never commit tokens, keys, connection strings or account IDs, and never put `_authToken` in the repo `.npmrc`. The repo is public. Don't copy values from `test.xml` or git history.
- Don't add new import-time side effects (several modules already configure log4js, create AWS/Redis clients or register validators on import).
- Before fixing a bug, check `docs/HANDOVER.md` §7. Update it when you fix or find something.

## How to verify a change

1. `npm run build` must pass (`strict` tsc). Run `npx ts-standard` on the files you touched.
2. Compare the public surface. Build `main` first and copy `dist` to a temp folder, then build your branch and run `diff -r -x '*.js' <temp-folder> dist`. Only intended `.d.ts` additions should appear.
3. Pack the build (see Commands), install it in at least one consumer that uses the module (`docs/HANDOVER.md` §1), and exercise the changed code path. For messaging or database changes, use the dev environment, never prod.
4. Bump `version`, then update `docs/HANDOVER.md` (§4 module reference, §5 release history, §7 issues).
