export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
}

export interface SafePushDevice {
  installationId: string;
  enabled: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
}

export interface NotificationSettingsResponse {
  preferences: NotificationPreferences;
  email: { address: string | null; verified: boolean };
  devices: SafePushDevice[];
}
