import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export async function getGoogleSheetsClient(accessToken: string) {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });

    return google.sheets({ version: 'v4', auth });
}

export async function getGoogleDriveClient(accessToken: string) {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });

    return google.drive({ version: 'v3', auth });
}
