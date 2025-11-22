/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSessions } from "@/lib/roles";
import { NextResponse } from "next/server";
import { syncSessionWithSheet } from "@/lib/syncer";

// GET: List all sessions (available to all authenticated users)
export async function GET() {
    const session = await getServerSession(authOptions);

    // Allow public access for viewing sessions
    // if (!session || !session.user?.email) {
    //     return new NextResponse("Unauthorized", { status: 401 });
    // }

    // All authenticated users can view sessions
    try {
        const sessions = await prisma.session.findMany({
            include: {
                teams: {
                    include: {
                        players: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json({ sessions });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to fetch sessions";
        return new NextResponse(message, { status: 500 });
    }
}

// POST: Create a new session
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true },
    });

    if (!user || !canManageSessions(user.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { name, sheetUrl, teamCount, folderId } = await req.json();

        if (!name || !sheetUrl || !teamCount) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Extract spreadsheet ID from URL
        const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
            return new NextResponse("Invalid Sheet URL", { status: 400 });
        }
        const sheetId = match[1];

        // Create session first
        const newSession = await prisma.session.create({
            data: {
                name,
                sheetUrl,
                sheetId,
                teamCount,
                folderId: folderId || null,
            },
        });

        // Auto-sync players from sheet and balance teams
        const accessToken = (session as any).accessToken;
        console.log("Debug: Session Access Token present:", !!accessToken);
        if (accessToken) {
            console.log("Debug: Token start:", accessToken.substring(0, 10));
            try {
                await syncSessionWithSheet(newSession.id, accessToken);
            } catch (syncError) {
                console.error('Auto-sync failed:', syncError);
                // Session is created but sync failed - user can manually sync later
            }
        }

        return NextResponse.json({ session: newSession });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to create session";
        return new NextResponse(message, { status: 500 });
    }
}
