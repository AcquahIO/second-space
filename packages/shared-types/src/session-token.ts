import type { PresentationChannel } from "./presentation";

export interface SessionTokenPayload {
  sub: string;
  exp: number;
}

export interface PresentationTokenPayload extends SessionTokenPayload {
  workspaceId: string;
  channel: PresentationChannel;
}

export interface PresentationSessionResponse {
  websocketUrl: string;
  presentationToken: string;
  expiresAt: string;
  channel: PresentationChannel;
}

export const PRESENTATION_TOKEN_TTL_SECONDS = 60 * 5;
