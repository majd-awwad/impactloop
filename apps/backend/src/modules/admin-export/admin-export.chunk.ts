export type ExportKeysetCursor = {
  createdAt: Date;
  id: string;
};

export type KeysetChunkIteratorOptions<
  TItem extends { id: string; createdAt: Date },
> = {
  take: number;
  fetchPage: (cursor?: ExportKeysetCursor) => Promise<TItem[]>;
};

/**
 * Deterministic newest-first chunking using (createdAt DESC, id DESC) keyset.
 * Cursor carries both fields so ties on createdAt cannot skip or duplicate rows.
 */
export async function* iterateKeysetChunks<
  TItem extends { id: string; createdAt: Date },
>(
  options: KeysetChunkIteratorOptions<TItem>,
): AsyncGenerator<TItem[], void, undefined> {
  let cursor: ExportKeysetCursor | undefined;

  while (true) {
    const batch = await options.fetchPage(cursor);
    if (batch.length === 0) {
      return;
    }

    yield batch;

    if (batch.length < options.take) {
      return;
    }

    const last = batch[batch.length - 1]!;
    cursor = { createdAt: last.createdAt, id: last.id };
  }
}

/** @deprecated Use iterateKeysetChunks — retained name alias during migration. */
export const iterateCursorChunks = iterateKeysetChunks;
