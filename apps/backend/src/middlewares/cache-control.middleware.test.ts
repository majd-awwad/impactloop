import assert from 'node:assert/strict';
import { request, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';

import express from 'express';

import { privateNoStoreMiddleware } from './cache-control.middleware.js';

describe('cache control middleware', () => {
  let baseUrl = '';
  let closeServer: (() => Promise<void>) | null = null;

  before(async () => {
    const app = express();
    app.get('/public', (_req, res) => res.json({ visibility: 'public' }));
    app.get('/private', privateNoStoreMiddleware, (_req, res) =>
      res.json({ visibility: 'private' }),
    );

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    closeServer = () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
  });

  after(async () => {
    await closeServer?.();
  });

  const get = (path: string, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; headers: IncomingHttpHeaders }>(
      (resolve, reject) => {
        const req = request(
          `${baseUrl}${path}`,
          { method: 'GET', headers },
          (res) => {
            res.resume();
            res.once('end', () =>
              resolve({ status: res.statusCode ?? 0, headers: res.headers }),
            );
          },
        );
        req.once('error', reject);
        req.end();
      },
    );

  test('public responses retain conditional ETag handling', async () => {
    const first = await get('/public');
    const etag = first.headers.etag;
    assert.ok(etag);

    const replay = await get('/public', { 'If-None-Match': etag });
    assert.equal(replay.status, 304);
  });

  test('private responses never become 304 from request validators', async () => {
    const first = await get('/private');
    const etag = first.headers.etag;
    assert.ok(etag);
    assert.equal(first.headers['cache-control'], 'private, no-store');

    const replay = await get('/private', { 'If-None-Match': etag });
    assert.equal(replay.status, 200);
    assert.equal(replay.headers['cache-control'], 'private, no-store');
  });
});
