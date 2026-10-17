# stora-utils — Handover Documentation

Last updated: 2026-10-16.

This document is for the next developer (or team) taking over **stora-utils** (`@storatech/stora-utils`). For coding conventions and guardrails, see [AGENTS.md](../AGENTS.md). It is written for AI agents, but humans can use it as a quick reference too.

Everything below comes from the code, `package.json`, the CI workflow, git history, the GitHub API (forks, PRs) and the consumer repositories (checked out next to this repo) as of the date above. Items marked "confirm with the team" could not be verified from those sources.

---

## 1. Overview

**stora-utils** is the shared TypeScript library used by almost every Node service of Stora (stora.mn), a Mongolian retail and cross-border e-commerce company. Some React/Next.js frontends use it too. It bundles the building blocks every service needs:

- logging (log4js with request ids, plus Express, Koa and axios middleware)
- the Express API error contract (`ApiException`, `ApiErrorCode`, error and not-found handlers)
- a MongoDB client wrapper with nested transactions
- AWS SQS queues and SNS topics, S3 file storage, and Redis pub/sub
- money calculation and formatting (MNT, USD, USc, CNY)
- validate.js extensions, typed XML parse/format, and small utilities

| Item | Value |
|---|---|
| Repository | `storatech/stora-utils` on GitHub (default branch `main`; GitHub reports it as **public**) |
| Package | `@storatech/stora-utils` on GitHub Packages (`https://npm.pkg.github.com/storatech`) |
| Version on `main` | 2.7.0 (commit `d50d0fc`, 2024-11-12) |
| Newest published version | **2.8.0**, which has no matching source in git (see §5.3) |
| Import style | Subpaths only, e.g. `@storatech/stora-utils/express`. The root import only prints `stora-utils: use specific imports` |

### Consumers

"Installed" is the version found in each repo's `node_modules` on 2026-10-16. Because ranges like `^2.0.0` resolve to the newest 2.x at install time, several repos that ask for `^2.7.0` or lower have 2.8.0 installed. "Modules used" comes from grepping imports, most used first.

| Repo | Kind | Requires | Installed | Modules used |
|---|---|---|---|---|
| `ecommerce-core` | backend | `^2.8.0` | 2.8.0 | utilities, express, money, validation, messaging, logger (+`logger/express`), redis, event, database, concurrency |
| `stora-amazon` | backend (Express 5) | `^2.8.0` | 2.8.0 | logger, `logger/express`, express |
| `stora-scrapers` | backend (Serverless) | `^2.8.0` | 2.8.0 | utilities, money, redis, logger (+`logger/config`, `logger/axios`), concurrency, messaging |
| `stora-api` | backend | `^2.7.0` | 2.8.0 | utilities, money, logger (+`config`, `axios`, `express`), concurrency (+`concurrency/thread`), express, database, messaging, validation, random, transliterate, hash, file-storage (+`file-storage/types`), `money/money-calculator` |
| `stora-auth` | backend | `^2.7.0` | — (not installed) | utilities (also as `utilities.js`), express, random, database, logger (+`express`, `axios`) |
| `stora-admin-api` | backend | `^2.7.0` | 2.7.0 | utilities, money, logger (+`axios`, `express`), express, validation, messaging, file-storage, database, transliterate, random, concurrency |
| `stora-jd` | backend | `^2.7.0` | 2.7.0 | utilities, redis, logger, database, concurrency, money |
| `stora-taobao` | backend | `^2.7.0` | 2.8.0 | utilities, money, express, logger (+`axios`, `express`), concurrency, database |
| `stora-logistics-web` | frontend (Next.js) | `^2.7.0` | 2.7.0 | utilities, money |
| `stora-panels-hub` (all apps and packages) | frontend (Next.js monorepo) | `^2.7.0` (peer in `packages/hooks`) | 2.7.0 | utilities, money, one root import |
| `stora-hooks` | frontend library (React/Vite) | `^2` (peer) | 2.7.0 | utilities |
| `store-for-good` (`apps/backend`, `packages/ui`) | backend + frontend | `^2.5.0` / `^2.5.1` | 2.8.0 | utilities, random, database, redis, logger (+`express`), file-storage |
| `payment-api` | backend | `^2.0.0` | 2.7.0 | utilities, express, logger (+`axios`, `express`), validation, xml (+`xml/types`), money, database, concurrency |
| `stora-logistics-api` | backend | `^2.0.0` | 2.7.0 | utilities, concurrency, logger (+`axios`, `express`), money, express, validation, transliterate, messaging, database |
| `stora-web` | frontend (Next.js) | `^2.1.0` | 2.2.0 | utilities, money |
| `notification-core` | backend | `^1.3.30` | 1.3.38 | utilities, messaging, express, validation, logger (`axios`, `express`), money, database |
| `stora-locker-api` | backend (Koa) | `^1.3.34` | 1.3.38 | utilities, validation, logger (+`koa`, `axios`), money, messaging, database |
| `stora-scripts` | scripts | `^1.3.34` | 1.3.34 | logger, database, concurrency, utilities, money |

Things to keep in mind:

- **No consumer imports `analytics`**, and none uses the 2.8.0-only `expressResponseHelper`.
- **`utilities` and `money` run in browsers.** They are bundled into five frontends, so they must stay free of Node and third-party imports.
- **Consumers import deep paths**: `logger/config`, `logger/axios`, `logger/express`, `logger/koa`, `xml/types`, `money/money-calculator`, `concurrency/thread`, `file-storage/types`, `utilities.js`. Moving any file under `src/` breaks somebody.
- **Queue consumers are split between two APIs.** `startConsume` is used by stora-api (12 call sites), stora-admin-api and stora-scrapers. The deprecated `consume` is still used by ecommerce-core, stora-logistics-api, notification-core and stora-locker-api.

---

## 2. Tech stack

- **TypeScript** (`typescript ^5.0.0`; resolves to 5.9.x today). `tsconfig.json` sets `target: es5`, `module: commonjs`, `lib: [dom, es6]`, `strict`, `declaration`, `removeComments`, `esModuleInterop`, `skipLibCheck`, `rootDir: src` and `outDir: dist`.
- **Output**: CommonJS `.js` and `.d.ts` files under `dist/`, mirroring `src/`. There is no bundler, no `exports` map and no `main` field.
- **Node**: not pinned (no `engines`, no `.nvmrc`). CI uses the runner's default Node. The build was verified locally on 2026-10-16 with Node 22.20 and TypeScript 5.9.3.
- **Package manager**: npm in CI (`npm install`). `package-lock.json` is gitignored, so builds are not reproducible. The maintainer's local checkout uses pnpm (untracked `pnpm-lock.yaml`).
- **Lint**: `ts-standard ^12` (configured for VS Code in `.vscode/settings.json` with auto-fix on save). There is no npm script for it.

### Runtime libraries (peer-style)

Every third-party package is a **devDependency**. The published package declares no `dependencies` or `peerDependencies`, so each consumer must install what the modules it imports need. Missing packages surface as `Cannot find module` at runtime.

| Package (range in `package.json`) | Needed by |
|---|---|
| `log4js ^6.3.0` | logger, and almost every module (each file calls `getLogger`) |
| `mongodb ^4.9.1` | database, analytics |
| `@aws-sdk/client-sqs ^3.600.0`, `@aws-sdk/client-sns ^3.600.0` | messaging |
| `@aws-sdk/client-s3 ^3.651.1` | file-storage |
| `redis ^4.1.0` (node-redis v4 API) | redis |
| `validate.js ^0.13.1`, `dayjs ^1.10.5` | validation; `dayjs` also by `xml/types` |
| `sax ^1.2.1` | xml |
| `express ^4.17.2`, `koa ^2.13.1`, `axios ^0.21.1` | types only (`express`, `logger/express`, `logger/koa`, `logger/axios`); nothing is required at runtime |
| Node built-ins `async_hooks`, `events`, `crypto` | logger/database (AsyncLocalStorage), concurrency/event, hash |

The library is typed against the mongodb 4 driver and Express 4 types. Consumers run mongodb 3.x (stora-locker-api, stora-logistics-api), 4.x (ecommerce-core, stora-api, payment-api, notification-core) and 6.x (stora-auth, stora-admin-api, stora-jd, stora-taobao), and stora-amazon runs Express 5. Whether the `database` wrapper behaves identically on 3.x and 6.x drivers is not tested anywhere; confirm with the team.

---

## 3. Getting started

### Prerequisites

1. Node (22 works) and npm.
2. GitHub access to the `storatech` org.
3. To install `@storatech/*` packages in **consumer** repos, you need a GitHub personal access token with `read:packages` in your user `~/.npmrc`. That file needs a scoped registry line `@storatech:registry=https://npm.pkg.github.com/` and an `_authToken` line for `//npm.pkg.github.com/`. Never commit the token. Building this repo needs no token, because it depends on nothing from `@storatech`.

The repo `.npmrc` (and the consumers' `.npmrc`) contains two `registry=` lines. The second one (`https://registry.npmjs.org`) wins, so the scoped line in `~/.npmrc` is what makes `@storatech/*` resolve.

### Build

```bash
git clone git@github.com:storatech/stora-utils.git
cd stora-utils
npm install
npm run build     # rm -rf dist && tsc -p . && cp package.json dist
```

The package is published from inside `dist/`, so `@storatech/stora-utils/messaging` resolves to `dist/messaging/index.js` and `dist/messaging/index.d.ts`.

### Trying a change in a consumer

The safest way is a tarball that is never committed:

```bash
npm run build && (cd dist && npm pack)    # dist/storatech-stora-utils-<version>.tgz
cd ../stora-api
pnpm add ../stora-utils/dist/storatech-stora-utils-<version>.tgz
pnpm build && pnpm start                  # exercise the code path
git checkout package.json pnpm-lock.yaml && pnpm install   # restore
```

Do not edit files under a consumer's `node_modules/.pnpm/...` directly. pnpm hard-links them from a shared store, so edits leak into other projects.

### Scripts

| Script | What it does |
|---|---|
| `npm run build` | Cleans `dist`, compiles with `tsc`, copies `package.json` into `dist` |
| `npm run package` | `cd dist && npm publish`. **Publishes.** CI runs it; don't run it by hand |
| `npm test` | `ts-node src/test.ts`. The file is entirely commented out, so it does nothing |
| `npx ts-standard` | Lint (no script). Reports 5 findings on `main` today |

---

## 4. Module reference

Each module lives in `src/<name>/` and is imported as `@storatech/stora-utils/<name>`. Environment variables are listed by name only.

### 4.1 utilities (`/utilities`, browser-safe)

- `combineUrls(baseUrl, ...parts)`: joins URL parts with exactly one `/`.
- `keyBy(values, key)` and `uniqBy(values, key)`: build a map or a de-duplicated array from an object field. The last duplicate wins. `uniqBy` returns values in object-key order, so numeric keys come back sorted.
- `isNil(v)`, `isNonEmptyString(v)` (trims), `isNonEmptyValue(v)` (empty string, array or object counts as empty), `escapeXml(s)`.

### 4.2 money (`/money`, browser-safe)

- Types: `Currency` (`'USD'`, `'MNT'`, `'USc'`, `'CNY'`), `NumberMoney`, `StringMoney`, `Money`, `MoneyRange`, `CurrencyRate { rate, buyRate, sellRate }`.
- `CURRENCIES`: name, symbol and precision per currency (USD 2, MNT 0, CNY 2, USc 0), plus `format`/`parse`.
- `MoneyCalculator(currencyRates, base = 'MNT')` returns:
  - `new(amount, currency = base)`: rounds to the currency precision.
  - `convert(money, currency = base)`: uses `currencyRates['<FROM>_<TO>'].sellRate` and rounds. Throws `currency rate not found <FROM>_<TO>` if the rate is missing. `buyRate` and `rate` are never used.
  - `add`, `sum`, `sub`: same currency adds or subtracts directly. Mixed currencies are first converted to `base`, and the result is in `base`. **No rounding.** `add` and `sum` accept null or undefined; `sub` does not.
  - `multi(money, factor)`: rounds to precision.
  - `parse(text, currency?)`: accepts the symbol or code (`₮`, `MNT`, `$`, `¥`, `¢`…). If no currency is given, it tries each one. `USc` input returns USD.
  - `format(money, currency?)`: e.g. `$1,234.50`, `1,235₮`, `100.99¥`. USc is shown as dollars.
  - `amount`, `toStringMoney`, `toNumberMoney`.
- All arithmetic uses JavaScript floats.

### 4.3 express (`/express`)

- Request/response types: `ApiRequest<Params, Query>`, `ApiGet<Query>`, `ApiPost<Body>`, `ApiPut<Body>`, `ApiDelete<Query>`, `ApiResponse<Data, Context>`, `ApiHandler<Context>`, `ApiNextFunction`, `ApiQuery { limit?, offset? }`.
- Error body types: `ApiBody<T>` (`T` or `ApiError`) and `ApiError { errorCode, error, cause? }`.
- `ApiErrorCode`: `TOKEN_EXPIRED` 993, `VERIFY_REQUIRED` 994, `CONFLICT` 995, `BAD_REQUEST` 996, `UNAUTHORIZED` 997, `FORBIDDEN` 998, `INTERNAL_ERROR` 999.
- `HttpStatus`: `OK` 200, `FOUND` 302, `BAD_REQUEST` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `INTERNAL_ERROR` 500.
- `new ApiException(status: HttpStatus, code: ApiErrorCode, message: string, data?: any)`: an `Error` subclass that services throw.
- `expressErrorHandler(e, req, res, next)`: register it as the last middleware.

| Error | HTTP status | JSON body |
|---|---|---|
| `ApiException` | `e.status` | `{ errorCode: e.code, error: e.message, cause: e.data }` |
| `SyntaxError` (e.g. malformed JSON body) | 400 | `{ errorCode: 996, error: e.message }` |
| anything else | 500 | `{ errorCode: 999, error: 'unknown error' }`, and the error is logged on category `http` |

If the `Accept` header resolves to HTML (`req.accepts(['html', 'json'])`), the body is the plain `error.message` instead of JSON. That includes unknown errors (see §7).

- `expressNotFoundHandler`: responds 404 with `{ errorCode: 996, error: 'not found' }`.
- Published 2.8.0 also contains `expressResponseHelper` and pagination types that are **not in this source** (§5.3).

### 4.4 logger (`/logger` and subpaths)

- `import '@storatech/stora-utils/logger'` has a side effect: it runs `configureLogger(LOG4JS_FILE)`. It also re-exports `getReqId`. `/event` imports it too.
- Environment variables:
  - `LOG4JS_LEVEL` (default **`trace`**)
  - `LOG4JS_PATTERN` (default prints time, level, category, `file:line` and request id)
  - `LOG4JS_FILE` (optional base path for log files)
- Appenders:
  - A console appender is always on.
  - With `LOG4JS_FILE` set, two `dateFile` appenders write `<LOG4JS_FILE>.log` (INFO and above) and `<LOG4JS_FILE>.deb.log` (all levels). Both rotate daily, gzip old files and keep 30 backups.
  - `enableCallStack: true` makes the `file:line` token work.
- PM2: since 2.6.0 the config sets `pm2: true` and `disableClustering: true`, so each PM2 instance logs by itself. In cluster mode, several processes write to and rotate the same files. Confirm with the team that this is acceptable in production.
- `/logger/config`:
  - `configureLogger(file?)`: some consumers call it explicitly.
  - `reqIdStorage` (AsyncLocalStorage).
  - `getReqId(callback, prefix?)`: runs `callback` with a request id `<prefix>/<random>`, which appears in every log line as `%x{reqId}`.
- `/logger/express` `loggerMiddleware`: logs `METHOD url` on entry and `status ms` on `res.end` (category `http`). It sets an `X-Request-Id` response header to a random number.
- `/logger/koa` `koaLogger`: the same for Koa.
- `/logger/axios` `configureLogger(axiosInstance)`: adds interceptors that log `>> METHOD baseURL url` and `<< status`. Same function name as in `/logger/config`, different meaning.

### 4.5 database (`/database`)

- `Mongo(url, dbName, options?)` returns:
  - `connect()`, `isConnected()` (runs `ping`), `disconnect(force?)`
  - `database(name?, options?)`, `session(options?)`
  - `withTransaction(callback, options?)`
- Each call creates a new `MongoClient`. There is **no connection caching** in the wrapper, so consumers create one per process and keep it in a module. The `options` argument is ignored: the client is always created with `{ monitorCommands: true }` (§7).
- Command monitoring logs every command start, success and failure with full command and reply JSON at TRACE level on category `db`.
- `withTransaction`:
  - The outermost call starts a session and transaction and stores the session in AsyncLocalStorage.
  - Nested calls reuse the parent session and join the outer transaction.
  - On success it commits. On throw it aborts and rethrows, then ends the session.
  - Transient transaction errors are not retried. The callback must pass `{ session }` to every operation.
- `MongoCollection<T>(name)` returns `(db) => Collection<T>`, a typed collection-handle factory.

### 4.6 messaging (`/messaging`)

Exports: `MessageQueue`, `MessageQueueType`, `MessageTopic`, `MessageTopicType`, `MessageFilter`.

The `SQSClient` and `SNSClient` instances are created when the module is imported, with an empty config. Region and credentials come from the AWS SDK v3 default chain (`AWS_REGION`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, `AWS_PROFILE`, or the instance or Lambda role). The library reads no environment variables itself.

`MessageQueue<T>(queueNameOrUrl, concurrentCount = 1)`:

- Construction:
  - A value starting with `http` is used as the queue URL. Otherwise the name is resolved right away with `GetQueueUrl` + `GetQueueAttributes`.
  - It creates a `ThreadPool(concurrentCount)`, which keeps the process alive.
- `produce(message, delaySec = 0)`: `SendMessage` with `JSON.stringify(message)`.
- `startConsume(callback, waitSec = 10, retrySec = 10, maxDiffMs = 0)`: the current consumer.

| Aspect | Behaviour |
|---|---|
| Loops | Starts `concurrentCount` endless loops and returns immediately. Each loop long-polls `ReceiveMessage` with `MaxNumberOfMessages: 1` and `VisibilityTimeout: retrySec`. Loop 0 waits `waitSec`; the others wait 20 s (AWS maximum) to cut idle requests |
| SNS envelope | If the body has `TopicArn`, the callback gets `JSON.parse(body.Message)` plus attributes (`String` as string, `Number` via `parseInt`, `String.Array` via `JSON.parse`). Otherwise it gets the parsed body and no attributes |
| Success | The message is deleted after `callback` resolves |
| Failure | The error is logged on `messaging-queue` and the message is not deleted, so SQS redelivers it after `retrySec`. Dead-letter and max-receive settings live in SQS, not here |
| `maxDiffMs` | If greater than 0 and the SNS `Timestamp` is older, the message is skipped **without being deleted** (§7) |
| Receive errors | Logged, then the loop retries immediately with no backoff (§7) |
| PM2 | The library knows nothing about PM2 instances. Every process that calls `startConsume` consumes. Consumers gate this themselves; e.g. stora-api starts subscribers only when `IS_LISTENER_ENABLED=true` and `NODE_APP_INSTANCE` is `0` |

- `consume(...)` (deprecated since 2.1.0):
  - Makes one `ReceiveMessage` call for up to 10 messages, hands them to the pool and returns without waiting.
  - Callers call it in a loop, so messages can be processed twice.
  - Too-old messages are deleted.
  - `removeComments` strips the `@deprecated` tag from the published `.d.ts`, so consumers never see the warning.

`MessageTopic<T>(topicArn)`:

- `publish({ body, stringAttributes?, numberAttributes?, arrayAttributes? })`: SNS `Publish` with `MessageStructure: 'json'` (`default` and `sqs` both carry the JSON body) and typed message attributes.
- `subscribe(queueName, filter)`:
  - Creates the queue if it is missing.
  - Adds a queue-policy statement `topic-subscription-<topicArn>` that lets SNS send to it.
  - Subscribes with a `FilterPolicy` built from `stringFilters` and `numberFilters`.
  - Raw message delivery is not enabled, so the queue receives SNS envelopes, which `startConsume` unwraps.
- No consumer calls `MessageTopic(...)` today.

### 4.7 redis (`/redis`)

- `REDIS_URL` (default `redis://localhost:6379`).
- `redis` is a node-redis v4 client created at import and **not connected**. Consumers must call `await redis.connect()`; ecommerce-core and stora-jd do so in their bootloaders.
- `PubSubChannel<T>(channel)` returns:
  - `subscribe(listener)`: opens a new duplicated connection per call, JSON-parses messages and logs listener errors.
  - `count()`: `PUBSUB NUMSUB`, i.e. the number of subscribers, not messages.
  - `publish(message)`: publishes JSON.

### 4.8 concurrency (`/concurrency`, also `/concurrency/thread`)

- `ThreadPool(size)` returns `{ submit(task), finish() }`.
- `size` async runners pull tasks from an unbounded FIFO queue.
- Each runner runs inside `getReqId(..., 'runner#<n>')`, so its log lines carry the runner id.
- Task errors are logged and swallowed. Idle runners wake every 60 s, which keeps the process alive.
- `submit` does not wait for the task to finish.
- `finish()` resolves the next time a task ends and the queue is empty (§7).

### 4.9 event (`/event`)

- `Topic<T>()` returns an in-process pub/sub, one `EventEmitter` per topic:
  - `publish(id, data)`
  - `subscribe(id, waitMs)`: resolves with the first message or `undefined` on timeout.
  - `subscribeAll(id, waitMs, limit = Infinity)`: collects messages until the limit or the timeout.
- Importing it configures the logger.

### 4.10 file-storage (`/file-storage`, types in `/file-storage/types`)

- `S3FileStorage({ bucket, cdnPath })` returns:
  - `listFiles(path, filter)`
  - `getFile(path)`: returns a `Buffer` for key `<cdnPath>/<path>`.
  - `uploadFile(path, name, data, contentType)`: key `<cdnPath>/<path>/<name>`; returns that key.
  - `deleteFile(path)`
- `cdnPath` is a key prefix, but only `getFile` and `uploadFile` apply it (§7).
- Credentials come from the AWS default chain.

### 4.11 analytics (`/analytics`)

- `sendAnalyticsEvent(event, data)` reads `ANALYTICS_URI` and `ANALYTICS_DB`. If either is missing, it logs a warning and returns.
- The first call connects through `Mongo()` and caches the `Db` in a module variable. This is the only connection caching in the library.
- It inserts `{ ...data, event, createdAt }` into the `analytics` collection without awaiting; insert errors are only logged.

### 4.12 validation (`/validation`)

- Importing it registers three validators on the global validate.js instance:
  - `element`: validates each array element.
  - `object`: validates nested constraints.
  - `date`: checks the value is parseable by dayjs.
- It exports the `Constraint<T>` type. Consumers import `validate` from `validate.js` themselves (ecommerce-core imports this module for its side effect in `src/index.ts`).

### 4.13 xml (`/xml`, `/xml/types`)

- `XML<T>(def)` returns `{ parse(xml), format(data) }`, built on the strict `sax` parser.
  - Only elements declared in `def` are captured, and attributes are ignored.
  - Repeating elements are declared as `[{ ... }]`.
  - `format` pretty-prints with 2-space indents, escapes text and adds no XML declaration.
- `/xml/types`: `XmlString()`, `XmlNumber()` (uses `parseInt`), `XmlDate(format)` (dayjs), `XmlBoolean(trueValue, falseValue)` and `XmlDef<T>`.
- payment-api uses it for the Golomt bank gateway (`src/services/golomtcgw.ts`).

### 4.14 random, hash, transliterate

- `/random` `generateRandom(length, onlyDigit?)`: A–Z and 0–9, or digits only, using `Math.random`. It is used for order and tracking numbers, spin-the-wheel codes (stora-api, stora-admin-api) and other generated codes.
- `/hash` `hashUtils.hash(str)`: MD5 hex digest.
- `/transliterate`: the default export `Transliterate(word)` converts Mongolian Cyrillic to Latin.

### 4.15 Other files

- `src/index.ts`: the root module; it only prints a warning.
- `src/test.ts`, `src/tests/*.ts`, `src/xml/test.ts`, `src/concurrency/test.ts`: manual scripts. They are compiled and **published** with the package.
- `test.xml` (repo root): a sample bank payment file read by the XML test (§7).

---

## 5. Versioning and releases

### 5.1 How publishing works

- `.github/workflows/main.yml` ("Publish Package") runs on **every push to `main`** and on manual `workflow_dispatch`, which can target any branch. Its steps:
  1. `actions/checkout@v2`
  2. `actions/setup-node@v2` with `registry-url: https://npm.pkg.github.com/storatech` and no Node version
  3. `npm install`
  4. `npm run build`
  5. `npm run package` with `NODE_AUTH_TOKEN` set to the workflow's `GITHUB_TOKEN`
- It publishes whatever `version` is in `package.json`, from `dist/`, to `publishConfig.registry`.
- A push that doesn't bump the version fails at the publish step, because the version already exists. Nothing is published, but the run is red.
- No git tags or GitHub releases are created. The repo has no tags at all.
- The GitHub API currently shows no workflow runs for the repo, so past publishes can't be audited from CI. Confirm with the team whether run history was deleted, or whether some versions were published by hand.

### 5.2 Release history

Reconstructed from the `version` field in git history.

| Version | Date | Author | Change |
|---|---|---|---|
| 1.1.x | 2021-03 – 2021-06 | LMO, mootsooStora, lmo0731 | Validation, Mongo sessions and `withTransaction`, queue by name or URL, money parse/format |
| 1.2.0 – 1.2.4 | 2021-06 | lmo0731, Enkhbold Tsagaach | dayjs, Koa logger, `keyBy`/`uniqBy` and other utilities |
| 1.3.0 – 1.3.9 | 2021-06 – 2021-10 | Enkhbold Tsagaach, lmo0731, LMO | Refactoring, peer deps moved to devDependencies, money updates, `MessageFilter` export, date validation, XML parser/formatter |
| 1.3.10 – 1.3.11 | 2021-11 | usukhbayar96 | Transliterate (PRs #1–#3) |
| 1.3.12 – 1.3.14 | 2021-12 – 2022-01 | LMO | Money negative parse fix, SQS reconnect fix, Express update |
| 1.3.15 – 1.3.21 | 2022-02 – 2022-04 | LMO | Event topic, SQS retry seconds, XML boolean, `ThreadPool`, concurrent queue consumer |
| 1.3.22 – 1.3.32 | 2022-04 – 2022-09 | LMO | mongodb driver 3.x → 4.x (1.3.26) and command logging, Redis pub/sub, `subscribeAll`, log compression, `ThreadPool.finish`, money precision fix |
| 1.3.33 – 1.3.34 | 2022-10 | LMO | Thread pool and Mongo collection updates; root import disabled (prints a warning) |
| 1.3.35 | 2023-10-17 | LMO | CNY currency |
| 1.3.36 – 1.3.38 | 2024-01-11 | LMO | log4js and logger update, Redis/SNS/SQS update (last 1.x) |
| 2.0.0 | 2024-06-20 | Zoljargal Gantumur (PR #4) | **AWS SDK v2 to v3** for SQS/SNS |
| 2.0.1 | 2024-07-18 | LMO (direct push) | `consume` receives up to 10 messages instead of `concurrentCount` |
| 2.1.0 | 2024-08-16 | Zoljargal Gantumur (PR #5) | `startConsume`, `consume` deprecated, queue types moved to `messaging/types.ts`, debug log moved to `<LOG4JS_FILE>.deb.log` |
| 2.2.0 | 2024-09-16 | Zoljargal Gantumur (PR #6) | S3 file storage |
| 2.3.0 | 2024-09-20 | Zoljargal Gantumur (PR #7) | `cdnPath`; `uploadFile` returns the key |
| 2.4.0 | 2024-10-14 | Zoljargal Gantumur (PRs #8, #9) | `hash` module |
| 2.5.0 | 2024-10-14 | Zoljargal Gantumur (PR #10) | `random` module |
| 2.5.1 | 2024-10-23 | Zoljargal Gantumur (PR #11) | `uploadFile` gains a **required** `contentType` parameter (a breaking type change released as a patch) |
| 2.6.0 | 2024-11-12 | Zoljargal Gantumur (PR #12) | log4js `pm2: true`, `disableClustering: true` |
| 2.7.0 | 2024-11-12 | Zoljargal Gantumur (PR #13) | `analytics` module (last commit on `main`) |
| 2.8.0 | on or before 2025-07-07 | unknown (not in git) | `expressResponseHelper` and pagination types (§5.3) |

### 5.3 The 2.8.0 drift

#### What we know

- 2.8.0 exists in the registry. The `stora-api` lockfile resolves it from `npm.pkg.github.com`, and it is installed in ecommerce-core, stora-api, stora-scrapers, stora-amazon, stora-taobao and store-for-good. The copies in the first four were hashed and are byte-identical.
- No branch, commit or fork contains it:

| Location | Head |
|---|---|
| `storatech/stora-utils` `main` | 2.7.0 |
| `storatech/stora-utils` `revert-1-main` | 1.3.9, 2021 |
| fork `zoloogg` | 2.7.0 |
| fork `lmo0731` | 1.3.38 |
| fork `Usukhbayar96` | 1.3.34 |
| fork `bolorshagai94` | 1.3.34 |
| fork `ebologger` | 1.3.7 |

- The first consumer to require `^2.8.0` was stora-scrapers (commit `94c406c7`, 2025-07-07, Zoljargal Gantumur, "analytics api added"). ecommerce-core followed on 2025-08-12 and stora-amazon on 2025-08-27. So 2.8.0 was published on or before 2025-07-07.
- Who published it, and from where, is unknown. The likely candidates are a manual `npm run package` from a local checkout, or `workflow_dispatch` on a branch that was never pushed. Zoljargal Gantumur is the most likely author, because the new code matches his `store-for-good` helper. Confirm with the team.

**How it was compared**: `main` (2.7.0) was built with TypeScript 5.9.3 and diffed against the published 2.8.0 in `stora-api/node_modules/@storatech/stora-utils/`. The TypeScript helper boilerplate (`__awaiter`/`__generator`) was ignored, because it differs between compiler versions.

| Module / file | `.d.ts` | JS behaviour | Notes |
|---|---|---|---|
| analytics, concurrency, database, event, file-storage, hash, logger (all subpaths), messaging, money, random, redis, transliterate, utilities, validation, xml, root `index` | identical | identical | No change |
| `express/index` | **differs** | **differs** | Adds `Pagination`, `PaginationResult`, `PaginatedResult<T>` and `expressResponseHelper` |
| `tests/queue_test` | identical | differs | Calls `startConsume` instead of `consume` |
| `tests/concurency/compare` (sic) | new | new | CPU benchmark script (prime numbers, `ThreadPool(128)`); not API |
| `package.json` | — | — | Only `version` differs |

The published declarations that are missing from `src/express/index.ts`:

```ts
export interface Pagination { limit: number; offset: number }
export interface PaginationResult extends Pagination { total: number }
export interface PaginatedResult<T> { data: T[]; pagination: PaginationResult }
export declare const expressResponseHelper: (_req: Request, res: Response, next: NextFunction) => Promise<void>
```

From the compiled JS, `expressResponseHelper` is a middleware that adds three methods to `res`, then calls `next()`. All three set `Content-Type: application/json` and call `res.send`:

- `res.success(data)` sends `{ status: 'success', data }`.
- `res.paginatedSuccess(data, pagination)` sends `{ status: 'success', data, pagination }`.
- `res.error(error)` sends `{ status: 'failed', message: error.error, code: error.errorCode }`. It does not set an HTTP status, so the response is 200 unless the caller set one.

The published `.d.ts` has no `Express.Response` augmentation for these methods, so callers need their own typing. Note that this response envelope differs from the `ApiError` body used by `expressErrorHandler`.

The code is nearly identical to `store-for-good/apps/backend/src/utils/responseHelper.ts` (2024-10-23) plus `res.error`. The interfaces match `store-for-good/apps/backend/src/models/pagination.ts`, and the typing lives in `store-for-good/apps/backend/@types/express/index.d.ts`.

**Impact**: no consumer imports `expressResponseHelper` or the pagination types (grep across all repos), so for every current consumer 2.8.0 behaves exactly like 2.7.0. The risk is the **next** release from `main`. Unless the 2.8.0 code is restored first, it silently drops these exports, and 2.8.0 cannot be republished.

#### Recovery steps

1. Ask the team (start with Zoljargal Gantumur) whether a local branch or checkout with the 2.8.0 source exists. If so, open a PR from it.
2. Otherwise, reconstruct the code:
   - Add the three interfaces and `expressResponseHelper` to `src/express/index.ts`, using the installed `express/index.d.ts` and `express/index.js` as the reference.
   - Optionally switch `src/tests/queue_test.ts` to `startConsume`.
   - Decide whether to add an `Express.Response` augmentation. That would change the `.d.ts`, so it belongs in a minor release.
3. Build, then run `diff -r -x '*.js' <installed 2.8.0 folder> dist`. Expect no `.d.ts` differences apart from intended ones.
4. Set `version` to **2.8.1**, or 2.9.0 if anything else ships with it. Every future version must be greater than 2.8.0.

### 5.4 1.x vs 2.x

Breaking changes between 1.3.38 (`f0b36cf`) and 2.7.0. According to `git diff f0b36cf HEAD`, the APIs of utilities, money, express, database, validation, xml, redis, event, concurrency and transliterate are unchanged apart from formatting and the newly exported `Mongo` type.

1. **AWS SDK v2 to v3 (2.0.0).** Messaging now needs `@aws-sdk/client-sqs` and `@aws-sdk/client-sns` instead of `aws-sdk`. Global `AWS.config` no longer affects the library, the custom keep-alive HTTPS agent is gone, and region and credentials come from the v3 default chain.
2. **Queue consumption.** `consume()` fetches up to 10 messages per call instead of `concurrentCount` (2.0.1). `startConsume()` was added and `consume()` deprecated (2.1.0). The `MessageQueue` interface moved from `messaging/queue` to `messaging/types`; this only matters for deep imports, and none were found.
3. **Logging.** The all-levels file moved from `<LOG4JS_FILE>.log` (1.x wrote both appenders to the same file) to `<LOG4JS_FILE>.deb.log` (2.1.0). The `pm2`/`disableClustering` settings arrived in 2.6.0.
4. **file-storage.** `uploadFile` requires `contentType` since 2.5.1 (file-storage did not exist in 1.x).

What this means for the 1.x consumers:

| Repo | Installed | Uses | Upgrade work |
|---|---|---|---|
| `notification-core` | 1.3.38 | messaging (`consume` ×4), express, validation, database, money, logger | Add the two `@aws-sdk` v3 clients (it currently has `aws-sdk` v2), check region and credential config, consider moving to `startConsume`, update any log shipping that reads `<LOG4JS_FILE>.log` |
| `stora-locker-api` | 1.3.38 | messaging (`consume` ×2), `logger/koa`, database, validation, money | Same as above. Separately, it pins `mongodb ^3.6.9`, although the wrapper has targeted the 4.x driver API since 1.3.26 (already true today); confirm with the team |
| `stora-scripts` | 1.3.34 | logger, database, concurrency, utilities, money | Mostly drop-in. Gains CNY support and the logger changes |

1.x consumers get no fixes from `main`. There is no 1.x branch or tag (1.3.38 is commit `f0b36cf` / fork `lmo0731`), and CI only publishes `main`. A 1.x fix would need a branch from `f0b36cf` and a manual publish. Upgrading these three repos to 2.x is the better path.

---

## 6. Development workflow

- **Branches**:
  - `main` is the only active branch, and every push to it publishes.
  - `revert-1-main` is a stale 2021 branch from a reverted transliterate PR.
  - There is no `dev` branch and there are no tags.
- **How changes arrived so far**:
  - 2021–2024: LMO mostly pushed directly to `main`.
  - Since 2024, changes come from forks: contributors commit to their fork's `main` (e.g. `zoloogg/stora-utils`) and open a PR `zoloogg:main → storatech:main`.
  - All 13 PRs came from forks. PRs #6–#13 were merged by their own author on the same day, without review.
- **Recommended flow**:
  1. Create a feature branch in your fork.
  2. Build, check the `.d.ts` diff and test in one consumer (see AGENTS.md).
  3. Bump `version` in the same PR.
  4. Get at least one review, then merge.
  5. Watch the "Publish Package" run.
  6. Upgrade the consumers that need the change.
- **CI**: only the publish workflow (§5.1). There is no lint, test or PR check; `tsc` inside `npm run build` is the only gate, and it runs after merge.
- **Style**: ts-standard (VS Code auto-fix on save via `.vscode/settings.json`).
- **Unmerged local work**: the maintainer's checkout at `/Users/lmo/Stora/stora-utils` (on `main`, `d50d0fc`) has uncommitted changes:
  - `src/money/money-calculator.ts`: `parse()` iterates `Object.keys(CURRENCIES).map(...)` instead of `Object.values(CURRENCIES)`. The behaviour is the same; the intent is unknown.
  - `src/messaging/queue.ts`: formatting only (blank line and trailing comma in `produce`).
  - `src/concurrency/index.ts`: trailing newline only.
  - `src/test.ts`: enables a small money smoke test.
  - An untracked `pnpm-lock.yaml`.
  - Only the money change has substance. Confirm with the team whether to keep it.

---

## 7. Known issues and technical debt

Prioritized roughly by risk.

| # | Issue | Where | Notes |
|---|---|---|---|
| 1 | Published 2.8.0 has no source in git; the next release from `main` would drop its exports | `src/express/index.ts`, `package.json` | §5.3. Restore the code, then release ≥ 2.8.1 |
| 2 | The repository is public | GitHub repository settings | Everything committed, including git history and test fixtures, is world-readable. Decide with the team whether it should be private, and keep credentials and real data out of commits and fixtures |
| 3 | `test.xml` is a full bank payment file used as a test fixture | `test.xml`, `src/tests/xml_test.ts`, `src/xml/test.ts` | Replace it with a minimal synthetic fixture |
| 4 | `Mongo()` ignores the caller's `options` (overwritten with `{ monitorCommands: true }`) | `src/database/mongo.ts:25` | TLS, pool size, timeouts etc. passed by consumers have no effect. Fixing it changes behaviour for every consumer, so release it as a minor and test |
| 5 | Default log level is `trace`, and Mongo command monitoring logs every command and full reply at TRACE | `src/logger/config.ts:6`, `src/database/mongo.ts:27-35` | Any service without `LOG4JS_LEVEL` logs all query results, including customer data, and pays the cost |
| 6 | `startConsume` skips too-old messages (`maxDiffMs`) without deleting them, while `consume` deletes them | `src/messaging/queue.ts:60-63` | They are redelivered every `retrySec` until SQS drops them or moves them to a DLQ |
| 7 | `startConsume` loops retry immediately after a receive error (no backoff) | `src/messaging/queue.ts:104-106`, `216-226` | Wrong credentials or a deleted queue cause a tight loop of requests and error logs |
| 8 | Queue URL resolution starts at construction; if it rejects before anything awaits it, Node reports an unhandled rejection | `src/messaging/queue.ts:115-120` | Since Node 15, that terminates the process by default. Most likely for produce-only queues created at module load |
| 9 | `MessageFilter` number filters use the key `numberic`; SNS expects `numeric` | `src/messaging/topic.ts:33` | The type steers callers to an invalid filter policy. No current consumer uses `MessageTopic` |
| 10 | The `@deprecated` note on `consume` is stripped by `removeComments` | `tsconfig.json`, `src/messaging/types.ts` | Four consumers still use `consume` without any warning |
| 11 | Requests whose `Accept` resolves to HTML (e.g. `Accept: */*`) get `error.message` as plain text, even for unknown 500 errors. Not-found uses `errorCode` 996 (`BAD_REQUEST`) | `src/express/index.ts:65-67`, `92-103`, `106-116` | Can leak internal error messages; there is no `NOT_FOUND` error code |
| 12 | `generateRandom` uses `Math.random` | `src/random/random-generator.ts` | Not suitable for security-sensitive codes. Add a `crypto.randomInt` variant (new function or minor release) |
| 13 | `XmlNumber` parses with `parseInt`, which truncates decimals | `src/xml/types.ts:71` | payment-api's Golomt definition uses it for `CtrlSum` and `InstdAmt` |
| 14 | `ThreadPool.finish()` never resolves if called while idle; its listener is never removed; idle runners keep the process alive | `src/concurrency/thread.ts:55-66`, `38` | Scripts must call `process.exit`. Constructing a `MessageQueue` also creates a pool |
| 15 | `S3FileStorage` key handling is inconsistent: `listFiles` and `deleteFile` ignore `cdnPath`, `listFiles` prefixes `path` to keys that already contain it, and `filter` is unused | `src/file-storage/s3.ts` | Keys returned by `uploadFile` can't be passed to `getFile` (it adds `cdnPath` again) |
| 16 | `loggerMiddleware` uses `arguments` inside an arrow function (`@ts-expect-error`) and doesn't return `oldEnd`'s result | `src/logger/express.ts:11-15` | Works only because of `target: es5`. On ES2015+ it would pass `(req, res, next)` to `res.end` |
| 17 | `sendAnalyticsEvent`: concurrent first calls each open a Mongo client; it warns on every call when env vars are missing; inserts are fire-and-forget | `src/analytics/mongo-dumper.ts` | No consumer uses it yet |
| 18 | Packaging: no `exports` map (every file is public API); test scripts are published; `types` points to `dist/index.d.ts`, which doesn't exist in the published package; no `peerDependencies`; no lockfile | `package.json`, `.gitignore` | Builds depend on whatever TypeScript and AWS SDK versions resolve that day |
| 19 | CI uses `actions/checkout@v2` / `setup-node@v2` with no Node version, and has no lint or test step | `.github/workflows/main.yml` | Upgrade the actions and pin Node. Add a PR check (`npm run build`, `ts-standard`) |
| 20 | No tests: `npm test` runs a fully commented file; `src/tests/queue_test.ts` imports a non-existent `../src/logger`; `file_storage_test.ts` checks `AWS_ACCESS`/`AWS_SECRET`, which the AWS SDK doesn't read; lint reports 5 findings | `src/test.ts`, `src/tests/` | Start with unit tests for money, utilities and the error handler |
| 21 | Money arithmetic: `add`/`sub`/`sum` don't round; mixed-currency results come back in `base`; only `sellRate` is used | `src/money/money-calculator.ts` | Floating-point drift; document before changing |
| 22 | Repo `.npmrc` has two `registry=` lines (the second wins); `repository.url` in `package.json` is malformed (`ssh://git@github.com:...`) | `.npmrc`, `package.json` | Cosmetic |

---

## 8. Recurring tasks

| Task | How |
|---|---|
| Release a new version | Make the change on a branch in your fork. Build, diff the `.d.ts` against the previous build, and test with a packed tarball in one consumer. Bump `version` (semver, greater than 2.8.0), add a row to §5.2, open a PR and get a review. Merging publishes. Check that the "Publish Package" run is green. Optionally tag the merge commit `v<version>` (no tags exist yet) |
| Add a module | Create `src/<name>/index.ts` that re-exports the public API; it becomes `@storatech/stora-utils/<name>` automatically. Keep third-party packages in devDependencies and list them in §2. Avoid import-time side effects. Add it to the AGENTS.md map and §4. Release as a minor |
| Add a currency | Extend `Currency` and `CURRENCIES` in `src/money/money-calculator.ts` (name, symbol, precision, format, parse). It's a minor release, and `utilities`/`money` must stay browser-safe |
| Upgrade consumers | In the consumer, run `pnpm add @storatech/stora-utils@^<version>` (or `pnpm update @storatech/stora-utils`; stora-scripts uses npm). Run its build and lint, then smoke-test the modules it uses (§1 table). Lockfiles pin the installed version, so a range like `^2.7.0` does not upgrade on its own |
| Upgrade a 1.x consumer to 2.x | Follow §5.4. Install the `@aws-sdk/client-sqs`/`client-sns` v3 clients, verify AWS config, prefer `startConsume`, and check log file names |
| Deprecate an API | Keep it working. Note it in this document; a `@deprecated` JSDoc tag won't reach consumers while `removeComments` is on. Remove it only in a major release after all consumers have moved |

---

## 9. People and history

- **Contributors** (git history; unique non-merge commits):
  - LMO, also committing as `lmo0731` (~107 commits, 2021–2024): main author and maintainer of the 1.x line.
  - Zoljargal Gantumur, GitHub `zoloogg` (13 commits plus the merges of PRs #6–#13, 2024): the 2.x line (AWS SDK v3, `startConsume`, S3, hash, random, PM2 logging, analytics).
  - Enkhbold Tsagaach (9 commits, 2021): refactoring, utilities, money.
  - usukhbayar96 (5 commits, 2021): transliterate.
  - Munkh-Ochir Lkhagva: created the repo and the publish workflow (2021-02), and merged PRs #1, #2, #4 and #5. The 2021 transliterate revert exists only on `revert-1-main`.
  - mootsooStora (2 commits, 2021).
- **History**:
  - `main` has 285 commits from 2021-02-17 to 2024-11-12 and 13 PRs, all from forks.
  - Merge `441eadb` (2024-08-16) joined two unrelated histories, so `main` has two root commits and most 2021–2024 commits appear twice. Only 138 of the 263 non-merge commits are unique. This is harmless, but it makes `git log` and blame noisy.
  - There have been no commits since 2024-11-12. The only later activity is the out-of-git 2.8.0 publish in 2025.
  - The 1.x line (2021–2024) was mostly LMO. The 2.x line (2024) was mostly Zoljargal Gantumur.

---

## 10. Handover checklist

- [ ] GitHub maintainer access to `storatech/stora-utils` (merge, Actions, Packages settings) and to the main consumer repos
- [ ] Personal token with `read:packages` in `~/.npmrc`; `write:packages` only if a manual publish is ever agreed
- [ ] Find out who published 2.8.0 and from where; recover or reconstruct the source (§5.3) before any new release
- [ ] Decide what happens to the uncommitted changes in the maintainer's local checkout (§6)
- [ ] Clone, `npm install`, `npm run build`, pack and install into one consumer (e.g. stora-api)
- [ ] Decide with the team whether the repo stays public (§7 #2)
- [ ] Agree on review rules (no self-merge), git tags and a changelog
- [ ] Review the publish workflow (action versions, Node version, a PR build check)
- [ ] Plan upgrades of the 1.x consumers (notification-core, stora-locker-api, stora-scripts)
- [ ] Contact the owners of the heaviest consumers (stora-api, ecommerce-core, payment-api, stora-admin-api)
