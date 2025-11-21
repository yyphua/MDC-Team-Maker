export const ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    COMMITTEE: 'COMMITTEE',
    USER: 'USER',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export function isSuperAdmin(email: string): boolean {
    return email === process.env.SUPER_ADMIN_EMAIL;
}

export function isCommitteeOrAbove(role: string): boolean {
    return role === ROLES.SUPER_ADMIN || role === ROLES.COMMITTEE;
}

export function canManageUsers(role: string): boolean {
    return role === ROLES.SUPER_ADMIN;
}

export function canManageSessions(role: string): boolean {
    return isCommitteeOrAbove(role);
}

export function canEditTeams(role: string): boolean {
    return isCommitteeOrAbove(role);
}
