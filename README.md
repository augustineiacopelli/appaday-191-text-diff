# appaday-191-text-diff

Day 191 of AppADay: Text Diff. Paste two versions of any text and see exactly what changed. Compare by words, lines, or characters, ignore case or whitespace, and read the result inline or side by side with added text in green and removed text in red. Shows similarity percent and copies a unified diff. Runs fully offline in your browser.

Live: https://augustineiacopelli.github.io/appaday-191-text-diff/

Portfolio: https://augustineiacopelli.github.io/appaday/

## What it does

Two labeled boxes, Original and Changed, and a Compare button. Words, Lines, and Characters set the unit of comparison. Ignore Case and Ignore Whitespace treat those differences as unchanged. A stats line reports added, removed, and unchanged counts and a similarity percent. Inline and Side by Side views are available, with Inline chosen by default on narrow screens. Swap exchanges the boxes, Clear empties them, and Copy Unified Diff puts a line based unified diff with three lines of context on the clipboard, with a select and copy box if the browser blocks clipboard access.

Nothing is sent anywhere and nothing is stored.

## How it works

The comparison engine sits between the ENGINE_START and ENGINE_END comments in index.html as pure functions: tokenize, key, diff, mergeRuns, stats, and unifiedDiff. It trims the shared start and end, then finds a longest common subsequence over the rest. If the middle section would need more than four million table cells, it falls back to a line comparison, and if that is still too large it shows one removed block and one added block with a visible notice. Results are drawn with createElement and textContent only, so pasted markup is shown as text and never run.

## Tests

test.js is a local Node harness. It slices the engine out of index.html, runs it in the vm module, and checks identical text, empty input, insertion, deletion, Ignore Case, Ignore Whitespace, the large input fallbacks, HTML injection strings, unified diff format, and a source scan for unsafe APIs and head tags.

```
node test.js
```

## Stack

A single index.html of vanilla HTML, CSS, and JavaScript with no dependencies. Category Utility, no Claude API.
