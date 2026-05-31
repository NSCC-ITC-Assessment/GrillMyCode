---
sidebar_position: 3
---

# Using Action Outputs

GrillMyCode exposes four outputs that can be consumed by subsequent steps in the same job.

| Output | Description |
|---|---|
| `output_file` | Path to the generated assessment Markdown file |
| `questions` | The generated questions as a string (internal AI markers stripped; does not include the instructor note) |
| `code_before_strip` | Full code content of all assessed files before comment stripping |
| `code_after_strip` | Full code content of all assessed files after comment stripping |

## Referencing an output

Give the action step an `id`, then reference its outputs using `steps.<id>.outputs.<name>`:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  id: assess
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Print questions to the log
  run: echo "${{ steps.assess.outputs.questions }}"
```

## Uploading the assessment as an artifact

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  id: assess
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Upload assessment
  uses: actions/upload-artifact@v7
  with:
    name: assessment
    path: ${{ steps.assess.outputs.output_file }}
```

## Conditional steps based on output

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  id: assess
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Comment character count
  run: |
    echo "Code before stripping: $(echo "${{ steps.assess.outputs.code_before_strip }}" | wc -c) chars"
    echo "Code after stripping:  $(echo "${{ steps.assess.outputs.code_after_strip }}" | wc -c) chars"
```
