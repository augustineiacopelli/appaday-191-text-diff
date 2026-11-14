'use strict';
// Local only harness for AppADay 191 Text Diff. Run: node test.js
// It slices the engine out of index.html and runs it inside the vm module.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const startMark = '/* ENGINE_START */';
const endMark = '/* ENGINE_END */';
const s = html.indexOf(startMark), e = html.indexOf(endMark);
assert(s > -1 && e > s, 'engine markers not found in index.html');
const engineSrc = html.slice(s + startMark.length, e);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox, { filename: 'engine.js' });
const E = sandbox;

// Cross realm values need to be plain before deep comparison.
const plain = (v) => JSON.parse(JSON.stringify(v));
const inlineText = (runs) => runs.map((r) => (r.type === 'del' ? r.a : r.b)).join('');
const types = (runs) => runs.map((r) => r.type);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS  ' + name); }
  catch (err) { failed++; console.log('FAIL  ' + name + '\n      ' + (err && err.message)); }
}

test('engine exposes the expected functions', () => {
  ['tokenize', 'key', 'diff', 'mergeRuns', 'stats', 'unifiedDiff'].forEach((n) => {
    assert.strictEqual(typeof E[n], 'function', n + ' missing');
  });
});

test('identical text has one unchanged run and 100 percent similarity', () => {
  ['words', 'lines', 'chars'].forEach((mode) => {
    const r = E.diff('same text here\nand more', 'same text here\nand more', mode, {});
    assert.deepStrictEqual(plain(types(r.runs)), ['eq']);
    const st = E.stats(r.runs);
    assert.strictEqual(st.added, 0);
    assert.strictEqual(st.removed, 0);
    assert.strictEqual(st.similarity, 100);
    assert.strictEqual(st.changed, false);
    assert.strictEqual(E.unifiedDiff('same text here', 'same text here', {}), '');
  });
});

test('both inputs empty gives no runs and no errors in every mode', () => {
  ['words', 'lines', 'chars'].forEach((mode) => {
    const r = E.diff('', '', mode, {});
    assert.strictEqual(r.runs.length, 0);
    const st = E.stats(r.runs);
    assert.strictEqual(st.added + st.removed + st.unchanged, 0);
    assert.strictEqual(st.similarity, 100);
    assert.strictEqual(r.notice, '');
  });
  assert.strictEqual(E.unifiedDiff('', '', {}), '');
});

test('pure insertion in the middle', () => {
  const r = E.diff('the cat', 'the big cat', 'words', {});
  const st = E.stats(r.runs);
  assert.strictEqual(st.added, 1);
  assert.strictEqual(st.removed, 0);
  assert.strictEqual(st.unchanged, 2);
  const add = r.runs.filter((x) => x.type === 'add');
  assert.strictEqual(add.length, 1);
  assert.strictEqual(add[0].b, 'big ');
  assert.strictEqual(inlineText(r.runs), 'the big cat');
});

test('pure insertion into empty original', () => {
  const r = E.diff('', 'hello world', 'words', {});
  const st = E.stats(r.runs);
  assert.strictEqual(st.added, 2);
  assert.strictEqual(st.removed, 0);
  assert.strictEqual(st.similarity, 0);
  assert.strictEqual(E.unifiedDiff('', 'x', {}), '--- Original\n+++ Changed\n@@ -0,0 +1 @@\n+x\n');
});

test('pure deletion in the middle', () => {
  const r = E.diff('the big cat', 'the cat', 'words', {});
  const st = E.stats(r.runs);
  assert.strictEqual(st.added, 0);
  assert.strictEqual(st.removed, 1);
  const del = r.runs.filter((x) => x.type === 'del');
  assert.strictEqual(del.length, 1);
  assert.strictEqual(del[0].a, 'big ');
});

test('pure deletion to empty changed text', () => {
  const r = E.diff('hello world', '', 'words', {});
  const st = E.stats(r.runs);
  assert.strictEqual(st.removed, 2);
  assert.strictEqual(st.added, 0);
  assert.strictEqual(st.similarity, 0);
  assert.strictEqual(E.unifiedDiff('x', '', {}), '--- Original\n+++ Changed\n@@ -1 +0,0 @@\n-x\n');
});

test('replacement orders removed before added', () => {
  const r = E.diff('a b c d', 'a b x d', 'words', {});
  assert.deepStrictEqual(plain(types(r.runs)), ['eq', 'del', 'add', 'eq']);
  const st = E.stats(r.runs);
  assert.strictEqual(st.unchanged, 3);
  assert.strictEqual(st.similarity, 75);
});

test('characters mode matches a known edit distance example', () => {
  const r = E.diff('kitten', 'sitting', 'chars', {});
  const st = E.stats(r.runs);
  assert.strictEqual(st.unchanged, 4);
  assert.strictEqual(st.removed, 2);
  assert.strictEqual(st.added, 3);
});

test('Ignore Case treats different case as unchanged', () => {
  const off = E.stats(E.diff('Hello World', 'hello world', 'words', {}).runs);
  assert.strictEqual(off.changed, true);
  assert.strictEqual(off.removed, 2);
  assert.strictEqual(off.added, 2);
  const on = E.diff('Hello World', 'hello world', 'words', { ignoreCase: true });
  assert.strictEqual(E.stats(on.runs).changed, false);
  assert.strictEqual(E.unifiedDiff('Hello', 'HELLO', { ignoreCase: true }), '');
  const chars = E.stats(E.diff('ABC', 'abc', 'chars', { ignoreCase: true }).runs);
  assert.strictEqual(chars.changed, false);
});

test('Ignore Whitespace treats spacing differences as unchanged', () => {
  assert.strictEqual(E.stats(E.diff('a  b', 'a b', 'words', {}).runs).changed, true);
  assert.strictEqual(E.stats(E.diff('a  b', 'a b', 'words', { ignoreWhitespace: true }).runs).changed, false);
  assert.strictEqual(E.stats(E.diff('a\nb', 'a b', 'words', { ignoreWhitespace: true }).runs).changed, false);
  assert.strictEqual(E.stats(E.diff('  x  ', 'x', 'lines', { ignoreWhitespace: true }).runs).changed, false);
  assert.strictEqual(E.stats(E.diff('  x  ', 'x', 'lines', {}).runs).changed, true);
  assert.strictEqual(E.unifiedDiff('  x  ', 'x', { ignoreWhitespace: true }), '');
});

test('line endings and a trailing newline do not create false differences', () => {
  assert.strictEqual(E.stats(E.diff('a\r\nb', 'a\nb', 'lines', {}).runs).changed, false);
  assert.strictEqual(E.stats(E.diff('a\nb', 'a\nb\n', 'lines', {}).runs).changed, false);
});

test('large input falls back to lines with a visible notice', () => {
  const a = Array.from({ length: 3000 }, (_, i) => 'a' + i).join(' ');
  const b = Array.from({ length: 3000 }, (_, i) => 'b' + i).join(' ');
  const t0 = Date.now();
  const r = E.diff(a, b, 'words', {});
  assert(Date.now() - t0 < 5000, 'fallback took too long');
  assert.strictEqual(r.mode, 'lines');
  assert(/lines/i.test(r.notice) && /too large/i.test(r.notice), 'notice missing: ' + r.notice);
  const st = E.stats(r.runs);
  assert.strictEqual(st.removed, 1);
  assert.strictEqual(st.added, 1);
});

test('very large input falls back to one removed block and one added block', () => {
  const a = Array.from({ length: 2500 }, (_, i) => 'a' + i).join('\n');
  const b = Array.from({ length: 2500 }, (_, i) => 'b' + i).join('\n');
  ['words', 'chars', 'lines'].forEach((mode) => {
    const t0 = Date.now();
    const r = E.diff(a, b, mode, {});
    assert(Date.now() - t0 < 5000, 'fallback took too long in ' + mode);
    assert.strictEqual(r.mode, 'lines');
    assert.deepStrictEqual(plain(types(r.runs)), ['del', 'add']);
    assert(/one removed block and one added block/.test(r.notice), 'notice missing: ' + r.notice);
    assert.strictEqual(r.runs[0].a, a);
    assert.strictEqual(r.runs[1].b, b);
    const st = E.stats(r.runs);
    assert.strictEqual(st.removed, 2500);
    assert.strictEqual(st.added, 2500);
  });
  const unified = E.unifiedDiff(a, b, {}, 3);
  assert(unified.indexOf('@@ -1,2500 +1,2500 @@') > -1, 'unified diff should be a single block hunk');
});

test('HTML injection strings pass through unchanged', () => {
  const evil = '<img src=x onerror=alert(1)> & "quoted" <script>alert(2)</script>';
  const r = E.diff(evil, evil + ' tail', 'words', {});
  assert.strictEqual(inlineText(r.runs), evil + ' tail');
  assert(r.runs.some((x) => x.type === 'eq' && x.b.indexOf('<img src=x onerror=alert(1)>') > -1));
  const u = E.unifiedDiff(evil, evil + ' tail', {});
  assert(u.indexOf(evil) > -1, 'unified diff altered the injection string');
});

test('unified diff output format with three lines of context', () => {
  const a = 'a\nb\nc\nd\ne\nf\ng\nh';
  const b = 'a\nb\nc\nD\ne\nf\ng\nh';
  const expected = '--- Original\n+++ Changed\n@@ -1,7 +1,7 @@\n a\n b\n c\n-d\n+D\n e\n f\n g\n';
  assert.strictEqual(E.unifiedDiff(a, b, {}), expected);
});

test('distant changes produce separate hunks and near changes merge', () => {
  const base = Array.from({ length: 20 }, (_, i) => 'line' + i);
  const far = base.slice(); far[1] = 'X'; far[18] = 'Y';
  const hunks = (t) => t.split('\n').filter((l) => l.indexOf('@@ -') === 0).length;
  assert.strictEqual(hunks(E.unifiedDiff(base.join('\n'), far.join('\n'), {})), 2);
  const near = base.slice(); near[5] = 'X'; near[9] = 'Y';
  assert.strictEqual(hunks(E.unifiedDiff(base.join('\n'), near.join('\n'), {})), 1);
});

test('source scan: no innerHTML or other HTML string sinks', () => {
  ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval('].forEach((bad) => {
    assert.strictEqual(html.indexOf(bad), -1, 'index.html contains ' + bad);
  });
});

test('source scan: forbidden APIs and non ASCII characters are absent', () => {
  assert(!/window\.confirm|\bconfirm\(/.test(html), 'confirm used');
  assert(!/roundRect|\.ellipse\(/.test(html), 'canvas helper used');
  assert(!/\.remove\(\)/.test(html), 'bare remove() used');
  const bad = [];
  for (let i = 0; i < html.length; i++) if (html.charCodeAt(i) > 127) bad.push(i);
  assert.strictEqual(bad.length, 0, 'non ASCII characters at ' + bad.slice(0, 5).join(','));
});

test('source scan: head tags appear exactly once and external URLs are limited to the portal', () => {
  const count = (re) => (html.match(re) || []).length;
  assert.strictEqual(count(/<link rel="apple-touch-icon" href="https:\/\/augustineiacopelli\.github\.io\/appaday\/icons\/191\.png">/g), 1);
  assert.strictEqual(count(/<meta name="apple-mobile-web-app-title" content="Text Diff">/g), 1);
  assert.strictEqual(count(/<meta name="apple-mobile-web-app-capable" content="yes">/g), 1);
  assert.strictEqual(count(/<meta name="mobile-web-app-capable" content="yes">/g), 1);
  assert.strictEqual(count(/<meta name="apple-mobile-web-app-status-bar-style" content="black">/g), 1);
  assert.strictEqual(count(/<link rel="manifest" href="https:\/\/augustineiacopelli\.github\.io\/appaday\/manifests\/191\.webmanifest">/g), 1);
  assert.strictEqual(count(/<script src="https:\/\/augustineiacopelli\.github\.io\/appaday\/save\.js" defer><\/script>/g), 1);
  assert.strictEqual(count(/<title>Text Diff \| AppADay 191<\/title>/g), 1);
  assert.strictEqual(count(/<script src=/g), 1, 'only save.js may be loaded');
  const urls = html.match(/https?:\/\/[^\s"'<>)]+/g) || [];
  urls.forEach((u) => assert(u.indexOf('https://augustineiacopelli.github.io/appaday/') === 0, 'unexpected URL ' + u));
  assert.strictEqual(count(/<a class="back" href="https:\/\/augustineiacopelli\.github\.io\/appaday\/">/g), 2, 'backlink needed in header and footer');
});

test('source scan: inline script parses as a classic script', () => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert(m, 'inline script not found');
  new vm.Script(m[1], { filename: 'inline.js' });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
