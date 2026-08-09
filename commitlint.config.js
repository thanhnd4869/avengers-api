export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'single-line-english': ({ raw }) => [
          /^[\x20-\x7E]+$/.test(raw.trim()),
          'commit message must be a single line using English ASCII characters',
        ],
      },
    },
  ],
  rules: {
    'single-line-english': [2, 'always'],
  },
}
