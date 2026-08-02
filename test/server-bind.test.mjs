import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveListen,
  isPublicBind,
  isAllowedHost,
  assertPublicBindSafe,
  parseAllowedHosts,
} from '../src/server-bind.mjs';

test('resolveListen defaults to loopback 4321', () => {
  const prev = { PORT: process.env.PORT, UWP_BIND: process.env.UWP_BIND };
  delete process.env.PORT;
  delete process.env.UWP_BIND;
  try {
    assert.deepEqual(resolveListen({}), { host: '127.0.0.1', port: 4321 });
    assert.deepEqual(resolveListen({ port: 9000 }), { host: '127.0.0.1', port: 9000 });
  } finally {
    if (prev.PORT === undefined) delete process.env.PORT; else process.env.PORT = prev.PORT;
    if (prev.UWP_BIND === undefined) delete process.env.UWP_BIND; else process.env.UWP_BIND = prev.UWP_BIND;
  }
});

test('resolveListen reads PORT and UWP_BIND from the environment', () => {
  const prev = { PORT: process.env.PORT, UWP_BIND: process.env.UWP_BIND };
  process.env.PORT = '8080';
  process.env.UWP_BIND = '0.0.0.0';
  try {
    assert.deepEqual(resolveListen({ port: 4321 }), { host: '0.0.0.0', port: 8080 });
  } finally {
    if (prev.PORT === undefined) delete process.env.PORT; else process.env.PORT = prev.PORT;
    if (prev.UWP_BIND === undefined) delete process.env.UWP_BIND; else process.env.UWP_BIND = prev.UWP_BIND;
  }
});

test('isPublicBind treats 0.0.0.0 and :: as public, loopback as local', () => {
  assert.equal(isPublicBind('127.0.0.1'), false);
  assert.equal(isPublicBind('localhost'), false);
  assert.equal(isPublicBind('0.0.0.0'), true);
  assert.equal(isPublicBind('::'), true);
});

test('isAllowedHost accepts loopback names and configured deployment hosts', () => {
  const req = (host) => ({ headers: { host } });
  assert.equal(isAllowedHost(req('localhost:4321')), true);
  assert.equal(isAllowedHost(req('127.0.0.1:8080')), true);
  assert.equal(isAllowedHost(req('evil.example'), ['forge.example.com']), false);
  assert.equal(isAllowedHost(req('forge.example.com'), ['forge.example.com']), true);
});

test('assertPublicBindSafe refuses public bind without UWP_FORGE_TOKEN', () => {
  const prev = {
    UWP_FORGE_TOKEN: process.env.UWP_FORGE_TOKEN,
    UWP_ALLOWED_HOSTS: process.env.UWP_ALLOWED_HOSTS,
  };
  delete process.env.UWP_FORGE_TOKEN;
  delete process.env.UWP_ALLOWED_HOSTS;
  try {
    assert.throws(
      () => assertPublicBindSafe({ host: '0.0.0.0', port: 8080 }),
      /UWP_FORGE_TOKEN/,
    );
  } finally {
    if (prev.UWP_FORGE_TOKEN === undefined) delete process.env.UWP_FORGE_TOKEN;
    else process.env.UWP_FORGE_TOKEN = prev.UWP_FORGE_TOKEN;
    if (prev.UWP_ALLOWED_HOSTS === undefined) delete process.env.UWP_ALLOWED_HOSTS;
    else process.env.UWP_ALLOWED_HOSTS = prev.UWP_ALLOWED_HOSTS;
  }
});

test('assertPublicBindSafe refuses public bind without UWP_ALLOWED_HOSTS', () => {
  const prev = {
    UWP_FORGE_TOKEN: process.env.UWP_FORGE_TOKEN,
    UWP_ALLOWED_HOSTS: process.env.UWP_ALLOWED_HOSTS,
  };
  process.env.UWP_FORGE_TOKEN = 'test-secret';
  delete process.env.UWP_ALLOWED_HOSTS;
  try {
    assert.throws(
      () => assertPublicBindSafe({ host: '0.0.0.0', port: 8080 }),
      /UWP_ALLOWED_HOSTS/,
    );
  } finally {
    if (prev.UWP_FORGE_TOKEN === undefined) delete process.env.UWP_FORGE_TOKEN;
    else process.env.UWP_FORGE_TOKEN = prev.UWP_FORGE_TOKEN;
    if (prev.UWP_ALLOWED_HOSTS === undefined) delete process.env.UWP_ALLOWED_HOSTS;
    else process.env.UWP_ALLOWED_HOSTS = prev.UWP_ALLOWED_HOSTS;
  }
});

test('assertPublicBindSafe passes when hosted env is complete', () => {
  const prev = {
    UWP_FORGE_TOKEN: process.env.UWP_FORGE_TOKEN,
    UWP_ALLOWED_HOSTS: process.env.UWP_ALLOWED_HOSTS,
  };
  process.env.UWP_FORGE_TOKEN = 'test-secret';
  process.env.UWP_ALLOWED_HOSTS = 'forge.example.com';
  try {
    assert.doesNotThrow(() => assertPublicBindSafe({ host: '0.0.0.0', port: 8080 }));
    assert.deepEqual(parseAllowedHosts(), ['forge.example.com']);
  } finally {
    if (prev.UWP_FORGE_TOKEN === undefined) delete process.env.UWP_FORGE_TOKEN;
    else process.env.UWP_FORGE_TOKEN = prev.UWP_FORGE_TOKEN;
    if (prev.UWP_ALLOWED_HOSTS === undefined) delete process.env.UWP_ALLOWED_HOSTS;
    else process.env.UWP_ALLOWED_HOSTS = prev.UWP_ALLOWED_HOSTS;
  }
});
