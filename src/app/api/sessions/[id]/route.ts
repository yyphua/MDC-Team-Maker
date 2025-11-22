/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSessions } from "@/lib/roles";
import { NextResponse } from "next/server";

// GET: Get specific session
export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
    const session = await getServerSession(authOptions);

    // Allow public access for viewing session details
    // if (!session || !session.user?.email) {
    //     return new NextResponse("Unauthorized", { status: 401 });
    // }

    try {
        const gameSession = await prisma.session.findUnique({
            where: { id: params.id },
            include: {
                teams: {
                    include: {
                        players: true,
                    },
                },
                players: {
                    where: {
                        teamId: null
                    }
                }
            },
        });

        if (!gameSession) {
            return new NextResponse("Session not found", { status: 404 });
        }

        return NextResponse.json({ session: gameSession });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to fetch session";
        return new NextResponse(message, { status: 500 });
    }
}

// DELETE: Delete session (Committee and above)
export async function DELETE(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
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
        await prisma.session.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to delete session";
        return new NextResponse(message, { status: 500 });
    }
}

// PATCH: Update session
export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
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

        const updateData: any = {};
        if (name) updateData.name = name;
        if (sheetUrl) {
            const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (!match) {
                return new NextResponse("Invalid Sheet URL", { status: 400 });
            }
            updateData.sheetUrl = sheetUrl;
            updateData.sheetId = match[1];
        }
        if (teamCount) updateData.teamCount = teamCount;
        if (folderId !== undefined) updateData.folderId = folderId || null;

        const updatedSession = await prisma.session.update({
            where: { id: params.id },
            data: updateData,
        });

        return NextResponse.json({ session: updatedSession });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to update session";
        return new NextResponse(message, { status: 500 });
    }
}
