# Raw AI Output — Opportunities for Fixes and Features

Every student push saves the AI's unedited reply to
`{studentLogin}/raw-ai-output.md` in the instructor repository. Right now we
only read it by hand when a quiz looks wrong. Here are ideas for getting more
out of it. Only the first is implemented so far.

- **Record more details in the file header.** _(Done.)_ Save the settings used
  (question count, temperature, prompt version) and the AI's response details
  (why it stopped, tokens used, retries). _Benefit:_ we can tell a reply that
  got cut off from one that just had fewer questions, and several ideas below
  depend on it.

- **Replay tool and test samples.** A script that re-runs a saved reply through
  the processing steps and compares the result to what was committed. Cleaned-up
  real replies become test cases. _Benefit:_ parser changes are tested against
  real AI output, so we catch breakage before release.

- **Rebuild only the quizzes that need it.** Use the replay tool to find which
  students' quizzes would change after a parser fix. _Benefit:_ no more choosing
  between deleting quizzes by hand and rebuilding everyone's.

- **Measure how often the AI breaks format.** Count each kind of formatting
  mistake, per model. _Benefit:_ tells us whether automatically re-asking the AI
  for badly formatted replies is worth building, and for which models.

- **Find common mistakes to add to the prompt.** Scan saved replies for mistakes
  that keep coming up. _Benefit:_ prompt rules are based on what models
  actually get wrong, not guesses.

- **Fill gaps with extra questions.** When a quiz question is dropped because
  it's broken, replace it with one of the extra questions the AI wrote that we
  currently throw away. We could also ask for a few spares on purpose, or use
  them as a pool so retakes get different questions. _Benefit:_ quizzes arrive
  with the number of questions the instructor asked for. This is the most
  visible win for instructors.

- **Health report for instructors.** Summarise each student's quiz: questions
  requested, generated, kept and exported, plus any automatic fixes applied.
  _Benefit:_ instructors see problems without digging through student Actions
  logs.

- **Model scorecard.** Rate each AI model on how well it follows the expected
  format. _Benefit:_ evidence for picking the default model, and the Workflow
  Wizard can show a reliability note beside each model.

- **Test prompt and model changes before release.** Re-run real past
  submissions with a new prompt or model and compare the results to the saved
  ones. _Benefit:_ problems show up before release, not weeks later in
  instructor repositories.

- **Quiz-quality checks.** Flag questions where the correct answer is obviously
  the longest option, where distractors repeat across students, or where they
  are near-copies of the answer. _Benefit:_ fairer quizzes that students can't
  game by picking the longest answer.

- **One-click bug reports.** When a question is dropped, open an issue in the
  instructor repository with the relevant part of the raw reply attached.
  _Benefit:_ bug reports come with the evidence we need to fix them.

**Privacy:** raw replies contain student code and GitHub logins. Anything that
leaves the private instructor repository (test samples, cross-repository
scorecards, external bug reports) must be scrubbed first.

**Suggested order:** header details and the replay tool first, since most other
ideas build on them. Then extra-question gap filling, then the health report.
