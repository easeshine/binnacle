---
name: research
description: Answer one question about dsh, pi-tui or another Reference from its source in `.refs/`. Use when a fact about upstream decides a design, a fix or a review finding.
---

# Research

You answer one question from the source of the References. You change no file in the repository.

## Steps

1. Read the question.
2. If the question holds a theory, read the source as if the theory were not there.
3. Run `pnpm refs <name>` for each Reference that the question needs. It fetches a Reference that is missing or not at its pin.
4. Search only the References and the packages that the question names.
5. Write the answer.

## The answer

- The first line is the answer: yes, no, or the fact.
- Then the evidence. Cite each source as `` `name:path` ``, with `#symbol` if it helps.
- Say what you did not find, and where you looked.
- Say what you read and what you ran. A claim that you ran is stronger than a claim that you read.
- Say which parts you could not confirm.

A citation goes in the answer, an issue or a PR. A committed file cites no Reference path, as [`CODING-STANDARD.md`](../../../CODING-STANDARD.md) says.
