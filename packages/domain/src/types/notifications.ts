export interface NotificationPreferences {
  pushEnabled: boolean;
}

export interface SafePushDevice {
  installationId: string;
  enabled: boolean;
  recoveryRequired: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
}

export interface NotificationSettingsResponse {
  preferences: NotificationPreferences;
  devices: SafePushDevice[];
}
