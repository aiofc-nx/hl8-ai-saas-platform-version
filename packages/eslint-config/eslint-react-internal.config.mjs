import tsEslint from "typescript-eslint";
import baseConfig from "./eslint-base.config.mjs";

const tsConfig = tsEslint.configs.strict;

export default [
  ...baseConfig,
  ...tsConfig,
  {
    languageOptions: {
      globals: {
        React: true,
        JSX: true,
      },
    },
  },
];
