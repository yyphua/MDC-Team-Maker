/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession, Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGoogleSheetsClient, getGoogleDriveClient } from "@/lib/googleClient";
import { balanceTeams, Player } from "@/lib/teamBalancer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions) as Session | null;
    if (!session || !session.accessToken) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { players, teamCount, folderId } = await req.json();

    if (!players || !teamCount) {
        return new NextResponse("Missing required fields", { status: 400 });
    }

    try {
        // 1. Balance Teams
        const teams = balanceTeams(players as Player[], teamCount);

        // 2. Create new Sheet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sheets = await getGoogleSheetsClient(session.accessToken as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const drive = await getGoogleDriveClient(session.accessToken as any);

        const resource = {
            properties: {
                title: `Generated Teams - ${new Date().toISOString().split('T')[0]}`,
            },
        };

        const spreadsheet = await sheets.spreadsheets.create({
            requestBody: resource,
            fields: 'spreadsheetId',
        });

        const spreadsheetId = spreadsheet.data.spreadsheetId;

        if (!spreadsheetId) {
            throw new Error("Failed to create spreadsheet");
        }

        // 3. Move to target folder (if provided)
        if (folderId) {
            const file = await drive.files.get({
                fileId: spreadsheetId,
                fields: 'parents',
            });

            const previousParents = file.data.parents?.join(',') || '';

            await drive.files.update({
                fileId: spreadsheetId,
                addParents: folderId,
                removeParents: previousParents,
                fields: 'id, parents',
            });
        }

        // 4. Write Data
        const values: string[][] = [];

        // Header
        values.push(['Team', 'Player Name', 'Gender', 'Skill Level']);

        teams.forEach(team => {
            team.players.forEach(p => {
                values.push([team.name, p.name, p.gender, p.skillLevel.toString()]);
            });
            values.push(['', '', '', '']);
        });

        // Add Stats
        values.push(['Stats', '', '', '']);
        teams.forEach(team => {
            values.push([
                team.name,
                `Avg Skill: ${team.stats.averageSkill.toFixed(2)}`,
                `Male Ratio: ${(team.stats.genderRatio * 100).toFixed(0)}%`,
                `Count: ${team.stats.totalPlayers}`
            ]);
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A1',
            valueInputOption: 'RAW',
            requestBody: {
                values,
            },
        });

        return NextResponse.json({
            success: true,
            spreadsheetId,
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
        });

    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to generate teams";
        return new NextResponse(message, { status: 500 });
    }
}
