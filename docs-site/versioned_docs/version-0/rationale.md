---
sidebar_position: 2
---

# Why GrillMyCode?

## The problem

Programming assignments are easy to submit and hard to verify.

A student may hand in code they don't really understand: copied from a classmate, written by an AI assistant, or adapted from the web without working out what it does. Passing the automated tests says nothing about whether the student can explain their own code.

The usual answer is a **code viva**: a short conversation, or a written check, where you ask the student about their own submission. A good viva quickly separates real understanding from surface familiarity.

## Preparation is the bottleneck

Good viva questions take time to write. For each student you have to:

1. Read what they actually changed.
2. Pick out the parts most worth asking about.
3. Write questions that only the person who wrote the code could answer well.

For a class of 30 students, that's hours of work before a single question is asked. So instructors often reuse the same generic questions for everyone, which gives the answers away, or skip the viva altogether.

## What GrillMyCode does

GrillMyCode does those three steps for you. It picks out the code each student wrote, removes the comments, and has an AI model write questions about *that* student's *that* submission. The questions are ready moments after the student pushes, with no reading needed on your part.

The viva itself stays a human conversation. GrillMyCode only removes the preparation.

## Why it runs on GitHub

- **The code is already there.** Your students' Classroom 50 repositories are on GitHub, so nothing has to be collected or moved.
- **It runs by itself.** Questions are generated when students submit. There's nothing for you to remember to run.
- **There's nothing to host.** GrillMyCode runs on GitHub's servers. The only account you need besides GitHub is OpenRouter, for the AI model.

## Why it doesn't grade

Grading automatically is a much harder problem. It needs a rubric, a reference solution and confidence that the AI judges consistently and fairly, and a mistake has real consequences for a student.

GrillMyCode deliberately stops at questions and leaves the judgment to you. If a question misses the mark, you skip it. That's a small cost, where an unfair grade is not.

## Who it's for

- **Instructors** who want to run code vivas without spending an hour per student preparing.
- **Assessment designers** who want questions specific to each submission, alongside automated tests.
