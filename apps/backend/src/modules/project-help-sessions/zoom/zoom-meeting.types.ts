export type CreateZoomMeetingInput = {
  topic: string;
  startsAt: Date;
  durationMinutes: 15 | 30;
  agenda?: string;
};

export type CreatedZoomMeeting = {
  meetingId: string;
  joinUrl: string;
  startsAt: Date;
  durationMinutes: number;
};

export type ZoomMeetingDetails = {
  meetingId: string;
  joinUrl: string;
  startsAt: Date;
  durationMinutes: number;
  hostStartUrl: string;
};

export interface ZoomMeetingProvider {
  createMeeting(input: CreateZoomMeetingInput): Promise<CreatedZoomMeeting>;
  getMeeting(meetingId: string): Promise<ZoomMeetingDetails>;
  getFreshHostStartUrl(meetingId: string): Promise<string>;
  deleteMeeting(meetingId: string): Promise<void>;
}
