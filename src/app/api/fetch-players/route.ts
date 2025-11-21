/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession, Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGoogleSheetsClient } from "@/lib/googleClient";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions) as Session | null;
    if (!session || !session.accessToken) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { sheetUrl } = await req.json();

    // Extract Spreadsheet ID from URL
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
        return new NextResponse("Invalid Sheet URL", { status: 400 });
    }
    const spreadsheetId = match[1];

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sheets = await getGoogleSheetsClient(session.accessToken as any);

        // Assume data is in the first sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'A:Z', // Read all columns
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
            return new NextResponse("No data found", { status: 404 });
        }

        // Assume headers are in the first row
        const headers = rows[0].map((h: string) => h.toLowerCase());

        // Map rows to Player objects
        const getIndex = (keyword: string) => headers.findIndex((h: string) => h.includes(keyword));

        const nameIdx = getIndex('name');
        const uuidIdx = getIndex('uuid') !== -1 ? getIndex('uuid') : getIndex('id');
        const genderIdx = getIndex('gender');
        const skillIdx = getIndex('skill') !== -1 ? getIndex('skill') : getIndex('level');
        const timeIdx = getIndex('timestamp') !== -1 ? getIndex('timestamp') : 0;

        if (nameIdx === -1 || uuidIdx === -1) {
            return new NextResponse("Could not find 'Name' or 'UUID' columns", { status: 400 });
        }

        const players = rows.slice(1).map((row, i) => ({
            id: row[uuidIdx] || `unknown-${i}`,
            name: row[nameIdx] || 'Unknown',
            email: '',
            gender: (row[genderIdx] || 'Other') as any,
            skillLevel: parseInt(row[skillIdx] || '5'),
            timestamp: row[timeIdx] || '',
        }));

        return NextResponse.json({ players });

    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to fetch sheet";
        return new NextResponse(message, { status: 500 });
    }
}
