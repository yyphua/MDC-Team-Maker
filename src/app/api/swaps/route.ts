/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSwapRequestEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// POST: Create swap request
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email || !session.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { requesterPlayerId, targetPlayerId } = await req.json();

        if (!requesterPlayerId || !targetPlayerId) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Get both players
        const requesterPlayer = await prisma.player.findUnique({
            where: { id: requesterPlayerId },
            include: { team: true },
        });

        const targetPlayer = await prisma.player.findUnique({
            where: { id: targetPlayerId },
            include: { team: true },
        });

        if (!requesterPlayer || !targetPlayer) {
            return new NextResponse("Player not found", { status: 404 });
        }

        // Verify requester owns the player
        if (requesterPlayer.email !== session.user.email) {
            return new NextResponse("You can only request swaps for your own player", { status: 403 });
        }

        if (!targetPlayer.email) {
            return new NextResponse("Target player has no email", { status: 400 });
        }

        // Get target user
        const targetUser = await prisma.user.findUnique({
            where: { email: targetPlayer.email },
        });

        if (!targetUser) {
            return new NextResponse("Target user not found", { status: 404 });
        }

        // Generate unique token
        const token = randomBytes(32).toString('hex');

        // Create swap request
        const swapRequest = await prisma.swapRequest.create({
            data: {
                requesterId: session.user.id,
                requesterPlayerId,
                targetId: targetUser.id,
                targetPlayerId,
                token,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        // Send email
        const verifyUrl = `${process.env.NEXTAUTH_URL}/swap/verify?token=${token}`;
        await sendSwapRequestEmail({
            requesterName: requesterPlayer.name,
            requesterEmail: session.user.email,
            targetName: targetPlayer.name,
            targetEmail: targetPlayer.email,
            requesterTeam: requesterPlayer.team.name,
            targetTeam: targetPlayer.team.name,
            verifyUrl,
        });

        return NextResponse.json({
            success: true,
            swapRequest: {
                id: swapRequest.id,
                status: swapRequest.status,
            },
        });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to create swap request";
        return new NextResponse(message, { status: 500 });
    }
}

// GET: Get swap requests for current user
export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const swapRequests = await prisma.swapRequest.findMany({
            where: {
                OR: [
                    { requesterId: session.user.id },
                    { targetId: session.user.id },
                ],
            },
            include: {
                requester: {
                    select: { email: true, name: true },
                },
                target: {
                    select: { email: true, name: true },
                },
                requesterPlayer: {
                    include: { team: true },
                },
                targetPlayer: {
                    include: { team: true },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json({ swapRequests });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to fetch swap requests";
        return new NextResponse(message, { status: 500 });
    }
}
