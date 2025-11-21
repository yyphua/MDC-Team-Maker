import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSessions } from "@/lib/roles";
import { NextResponse } from "next/server";

// PATCH: Update team assignments
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, role: true },
    });

    if (!user || !canManageSessions(user.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { id: sessionId } = await params;
        const { updates } = await req.json();

        if (!Array.isArray(updates)) {
            return new NextResponse("Invalid updates format", { status: 400 });
        }

        // Update each player's team assignment and status
        for (const update of updates) {
            await prisma.player.update({
                where: { id: update.playerId },
                data: {
                    teamId: update.teamId,
                    status: update.status || 'ACTIVE',
                },
            });
        }

        return NextResponse.json({ success: true, message: "Teams updated successfully" });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to update teams";
        return new NextResponse(message, { status: 500 });
    }
}
