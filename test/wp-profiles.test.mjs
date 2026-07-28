import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEmployer } from '../src/lib/wp-profiles.mjs';

const jobEntry = (dates, company) =>
  `<div class="job-entry"><div class="dates">${dates}</div><div class="summary">x</div><div class="company">${company}</div></div>`;

test('parseEmployer takes the employer from the "Present" job and drops the employment-type', () => {
  const html = jobEntry('2019 &ndash; 2021', 'Old Co')
    + jobEntry('Aug 2025 &ndash; Present', 'WP Engine<span class="employment-type">&middot; Full-time</span>');
  assert.equal(parseEmployer(html), 'WP Engine');
});

test('parseEmployer returns null when no current job is listed', () => {
  assert.equal(parseEmployer(jobEntry('2018 &ndash; 2020', 'Past Co')), null);
  assert.equal(parseEmployer('<div class="item-meta-about">no jobs here</div>'), null);
});

test('parseEmployer decodes an ampersand entity in the name', () => {
  assert.equal(parseEmployer(jobEntry('Present', 'Ben &amp; Jerry')), 'Ben & Jerry');
});
