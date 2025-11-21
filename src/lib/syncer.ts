import { getGoogleSheetsClient } from './googleClient';
import { balanceTeams, Player } from './teamBalancer';
import { prisma } from './prisma';

export async function syncSessionWithSheet(sessionId: string, accessToken: string) {
    try {
        // Get session
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                teams: {
                    include: {
                        players: true,
                    },
                },
            },
        });

        if (!session) {
            throw new Error('Session not found');
        }

        // Fetch data from Google Sheet
        const sheets = await getGoogleSheetsClient(accessToken);
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: session.sheetId,
            range: 'A:Z',
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) {
            throw new Error('No data found in sheet');
        }

        // Parse headers
        const headers = rows[0].map((h: string) => h.toLowerCase());
        const getIndex = (keyword: string) => headers.findIndex((h: string) => h.includes(keyword));

        const nameIdx = getIndex('name');
        const uuidIdx = getIndex('uuid') !== -1 ? getIndex('uuid') : getIndex('id');
        const genderIdx = getIndex('gender');
        const skillIdx = getIndex('skill') !== -1 ? getIndex('skill') : getIndex('level');
        const emailIdx = getIndex('email');
        const timeIdx = getIndex('timestamp') !== -1 ? getIndex('timestamp') : 0;

        if (nameIdx === -1 || uuidIdx === -1) {
            throw new Error("Could not find 'Name' or 'UUID' columns");
        }

        // Parse players from sheet
        const sheetPlayers: Player[] = rows.slice(1).map((row, i) => {
            const skillValue = parseInt(row[skillIdx]);
            return {
                id: row[uuidIdx] || `unknown-${i}`,
                name: row[nameIdx] || 'Unknown',
                email: row[emailIdx] || '',
                gender: (row[genderIdx] || 'Other') as any,
                skillLevel: isNaN(skillValue) ? 5 : skillValue,
                timestamp: row[timeIdx] || '',
            };
        });

        // Get existing players in DB
        const existingPlayers = await prisma.player.findMany({
            where: {
                team: {
                    sessionId: sessionId,
                },
            },
        });

        // Find new players (not in DB) - check by name+email combination
        const existingPlayerKeys = new Set(
            existingPlayers.map(p => `${p.name.toLowerCase()}_${(p.email || '').toLowerCase()}`)
        );
        const newPlayers = sheetPlayers.filter(p => {
            const playerKey = `${p.name.toLowerCase()}_${p.email.toLowerCase()}`;
            return !existingPlayerKeys.has(playerKey);
        });

        if (newPlayers.length === 0) {
            return {
                success: true,
                message: 'No new players to add',
                newPlayersCount: 0,
            };
        }

        // Balance new players into existing teams
        const teams = balanceTeams([...sheetPlayers], session.teamCount);

        // Clear existing teams and recreate
        await prisma.team.deleteMany({
            where: { sessionId: sessionId },
        });

        // Create new teams with all players
        for (const team of teams) {
            const dbTeam = await prisma.team.create({
                data: {
                    sessionId: sessionId,
                    name: team.name,
                },
            });

            for (const player of team.players) {
                await prisma.player.create({
                    data: {
                        teamId: dbTeam.id,
                        uuid: player.id,
                        name: player.name,
                        email: player.email || null,
                        gender: player.gender,
                        skillLevel: player.skillLevel,
                        timestamp: player.timestamp || null,
                    },
                });
            }
        }

        // Update lastSyncAt
        await prisma.session.update({
            where: { id: sessionId },
            data: { lastSyncAt: new Date() },
        });

        return {
            success: true,
            message: `Successfully synced ${newPlayers.length} new players`,
            newPlayersCount: newPlayers.length,
        };
    } catch (error) {
        console.error('Sync error:', error);
        throw error;
    }
}
