# @repo/eslint-config

Shared ESLint configuration for the entire monorepo.

## Available Configurations

- `@repo/eslint-config/eslint-base` - Base configuration for all projects
- `@repo/eslint-config/eslint-nest` - Configuration for NestJS projects
- `@repo/eslint-config/eslint-next` - Configuration for Next.js projects
- `@repo/eslint-config/eslint-react-internal` - Configuration for internal React libraries

## Installation

```bash
# Install package
pnpm add -D @repo/eslint-config
```

## Usage

### NestJS Projects

```js
// .eslintrc.js
module.exports = {
  extends: ["@repo/eslint-config/eslint-nest"],
};
```

### Next.js Projects

```js
// .eslintrc.js
module.exports = {
  extends: ["@repo/eslint-config/eslint-next"],
};
```

### React Libraries

```js
// .eslintrc.js
module.exports = {
  extends: ["@repo/eslint-config/eslint-react-internal"],
};
```

## Prettier Configuration

This package also provides a default Prettier configuration:

```js
// .prettierrc.js
module.exports = require("@repo/eslint-config/prettier-base");
```

## Rules

### NestJS

- Use TypeScript strict mode
- Follow NestJS best practices
- Use decorators correctly
- Manage dependencies properly

### Next.js

- Use TypeScript
- Follow Next.js best practices
- Optimize SEO
- Manage assets properly

### React Libraries

- Use TypeScript
- Follow React best practices
- Optimize bundle size
- Manage dependencies properly

## Support

If you encounter any issues or have questions, please create an issue on GitHub.

## License

This project is licensed under the [MIT License](LICENSE).

```
{
  "name": "@repo/eslint-config",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "files": [
    "compat.mjs",
    "eslint-base.config.mjs",
    "eslint-nest.config.mjs",
    "eslint-next.config.mjs",
    "eslint-react-internal.config.mjs",
    "prettier-base.config.mjs"
  ],
  "devDependencies": {
    "@eslint/compat": "^1.2.9",
    "@eslint/eslintrc": "3.3.1",
    "@eslint/js": "9.39.1",
    "@next/eslint-plugin-next": "^15.3.1",
    "@types/eslint": "^9.6.1",
    "@vercel/style-guide": "^6.0.0",
    "eslint": "9.39.1",
    "eslint-config-next": "15.5.5",
    "eslint-config-prettier": "^10.1.2",
    "eslint-config-turbo": "^2.5.2",
    "eslint-plugin-prettier": "5.5.4",
    "prettier-plugin-organize-imports": "^4.1.0",
    "typescript": "^5.9.3",
    "typescript-eslint": "8.46.3"
  }
}
```
