import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('all four tools use fixture services, including status comments and conditional closing', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'github-pdf-protocol-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = path.join(root, 'calls.jsonl');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', './tests/mock-services.mjs', 'dist/index.js'],
    env: {
      PATH: process.env.PATH,
      GITHUB_TOKEN: 'synthetic-github-token',
      PDF_API_KEY: 'synthetic-pdf-key',
      PDF_API_BASE_URL: 'https://pdf.fixture.invalid',
      GITHUB_OWNER: 'fixture-owner', GITHUB_REPO: 'fixture-repo',
      SERVICE_TEST_LOG: log,
    },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'operations-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(transport);
  const call = async (name, args) => (await client.callTool({ name, arguments: args })).content[0].text;
  assert.match(await call('create_issue_from_pdf_error', { pdfId: 'fixture', errorType: 'OCR_FAILED', errorMessage: 'Fixture error', severity: 'high', stackTrace: 'Fixture trace' }), /Successfully created issue #7/);
  assert.match(await call('create_issue_from_suggestion', { pdfId: 'fixture', suggestionType: 'QUALITY', suggestion: 'Fixture suggestion' }), /Created suggestion issue #7/);
  assert.match(await call('link_pdf_to_issue', { issueNumber: 7, pdfIds: ['fixture', 'second'] }), /Successfully linked 2 PDF/);
  assert.match(await call('sync_pdf_status_to_issue', { pdfId: 'fixture', status: 'processing' }), /Updated 1 issue/);
  assert.match(await call('sync_pdf_status_to_issue', { pdfId: 'fixture', status: 'completed' }), /Updated 1 issue/);
  assert.equal(await call('unknown_tool', {}), 'Unknown tool: unknown_tool');
  const calls = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
  const github = calls.filter(c => c.service === 'github');
  const creates = github.filter(c => c.method === 'POST' && c.path.endsWith('/issues'));
  assert.equal(creates.length, 2);
  assert.equal(creates[0].body.title, '[OCR_FAILED] Error processing PDF: fixture.pdf');
  assert.match(creates[0].body.body, /Fixture error/);
  assert.match(creates[0].body.body, /Fixture trace/);
  assert.ok(creates[0].body.labels.includes('🔴 priority:high'));
  assert.ok(creates[0].body.labels.includes('🔍 ocr'));
  assert.equal(creates[1].body.title, '[Suggestion] QUALITY: fixture.pdf');
  assert.match(creates[1].body.body, /Fixture suggestion/);
  const comments = github.filter(c => c.path.endsWith('/comments'));
  assert.equal(comments.length, 3);
  assert.match(comments[0].body.body, /https:\/\/pdf.fixture.invalid\/pdf\/second/);
  assert.match(comments[1].body.body, /currently being processed/);
  assert.match(comments[2].body.body, /completed successfully/);
  const closes = github.filter(c => c.method === 'PATCH');
  assert.equal(closes.length, 1);
  assert.deepEqual(closes[0].body, { state: 'closed', state_reason: 'completed' });
  assert.deepEqual(github.filter(c => c.path === '/search/issues').map(c => c.query), [
    'repo:fixture-owner/fixture-repo "fixture" in:body is:open',
    'repo:fixture-owner/fixture-repo "fixture" in:body is:open',
  ]);
  assert.equal(calls.filter(c => c.service === 'pdf').length, 4);
  assert.equal(github.length, 9);
});
