/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSessions } from "@/lib/roles";
import { syncSessionWithSheet } from "@/lib/syncer";
import { NextResponse } from "next/server";

// POST: Sync session with Google Sheet
export async function POST(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email || !session.accessToken) {
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
        const result = await syncSessionWithSheet(params.id, session.accessToken);
        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to sync session";
        return new NextResponse(message, { status: 500 });
    }
}
