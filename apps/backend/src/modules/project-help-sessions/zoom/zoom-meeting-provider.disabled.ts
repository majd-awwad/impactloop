import type { ZoomMeetingProvider } from './zoom-meeting.types.js';
import { ZoomError } from './zoom-errors.js';

export class DisabledZoomMeetingProvider implements ZoomMeetingProvider {
  async createMeeting(): Promise<never> {
    throw new ZoomError('Zoom integration is disabled.', 503, 'ZOOM_DISABLED');
  }

  async getMeeting(): Promise<never> {
    throw new ZoomError('Zoom integration is disabled.', 503, 'ZOOM_DISABLED');
  }

  async getFreshHostStartUrl(): Promise<never> {
    throw new ZoomError('Zoom integration is disabled.', 503, 'ZOOM_DISABLED');
  }

  async deleteMeeting(): Promise<void> {
    return;
  }
}
