# stora-utils

stora common utils

`@storatech/stora-utils` is the shared TypeScript library used by Stora's Node services and some of its frontends. It provides logging (log4js), Express error handling and API types, a MongoDB wrapper, AWS SQS/SNS messaging, S3 file storage, Redis pub/sub, money calculation, validation, XML and small utilities. Each module is imported by subpath, for example `@storatech/stora-utils/express`.

## Install

The package is published to GitHub Packages. Point the `@storatech` scope at GitHub Packages in your user `~/.npmrc`:

```ini
@storatech:registry=https://npm.pkg.github.com/
```

The same file also needs an `_authToken` entry for `//npm.pkg.github.com/` that holds a GitHub personal access token with `read:packages`. Keep the token only in your user `~/.npmrc` and never commit it.

```bash
pnpm add @storatech/stora-utils    # or: npm install @storatech/stora-utils
```

Third-party runtime packages (log4js, mongodb, `@aws-sdk/*`, redis, validate.js, dayjs, sax) are not installed with this package. Install the ones the modules you import need.

```ts
import { isNil } from '@storatech/stora-utils/utilities'
import { ApiException, ApiErrorCode, HttpStatus } from '@storatech/stora-utils/express'
import { MoneyCalculator } from '@storatech/stora-utils/money'
```

## Development

```bash
npm install
npm run build    # compiles to dist/
```

Every push to `main` publishes the `version` in `package.json`, so bump it in the same PR.

## Documentation

- [docs/HANDOVER.md](docs/HANDOVER.md): handover documentation (consumers, module reference, releases, known issues)
- [AGENTS.md](AGENTS.md): instructions for AI coding agents and a quick reference for contributors
