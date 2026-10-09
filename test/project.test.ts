import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { composeProjectName, readProject, writeProject, type Project } from '../src/project.ts';

const project: Project = {
  industry: 'software',
  siteType: 'landing',
  domain: null,
  url: 'https://localhost',
  server: 'ssh://deploy@server.example.com:2222',
  serverPath: 'appsolutely/demo',
};

test('a project round-trips through appsolutely.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-project-'));
  writeProject(dir, project);
  assert.deepEqual(readProject(dir), project);
});

test('a directory without appsolutely.json is not a project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-project-'));
  assert.throws(() => readProject(dir), /No appsolutely\.json in .*; run this inside a project appsolutely init made/);
});

test('a hand-edited file with a wrong value is refused with the field named', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-project-'));
  writeFileSync(join(dir, 'appsolutely.json'), JSON.stringify({ ...project, siteType: 'Landing Page' }));
  assert.throws(() => readProject(dir), /siteType/);
  writeFileSync(join(dir, 'appsolutely.json'), JSON.stringify({ ...project, server: 'tcp://server.example.com' }));
  assert.throws(() => readProject(dir), /server/);
  writeFileSync(join(dir, 'appsolutely.json'), JSON.stringify({ ...project, serverPath: '../etc' }));
  assert.throws(() => readProject(dir), /serverPath/);
  writeFileSync(join(dir, 'appsolutely.json'), JSON.stringify({ ...project, serverPath: 'a dir; rm -rf ~' }));
  assert.throws(() => readProject(dir), /serverPath/);
  writeFileSync(join(dir, 'appsolutely.json'), '{');
  assert.throws(() => readProject(dir), /appsolutely\.json is not JSON/);
});

test('the compose project name is a lower-case Compose-safe form of the directory name', () => {
  assert.equal(composeProjectName('/work/My Shop.v2'), 'my-shop-v2');
  assert.equal(composeProjectName('/work/demo'), 'demo');
  assert.throws(() => composeProjectName('/work/...'), /cannot name a Compose project/);
});

test('a server without its path, or a path without its server, is refused with the missing half named', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-project-'));
  writeFileSync(join(dir, 'appsolutely.json'), JSON.stringify({ ...project, serverPath: null }));
  assert.throws(() => readProject(dir), /server is set but serverPath is not/);
  writeFileSync(join(dir, 'appsolutely.json'), JSON.stringify({ ...project, server: null }));
  assert.throws(() => readProject(dir), /serverPath is set but server is not/);
});
