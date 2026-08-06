import { loadZoomConfig } from './zoom-config.js';
import { DisabledZoomMeetingProvider } from './zoom-meeting-provider.disabled.js';
import { FakeZoomMeetingProvider } from './zoom-meeting-provider.fake.js';
import { RealZoomMeetingProvider } from './zoom-meeting-provider.real.js';
import type { ZoomMeetingProvider } from './zoom-meeting.types.js';

let providerOverride: ZoomMeetingProvider | null = null;
let cachedProvider: ZoomMeetingProvider | null = null;

export const setZoomMeetingProviderForTests = (provider: ZoomMeetingProvider | null) => {
  providerOverride = provider;
  cachedProvider = null;
};

export const resetZoomMeetingProviderCacheForTests = () => {
  cachedProvider = null;
};

export const getZoomMeetingProvider = (): ZoomMeetingProvider => {
  if (providerOverride) {
    return providerOverride;
  }
  if (cachedProvider) {
    return cachedProvider;
  }
  const config = loadZoomConfig();
  if (config.mode === 'fake') {
    cachedProvider = new FakeZoomMeetingProvider();
  } else if (config.mode === 'disabled') {
    cachedProvider = new DisabledZoomMeetingProvider();
  } else {
    cachedProvider = new RealZoomMeetingProvider(config);
  }
  return cachedProvider;
};
