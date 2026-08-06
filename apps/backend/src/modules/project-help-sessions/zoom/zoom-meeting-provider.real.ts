import { randomBytes } from 'node:crypto';

import type {
  CreateZoomMeetingInput,
  CreatedZoomMeeting,
  ZoomMeetingDetails,
  ZoomMeetingProvider,
} from './zoom-meeting.types.js';
import { ZoomError } from './zoom-errors.js';
import type { ZoomRealConfig } from './zoom-config.js';
import { zoomApiRequest } from './zoom-http-client.js';

type ZoomCreateResponse = {
  id?: number | string;
  join_url?: string;
  start_time?: string;
  duration?: number;
};

type ZoomGetResponse = {
  id?: number | string;
  join_url?: string;
  start_time?: string;
  duration?: number;
  start_url?: string;
};

const parseMeetingId = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  throw new ZoomError('Zoom meeting response was invalid.', 502, 'ZOOM_RESPONSE_INVALID');
};

const parseJoinUrl = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ZoomError('Zoom meeting response was invalid.', 502, 'ZOOM_RESPONSE_INVALID');
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
    return parsed.toString();
  } catch {
    throw new ZoomError('Zoom meeting response was invalid.', 502, 'ZOOM_RESPONSE_INVALID');
  }
};

const parseStartTime = (value: unknown): Date => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ZoomError('Zoom meeting response was invalid.', 502, 'ZOOM_RESPONSE_INVALID');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ZoomError('Zoom meeting response was invalid.', 502, 'ZOOM_RESPONSE_INVALID');
  }
  return date;
};

const parseDuration = (value: unknown): number => {
  const duration = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new ZoomError('Zoom meeting response was invalid.', 502, 'ZOOM_RESPONSE_INVALID');
  }
  return duration;
};

const generateMeetingPassword = () => randomBytes(6).toString('base64url').slice(0, 10);

const mapCreateResponse = (payload: ZoomCreateResponse): CreatedZoomMeeting => ({
  meetingId: parseMeetingId(payload.id),
  joinUrl: parseJoinUrl(payload.join_url),
  startsAt: parseStartTime(payload.start_time),
  durationMinutes: parseDuration(payload.duration),
});

const mapGetResponse = (payload: ZoomGetResponse): ZoomMeetingDetails => {
  const hostStartUrl = typeof payload.start_url === 'string' ? payload.start_url.trim() : '';
  if (!hostStartUrl) {
    throw new ZoomError('Zoom meeting response was invalid.', 502, 'ZOOM_RESPONSE_INVALID');
  }
  try {
    const parsed = new URL(hostStartUrl);
    if (parsed.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
  } catch {
    throw new ZoomError('Zoom meeting response was invalid.', 502, 'ZOOM_RESPONSE_INVALID');
  }
  return {
    meetingId: parseMeetingId(payload.id),
    joinUrl: parseJoinUrl(payload.join_url),
    startsAt: parseStartTime(payload.start_time),
    durationMinutes: parseDuration(payload.duration),
    hostStartUrl,
  };
};

export type RealZoomProviderDeps = {
  fetchImpl?: typeof fetch;
  getToken?: (config: ZoomRealConfig) => Promise<string>;
};

export class RealZoomMeetingProvider implements ZoomMeetingProvider {
  constructor(
    private readonly config: ZoomRealConfig,
    private readonly deps: RealZoomProviderDeps = {},
  ) {}

  async createMeeting(input: CreateZoomMeetingInput): Promise<CreatedZoomMeeting> {
    const hostUserId = encodeURIComponent(this.config.hostUserId);
    const payload = await zoomApiRequest<ZoomCreateResponse>(
      this.config,
      {
        method: 'POST',
        path: `/users/${hostUserId}/meetings`,
        failureCode: 'ZOOM_CREATE_FAILED',
        body: {
          topic: input.topic,
          type: 2,
          start_time: input.startsAt.toISOString(),
          timezone: 'UTC',
          duration: input.durationMinutes,
          agenda: input.agenda ?? 'ImpactLoop project help session.',
          password: generateMeetingPassword(),
          use_pmi: false,
          settings: {
            host_video: false,
            participant_video: false,
            join_before_host: false,
            waiting_room: true,
            mute_upon_entry: true,
            auto_recording: 'none',
          },
        },
      },
      this.deps,
    );
    return mapCreateResponse(payload);
  }

  async getMeeting(meetingId: string): Promise<ZoomMeetingDetails> {
    const payload = await zoomApiRequest<ZoomGetResponse>(
      this.config,
      {
        method: 'GET',
        path: `/meetings/${encodeURIComponent(meetingId)}`,
        failureCode: 'ZOOM_GET_FAILED',
      },
      this.deps,
    );
    return mapGetResponse(payload);
  }

  async getFreshHostStartUrl(meetingId: string): Promise<string> {
    const details = await this.getMeeting(meetingId);
    return details.hostStartUrl;
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      await zoomApiRequest<void>(
        this.config,
        {
          method: 'DELETE',
          path: `/meetings/${encodeURIComponent(meetingId)}`,
          failureCode: 'ZOOM_DELETE_FAILED',
        },
        this.deps,
      );
    } catch (error) {
      if (error instanceof ZoomError && error.code === 'ZOOM_MEETING_NOT_FOUND') {
        return;
      }
      throw error;
    }
  }
}
