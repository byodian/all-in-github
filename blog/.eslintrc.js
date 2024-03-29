module.exports = {
  extends: [
    '@byodian/eslint-config-ts',
    'plugin:astro/recommended',
  ],
  overrides: [
    {
      files: ['*.astro'],
      parser: 'astro-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['*.astro'],
      },
      rules: {
      },
    },
  ],
}
