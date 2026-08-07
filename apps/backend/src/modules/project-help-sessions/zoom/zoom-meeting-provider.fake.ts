import { createHash } from 'node:crypto';

import type {
  CreateZoomMeetingInput,
  CreatedZoomMeeting,
  ZoomMeetingDetails,
  ZoomMeetingProvider,
} from './zoom-meeting.types.js';
import { ZoomError } from './zoom-errors.js';

export type FakeZoomBehavior = {
  failCreate?: boolean;
  failDelete?: boolean;
  failGet?: boolean;
  createDelayMs?: number;
  deleteNotFoundMeetingIds?: Set<string>;
  getNotFoundMeetingIds?: Set<string>;
};

type StoredMeeting = CreatedZoomMeeting & { hostStartUrl: string };

const meetings = new Map<string, StoredMeeting>();
const createInputs: CreateZoomMeetingInput[] = [];
let createCallCount = 0;
let deleteCallCount = 0;
let getCallCount = 0;
let behavior: FakeZoomBehavior = {};
let createInFlight: Promise<CreatedZoomMeeting> | null = null;

const buildMeetingId = (input: CreateZoomMeetingInput) => {
  const digest = createHash('sha256')
    .update(`${input.topic}|${input.startsAt.toISOString()}|${input.durationMinutes}`)
    .digest('hex');
  return `${Number.parseInt(digest.slice(0, 12), 16)}`;
};

const buildUrls = (meetingId: string) => ({
  joinUrl: `https://fake.zoom.test/j/${meetingId}`,
  hostStartUrl: `https://fake.zoom.test/s/${meetingId}`,
});

export class FakeZoomMeetingProvider implements ZoomMeetingProvider {
  async createMeeting(input: CreateZoomMeetingInput): Promise<CreatedZoomMeeting> {
    createCallCount += 1;
    createInputs.push({ ...input });

    const run = async (): Promise<CreatedZoomMeeting> => {
      if (behavior.createDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, behavior.createDelayMs));
      }
      if (behavior.failCreate) {
        throw new ZoomError('Fake Zoom create failed.', 502, 'ZOOM_CREATE_FAILED');
      }
      const meetingId = buildMeetingId(input);
      const urls = buildUrls(meetingId);
      const created: StoredMeeting = {
        meetingId,
        joinUrl: urls.joinUrl,
        hostStartUrl: urls.hostStartUrl,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
      };
      meetings.set(meetingId, created);
      return {
        meetingId: created.meetingId,
        joinUrl: created.joinUrl,
        startsAt: created.startsAt,
        durationMinutes: created.durationMinutes,
      };
    };

    if (behavior.createDelayMs) {
      if (!createInFlight) {
        createInFlight = run().finally(() => {
          createInFlight = null;
        });
      }
      return createInFlight;
    }

    return run();
  }

  async getMeeting(meetingId: string): Promise<ZoomMeetingDetails> {
    getCallCount += 1;
    if (behavior.failGet || behavior.getNotFoundMeetingIds?.has(meetingId)) {
      throw new ZoomError('Fake Zoom meeting not found.', 404, 'ZOOM_MEETING_NOT_FOUND');
    }
    const stored = meetings.get(meetingId);
    if (!stored) {
      throw new ZoomError('Fake Zoom meeting not found.', 404, 'ZOOM_MEETING_NOT_FOUND');
    }
    return { ...stored };
  }

  async getFreshHostStartUrl(meetingId: string): Promise<string> {
    const details = await this.getMeeting(meetingId);
    return details.hostStartUrl;
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    deleteCallCount += 1;
    if (behavior.deleteNotFoundMeetingIds?.has(meetingId) || !meetings.has(meetingId)) {
      if (behavior.failDelete) {
        throw new ZoomError('Fake Zoom delete failed.', 502, 'ZOOM_DELETE_FAILED');
      }
      return;
    }
    if (behavior.failDelete) {
      throw new ZoomError('Fake Zoom delete failed.', 502, 'ZOOM_DELETE_FAILED');
    }
    meetings.delete(meetingId);
  }
}

export const resetFakeZoomMeetingProviderForTests = () => {
  meetings.clear();
  createInputs.length = 0;
  createCallCount = 0;
  deleteCallCount = 0;
  getCallCount = 0;
  behavior = {};
  createInFlight = null;
};

export const setFakeZoomBehaviorForTests = (next: FakeZoomBehavior) => {
  behavior = { ...next };
};

export const getFakeZoomCapturedCreateInputs = () => [...createInputs];
export const getFakeZoomCreateCallCount = () => createCallCount;
export const getFakeZoomDeleteCallCount = () => deleteCallCount;
export const getFakeZoomGetCallCount = () => getCallCount;
