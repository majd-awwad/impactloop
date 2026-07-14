import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  requestId: string;
  startedAt: number;
  method: string;
  path: string;
  userId?: string;
  activeRole?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(
  context: RequestContext,
  fn: () => T,
): T => requestContextStorage.run(context, fn);

export const getRequestContext = (): RequestContext | undefined =>
  requestContextStorage.getStore();

export const updateRequestContext = (
  partial: Partial<Pick<RequestContext, 'userId' | 'activeRole'>>,
): void => {
  const store = requestContextStorage.getStore();

  if (!store) {
    return;
  }

  if (partial.userId !== undefined) {
    store.userId = partial.userId;
  }

  if (partial.activeRole !== undefined) {
    store.activeRole = partial.activeRole;
  }
};

export const getRequestId = (): string | undefined =>
  getRequestContext()?.requestId;

export const resetRequestContextForTests = (): void => {
  requestContextStorage.disable();
};
