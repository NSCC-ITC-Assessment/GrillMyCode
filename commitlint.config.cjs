/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Types allowed for this action repo
    'type-enum': [
      2,
      'always',
      [
        'feat', // new feature / new input or output
        'fix', // bug fix
        'chore', // maintenance, dependency updates, config
        'docs', // documentation only
        'style', // formatting (no logic change)
        'refactor', // code change with no behaviour difference
        'test', // adding or updating tests
        'perf', // performance improvements
        'ci', // workflow / CI changes
        'build', // build system changes
        'revert', // reverts a previous commit
      ],
    ],
    'subject-case': [0],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 150],
    'body-max-line-length': [2, 'always', 200],
  },
};
