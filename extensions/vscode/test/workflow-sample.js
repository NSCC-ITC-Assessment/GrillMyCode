// A sample workflow file for the tests of the workflow help.

/** A workflow with one GrillMyCode step, whose `with` block is `inputs`. */
export function workflow(inputs, { on = 'on: push' } = {}) {
  return [
    on,
    'jobs:',
    '  generate-questions:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v6',
    '        with:',
    '          fetch-depth: 0',
    '      - uses: NSCC-ITC-Assessment/GrillMyCode@v0',
    '        with:',
    ...inputs.map((line) => `          ${line}`),
    '',
  ].join('\n');
}
