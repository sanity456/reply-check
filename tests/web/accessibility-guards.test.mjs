import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(
  new URL('../../app/reply.css', import.meta.url),
  'utf8',
);
const theme = readFileSync(
  new URL('../../app/globals.css', import.meta.url),
  'utf8',
);
test('reduced motion: animation loops stop after one negligible iteration and smooth scrolling is disabled', () => {
  const reduced = css.match(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(reduced);
  assert.match(reduced, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(reduced, /animation-iteration-count:\s*1\s*!important/);
  assert.match(reduced, /transition-duration:\s*0\.01ms\s*!important/);
  assert.match(reduced, /scroll-behavior:\s*auto\s*!important/);
});

function color(token) {
  const hex = theme.match(new RegExp(`${token}:\\s*#([0-9a-f]{6});`, 'i'))?.[1];
  assert.ok(hex, token);
  return [0, 2, 4].map(
    (start) => parseInt(hex.slice(start, start + 2), 16) / 255,
  );
}
function luminance(rgb) {
  const linear = rgb.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
test('contrast: primary text, muted text, action labels and semantic notices meet 4.5:1 on their opaque theme surfaces', () => {
  for (const [foreground, background] of [
    ['--foreground', '--card'],
    ['--foreground', '--rc-field'],
    ['--muted-foreground', '--card'],
    ['--muted-foreground', '--muted'],
    ['--primary-foreground', '--primary'],
    ['--secondary-foreground', '--secondary'],
    ['--rc-purple-soft', '--rc-surface-raised'],
    ['--rc-success', '--rc-success-bg'],
    ['--rc-warning', '--rc-warning-bg'],
    ['--rc-danger', '--rc-danger-bg'],
  ]) {
    const a = luminance(color(foreground)),
      b = luminance(color(background));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(
      ratio >= 4.5,
      `${foreground} on ${background}: ${ratio.toFixed(2)}`,
    );
  }
});

test('accessibility: explicit keyboard outlines and forced-colors surface/border fallbacks remain present', () => {
  assert.match(
    css,
    /summary:focus-visible,[\s\S]*?outline:\s*2px solid var\(--ring\)/,
  );
  assert.match(css, /\.skip-link:focus\s*\{\s*top:\s*12px/);
  assert.match(
    css,
    /@media\s*\(forced-colors:\s*active\)[\s\S]*?background:\s*Canvas/,
  );
  assert.match(
    css,
    /@media\s*\(forced-colors:\s*active\)[\s\S]*?border:\s*1px solid ButtonText/,
  );
});
