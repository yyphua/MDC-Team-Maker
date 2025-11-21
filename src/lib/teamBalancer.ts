export interface Player {
    id: string; // UUID
    name: string;
    email: string;
    gender: 'Male' | 'Female' | 'Other';
    skillLevel: number; // 1-10 or similar
    timestamp: string;
}

export interface Team {
    name: string;
    players: Player[];
    stats: {
        totalPlayers: number;
        genderRatio: number; // Male percentage
        averageSkill: number;
    };
}

export function balanceTeams(players: Player[], teamCount: number): Team[] {
    // 1. Group by UUID
    const groups = new Map<string, Player[]>();
    players.forEach(p => {
        const group = groups.get(p.id) || [];
        group.push(p);
        groups.set(p.id, group);
    });

    const clusters = Array.from(groups.values());

    // Sort clusters by size (descending) to handle large groups first
    clusters.sort((a, b) => b.length - a.length);

    // Initialize teams
    const teams: Player[][] = Array.from({ length: teamCount }, () => []);

    // Helper to calculate team score (lower is better for adding)
    // We want to balance size first, then skill/gender
    // const getTeamScore = (team: Player[], cluster: Player[]) => {
    //     // Simple greedy: just pick the smallest team
    //     return team.length;
    // };

    // 2. Assign clusters to teams
    for (const cluster of clusters) {
        // Find the team with the fewest players
        // If tie, pick the one that balances skill/gender better (future improvement)
        // For now, simple greedy on size
        let bestTeamIndex = 0;
        let minSize = Infinity;

        for (let i = 0; i < teamCount; i++) {
            if (teams[i].length < minSize) {
                minSize = teams[i].length;
                bestTeamIndex = i;
            }
        }

        teams[bestTeamIndex].push(...cluster);
    }

    // 3. Post-processing: Try to swap single players to improve balance?
    // (Skipping for MVP, grouping constraint is hard)

    // 4. Format output
    return teams.map((teamPlayers, i) => {
        const maleCount = teamPlayers.filter(p => p.gender === 'Male').length;
        const totalSkill = teamPlayers.reduce((sum, p) => sum + p.skillLevel, 0);

        return {
            name: `Team ${i + 1}`,
            players: teamPlayers,
            stats: {
                totalPlayers: teamPlayers.length,
                genderRatio: teamPlayers.length > 0 ? maleCount / teamPlayers.length : 0,
                averageSkill: teamPlayers.length > 0 ? totalSkill / teamPlayers.length : 0,
            }
        };
    });
}
