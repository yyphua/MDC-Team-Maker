/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSwapConfirmationEmail } from "@/lib/email";
import { NextResponse } from "next/server";

// POST: Approve or reject swap request
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { token, approve } = await req.json();

        if (!token || approve === undefined) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Find swap request
        const swapRequest = await prisma.swapRequest.findUnique({
            where: { token },
            include: {
                requester: true,
                target: true,
                requesterPlayer: {
                    include: { team: true },
                },
                targetPlayer: {
                    include: { team: true },
                },
            },
        });

        if (!swapRequest) {
            return new NextResponse("Swap request not found", { status: 404 });
        }

        // Verify user is the target
        if (swapRequest.targetId !== session.user.id) {
            return new NextResponse("You are not authorized to respond to this request", { status: 403 });
        }

        // Check if expired
        if (new Date() > swapRequest.expiresAt) {
            await prisma.swapRequest.update({
                where: { id: swapRequest.id },
                data: { status: 'CANCELLED' },
            });
            return new NextResponse("Swap request has expired", { status: 400 });
        }

        // Check if already processed
        if (swapRequest.status !== 'PENDING') {
            return new NextResponse("Swap request already processed", { status: 400 });
        }

        if (approve) {
            // Swap the teams
            const requesterTeamId = swapRequest.requesterPlayer.teamId;
            const targetTeamId = swapRequest.targetPlayer.teamId;

            await prisma.$transaction([
                prisma.player.update({
                    where: { id: swapRequest.requesterPlayerId },
                    data: { teamId: targetTeamId },
                }),
                prisma.player.update({
                    where: { id: swapRequest.targetPlayerId },
                    data: { teamId: requesterTeamId },
                }),
                prisma.swapRequest.update({
                    where: { id: swapRequest.id },
                    data: { status: 'APPROVED' },
                }),
            ]);

            // Send confirmation email
            await sendSwapConfirmationEmail({
                requesterName: swapRequest.requesterPlayer.name,
                requesterEmail: swapRequest.requester.email,
                targetName: swapRequest.targetPlayer.name,
                targetEmail: swapRequest.target.email,
                requesterTeam: swapRequest.requesterPlayer.team.name,
                targetTeam: swapRequest.targetPlayer.team.name,
                verifyUrl: '',
                approved: true,
            });

            return NextResponse.json({
                success: true,
                message: 'Swap approved and completed',
            });
        } else {
            // Reject the swap
            await prisma.swapRequest.update({
                where: { id: swapRequest.id },
                data: { status: 'REJECTED' },
            });

            // Send rejection email
            await sendSwapConfirmationEmail({
                requesterName: swapRequest.requesterPlayer.name,
                requesterEmail: swapRequest.requester.email,
                targetName: swapRequest.targetPlayer.name,
                targetEmail: swapRequest.target.email,
                requesterTeam: swapRequest.requesterPlayer.team.name,
                targetTeam: swapRequest.targetPlayer.team.name,
                verifyUrl: '',
                approved: false,
            });

            return NextResponse.json({
                success: true,
                message: 'Swap rejected',
            });
        }
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to process swap request";
        return new NextResponse(message, { status: 500 });
    }
}

// GET: Verify token and get swap details
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
        return new NextResponse("Missing token", { status: 400 });
    }

    try {
        const swapRequest = await prisma.swapRequest.findUnique({
            where: { token },
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
        });

        if (!swapRequest) {
            return new NextResponse("Swap request not found", { status: 404 });
        }

        return NextResponse.json({ swapRequest });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to fetch swap request";
        return new NextResponse(message, { status: 500 });
    }
}
