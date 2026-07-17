import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createLearnerHomeCacheForTests,
} from './learner-home.service.js';
import type { LearnerHomeResponse } from './learner-home.types.js';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const responseFor = (learnerId: string): LearnerHomeResponse =>
  ({ learnerId } as unknown as LearnerHomeResponse);

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('learner-home cache single-flight', () => {
  test('shares one same-learner miss and caches one complete result', async () => {
    const loadDeferred = deferred<LearnerHomeResponse>();
    let loadCount = 0;
    const cache = createLearnerHomeCacheForTests(async (learnerId) => {
      loadCount += 1;
      assert.equal(learnerId, 'learner-a');
      return loadDeferred.promise;
    });

    const requests = Array.from({ length: 10 }, () => cache.get('learner-a'));
    await flushMicrotasks();

    assert.equal(loadCount, 1);
    assert.deepEqual(cache.getDiagnostics(), {
      cacheSize: 0,
      inFlightSize: 1,
      generationSize: 0,
      cacheWriteCount: 0,
    });

    const response = responseFor('learner-a');
    loadDeferred.resolve(response);
    const results = await Promise.all(requests);

    assert.equal(loadCount, 1);
    assert.ok(results.every((result) => result === response));
    assert.deepEqual(cache.getDiagnostics(), {
      cacheSize: 1,
      inFlightSize: 0,
      generationSize: 0,
      cacheWriteCount: 1,
    });

    assert.strictEqual(await cache.get('learner-a'), response);
    assert.equal(loadCount, 1);
    assert.equal(cache.getDiagnostics().inFlightSize, 0);
  });

  test('different learners compute independently without crossing results', async () => {
    const learnerA = deferred<LearnerHomeResponse>();
    let loadCount = 0;
    const cache = createLearnerHomeCacheForTests(async (learnerId) => {
      loadCount += 1;
      if (learnerId === 'learner-a') {
        return learnerA.promise;
      }

      return responseFor(learnerId);
    });

    const requestA = cache.get('learner-a');
    const requestB = cache.get('learner-b');
    const responseB = await requestB;

    assert.equal(loadCount, 2);
    assert.equal(responseB, await cache.get('learner-b'));
    assert.equal(cache.getDiagnostics().inFlightSize, 1);

    const responseA = responseFor('learner-a');
    learnerA.resolve(responseA);
    assert.strictEqual(await requestA, responseA);
    assert.notStrictEqual(responseA, responseB);
    assert.equal(cache.getDiagnostics().inFlightSize, 0);
  });

  test('shares failures, cleans up, and allows a later retry', async () => {
    const failure = new Error('learner-home load failed');
    let loadCount = 0;
    let retryResponse: LearnerHomeResponse | null = null;
    const cache = createLearnerHomeCacheForTests(async (learnerId) => {
      loadCount += 1;
      if (loadCount === 1) {
        throw failure;
      }

      retryResponse ??= responseFor(learnerId);
      return retryResponse;
    });

    const outcomes = await Promise.allSettled([
      cache.get('learner-a'),
      cache.get('learner-a'),
    ]);

    assert.equal(loadCount, 1);
    assert.equal(outcomes[0]?.status, 'rejected');
    assert.equal(outcomes[1]?.status, 'rejected');
    assert.strictEqual(
      outcomes[0]?.status === 'rejected' ? outcomes[0].reason : undefined,
      failure,
    );
    assert.strictEqual(
      outcomes[1]?.status === 'rejected' ? outcomes[1].reason : undefined,
      failure,
    );
    assert.deepEqual(cache.getDiagnostics(), {
      cacheSize: 0,
      inFlightSize: 0,
      generationSize: 0,
      cacheWriteCount: 0,
    });

    const retry = await cache.get('learner-a');
    assert.strictEqual(await cache.get('learner-a'), retry);
    assert.equal(loadCount, 2);
    assert.equal(cache.getDiagnostics().cacheWriteCount, 1);
  });

  test('does not repopulate after targeted invalidation during a flight', async () => {
    const oldLoad = deferred<LearnerHomeResponse>();
    const freshResponse = responseFor('learner-a-fresh');
    let loadCount = 0;
    const cache = createLearnerHomeCacheForTests(async (learnerId) => {
      loadCount += 1;
      if (loadCount === 1) {
        return oldLoad.promise;
      }

      return freshResponse;
    });

    const oldRequest = cache.get('learner-a');
    await flushMicrotasks();
    cache.invalidate('learner-a');

    assert.equal(cache.getDiagnostics().generationSize, 1);
    const oldResponse = responseFor('learner-a-old');
    oldLoad.resolve(oldResponse);
    assert.strictEqual(await oldRequest, oldResponse);

    assert.deepEqual(cache.getDiagnostics(), {
      cacheSize: 0,
      inFlightSize: 0,
      generationSize: 0,
      cacheWriteCount: 0,
    });

    assert.strictEqual(await cache.get('learner-a'), freshResponse);
    assert.equal(loadCount, 2);
    assert.equal(cache.getDiagnostics().cacheWriteCount, 1);
  });

  test('global invalidation affects active flights but preserves learner isolation', async () => {
    const learnerA = deferred<LearnerHomeResponse>();
    const learnerB = deferred<LearnerHomeResponse>();
    const cache = createLearnerHomeCacheForTests(async (learnerId) =>
      learnerId === 'learner-a' ? learnerA.promise : learnerB.promise,
    );

    const requestA = cache.get('learner-a');
    const requestB = cache.get('learner-b');
    await flushMicrotasks();
    cache.invalidateAll();

    assert.deepEqual(cache.getDiagnostics(), {
      cacheSize: 0,
      inFlightSize: 2,
      generationSize: 2,
      cacheWriteCount: 0,
    });

    learnerA.resolve(responseFor('learner-a-old'));
    learnerB.resolve(responseFor('learner-b-old'));
    await Promise.all([requestA, requestB]);

    assert.deepEqual(cache.getDiagnostics(), {
      cacheSize: 0,
      inFlightSize: 0,
      generationSize: 0,
      cacheWriteCount: 0,
    });
  });

  test('preserves TTL and targeted invalidation semantics', async () => {
    let now = 1_000;
    let loadCount = 0;
    const cache = createLearnerHomeCacheForTests(
      async (learnerId) => {
        loadCount += 1;
        return responseFor(`${learnerId}-${loadCount}`);
      },
      () => now,
    );

    const firstA = await cache.get('learner-a');
    const firstB = await cache.get('learner-b');
    now += 44_999;
    assert.strictEqual(await cache.get('learner-a'), firstA);
    assert.strictEqual(await cache.get('learner-b'), firstB);
    assert.equal(loadCount, 2);

    now += 1;
    const expiredA = await cache.get('learner-a');
    assert.notStrictEqual(expiredA, firstA);
    assert.equal(loadCount, 3);

    const refreshedB = await cache.get('learner-b');
    assert.equal(loadCount, 4);
    cache.invalidate('learner-a');
    assert.strictEqual(await cache.get('learner-b'), refreshedB);
    assert.equal(loadCount, 4);
    assert.notStrictEqual(await cache.get('learner-a'), expiredA);
    assert.equal(loadCount, 5);
  });
});
