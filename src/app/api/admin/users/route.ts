/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers, ROLES } from "@/lib/roles";
import { NextResponse } from "next/server";

// GET: List all users (Super Admin only)
export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true },
    });

    if (!user || !canManageUsers(user.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json({ users });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to fetch users";
        return new NextResponse(message, { status: 500 });
    }
}

// POST: Update user role (Super Admin only)
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true },
    });

    if (!currentUser || !canManageUsers(currentUser.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { userId, role } = await req.json();

        if (!userId || !role) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Validate role
        if (![ROLES.USER, ROLES.COMMITTEE, ROLES.SUPER_ADMIN].includes(role)) {
            return new NextResponse("Invalid role", { status: 400 });
        }

        // Prevent changing Super Admin's role
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!targetUser) {
            return new NextResponse("User not found", { status: 404 });
        }

        if (targetUser.role === ROLES.SUPER_ADMIN && role !== ROLES.SUPER_ADMIN) {
            return new NextResponse("Cannot change Super Admin role", { status: 403 });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
            },
        });

        return NextResponse.json({ user: updatedUser });
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to update user";
        return new NextResponse(message, { status: 500 });
    }
}
