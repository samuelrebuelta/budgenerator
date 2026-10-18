export type PushNotificationInput =
  | { jobId: string; leadId: string; fid: string }
  | { jobId: string; leadId: string; registrationToken: string };

export interface NotificationTransport {
  sendPush(input: PushNotificationInput): Promise<{ messageId: string }>;
}

export class NotificationDeliveryError extends Error {
  readonly code: string;

  constructor(
    code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'NotificationDeliveryError';
    this.code = /^[a-z][a-z0-9_]{0,39}$/.test(code) ? code : 'delivery_failed';
  }
}
