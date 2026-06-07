import { Injectable } from '@nestjs/common';

/** Google Workspace provider layer — Calendar, Drive, Docs (Stage 8 architecture stub). */
@Injectable()
export class GoogleAdapter {
  readonly scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
  ];

  getOAuthUrl(settings: Record<string, unknown>, redirectUri: string): string {
    const clientId = String(settings.clientId ?? process.env.GOOGLE_CLIENT_ID ?? '');
    const scope = encodeURIComponent(this.scopes.join(' '));
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline`;
  }

  listCapabilities() {
    return [
      { service: 'calendar', actions: ['listEvents', 'createEvent'] },
      { service: 'drive', actions: ['listFiles', 'downloadFile'] },
      { service: 'docs', actions: ['exportDocument'] },
    ];
  }
}
