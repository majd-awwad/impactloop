import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createLikedMaterialsService,
  type LikedMaterialsServiceDependencies,
} from './materials.service.js';

type VisibleLike = Awaited<
  ReturnType<LikedMaterialsServiceDependencies['findVisibleLikedMaterials']>
>[number];

const visibleLike = {
  id: 'like-1',
  userId: 'learner-1',
  materialId: 'material-1',
  createdAt: new Date('2026-07-29T00:00:00.000Z'),
  material: {
    id: 'material-1',
    title: 'Reusable sensor',
    description: 'A working sensor.',
    category: {
      id: 'category-1',
      nameEn: 'Electronics',
      nameAr: 'إلكترونيات',
      isActive: true,
      categoryType: 'BOTH',
    },
    condition: 'GOOD',
    status: 'RESERVED',
    quantity: 5,
    unit: 'piece',
    isFree: true,
    price: null,
    location: {
      city: 'Nablus',
      area: 'Rafidia',
      latitude: null,
      longitude: null,
    },
    deliveryAllowed: false,
    pickupAllowed: true,
    images: [],
    supplierProfile: null,
    owner: { displayName: 'Supplier' },
    viewsCount: 4,
    createdAt: new Date('2026-07-28T00:00:00.000Z'),
    _count: { likes: 3 },
  },
} as unknown as VisibleLike;

describe('liked materials service', () => {
  test('uses two parallel bounded reads and one batched quantity read', async () => {
    const calls: string[] = [];
    let releasePage!: (value: VisibleLike[]) => void;
    let releaseCount!: (value: number) => void;
    const page = new Promise<VisibleLike[]>((resolve) => {
      releasePage = resolve;
    });
    const count = new Promise<number>((resolve) => {
      releaseCount = resolve;
    });

    const load = createLikedMaterialsService({
      findVisibleLikedMaterials: async (userId, query) => {
        calls.push(`page:${userId}:${query.page}:${query.limit}`);
        return page;
      },
      countVisibleLikedMaterials: async (userId) => {
        calls.push(`count:${userId}`);
        return count;
      },
      getHeldQuantitiesByMaterialIds: async (ids) => {
        calls.push(`held:${ids.join(',')}`);
        return new Map();
      },
    });

    const pending = load('learner-1', { page: 2, limit: 20 });
    await Promise.resolve();
    assert.deepEqual(calls, ['page:learner-1:2:20', 'count:learner-1']);

    releasePage([visibleLike]);
    releaseCount(21);
    const result = await pending;

    assert.deepEqual(calls, [
      'page:learner-1:2:20',
      'count:learner-1',
      'held:material-1',
    ]);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.likedAt, '2026-07-29T00:00:00.000Z');
    assert.equal(result.items[0]?.material.id, 'material-1');
    assert.equal(result.items[0]?.material.isLiked, true);
    assert.equal(result.items[0]?.material.likesCount, 3);
    assert.deepEqual(result.pagination, {
      page: 2,
      limit: 20,
      total: 21,
      totalPages: 2,
    });
  });

  test('returns an explicit empty first page without per-item work', async () => {
    let heldCalls = 0;
    const load = createLikedMaterialsService({
      findVisibleLikedMaterials: async () => [],
      countVisibleLikedMaterials: async () => 0,
      getHeldQuantitiesByMaterialIds: async (ids) => {
        heldCalls += 1;
        assert.deepEqual(ids, []);
        return new Map();
      },
    });

    const result = await load('learner-1', { page: 1, limit: 20 });

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.pagination, {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
    assert.equal(heldCalls, 1);
  });
});
