import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

test('lists all tools over stdio', async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: {
      ...process.env,
      GITHUB_TOKEN: 'test-token',
      PDF_API_BASE_URL: 'http://127.0.0.1:9',
      PDF_API_KEY: 'test-key',
    },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'protocol-test', version: '1.0.0' });

  t.after(async () => {
    await client.close();
  });

  await client.connect(transport);
  const response = await client.listTools();

  assert.deepEqual(
    response.tools.map((tool) => tool.name).sort(),
    [
      'create_issue_from_pdf_error',
      'create_issue_from_suggestion',
      'link_pdf_to_issue',
      'sync_pdf_status_to_issue',
    ],
  );
});
