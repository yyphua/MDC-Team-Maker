'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, useDroppable, useDraggable } from '@dnd-kit/core';
import { RefreshCw, Save, ArrowLeft, Clock } from 'lucide-react';
import { canEditTeams } from '@/lib/roles';

interface Player {
    id: string;
    uuid: string;
    name: string;
    email: string | null;
    gender: string;
    skillLevel: number;
    teamId: string | null;
    status?: string;
}

interface Team {
    id: string;
    name: string;
    players: Player[];
}

interface SessionData {
    id: string;
    name: string;
    sheetUrl: string;
    teamCount: number;
    teams: Team[];
    createdAt: string;
}

function getTimeSince(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default function SessionDetailPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const sessionId = params?.id as string;

    const [sessionData, setSessionData] = useState<SessionData | null>(null);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [activePlayer, setActivePlayer] = useState<Player | null>(null);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [canEdit, setCanEdit] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        } else if (status === 'authenticated' && sessionId) {
            fetchSessionData();
            fetchUserRole();
        }
    }, [status, sessionId, router]);

    useEffect(() => {
        if (!sessionData) return;

        const sessionAge = Date.now() - new Date(sessionData.createdAt).getTime();
        const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;
        const isOld = sessionAge > fiveDaysInMs;

        const storageKey = `autoSync_${sessionId}`;
        const savedPreference = localStorage.getItem(storageKey);

        if (savedPreference !== null) {
            setAutoSyncEnabled(savedPreference === 'true');
        } else {
            setAutoSyncEnabled(!isOld);
        }
    }, [sessionData, sessionId]);

    useEffect(() => {
        if (!sessionId || !autoSyncEnabled) return;

        const interval = setInterval(() => {
            handleAutoSync();
        }, 60000);

        return () => clearInterval(interval);
    }, [sessionId, autoSyncEnabled]);

    const fetchSessionData = async () => {
        try {
            const res = await fetch(`/api/sessions/${sessionId}`);
            if (!res.ok) throw new Error('Failed to fetch session');

            const data = await res.json();
            setSessionData(data.session);

            const players: Player[] = [];
            data.session.teams.forEach((team: Team) => {
                team.players.forEach((player: Player) => {
                    players.push({ ...player, teamId: team.id });
                });
            });
            setAllPlayers(players);
            setLastSyncTime(data.session.lastSyncAt ? new Date(data.session.lastSyncAt) : null);
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const fetchUserRole = async () => {
        try {
            const res = await fetch('/api/user/role');
            if (res.ok) {
                const data = await res.json();
                setUserRole(data.role);
                setCanEdit(canEditTeams(data.role));
            }
        } catch (error) {
            console.error('Failed to fetch user role:', error);
        }
    };

    const handleAutoSync = async () => {
        try {
            const res = await fetch(`/api/sessions/${sessionId}/sync`, { method: 'POST' });
            if (res.ok) await fetchSessionData();
        } catch (error) {
            console.error('Auto-sync failed:', error);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/sessions/${sessionId}/sync`, { method: 'POST' });
            if (!res.ok) throw new Error('Sync failed');

            const data = await res.json();
            setMessage({ type: 'success', text: data.message });
            await fetchSessionData();
            setLastSyncTime(new Date());
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setSyncing(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const updates = allPlayers.map(p => ({
                playerId: p.id,
                teamId: p.teamId,
                status: p.status || 'ACTIVE',
            }));

            const res = await fetch(`/api/sessions/${sessionId}/teams`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            });

            if (!res.ok) throw new Error('Failed to save changes');
            setMessage({ type: 'success', text: 'Changes saved successfully' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        if (!canEdit) return; // Prevent drag for non-editors
        const player = allPlayers.find(p => p.id === event.active.id);
        setActivePlayer(player || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (!canEdit) return; // Prevent drop for non-editors
        const { active, over } = event;
        setActivePlayer(null);

        if (!over) return;

        const playerId = active.id as string;
        const targetId = over.id as string;

        setAllPlayers(prev => prev.map(p => {
            if (p.id === playerId) {
                if (targetId === 'pool') {
                    return { ...p, teamId: null, status: 'ACTIVE' };
                } else if (targetId === 'waitlist') {
                    return { ...p, teamId: null, status: 'WAITLIST' };
                } else {
                    return { ...p, teamId: targetId, status: 'ACTIVE' };
                }
            }
            return p;
        }));
    };

    const toggleAutoSync = () => {
        const newValue = !autoSyncEnabled;
        setAutoSyncEnabled(newValue);
        localStorage.setItem(`autoSync_${sessionId}`, String(newValue));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading session...</p>
                </div>
            </div>
        );
    }

    if (!sessionData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600">Session not found</p>
                    <button onClick={() => router.push('/')} className="mt-4 text-indigo-600 hover:underline">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const unallocatedPlayers = allPlayers.filter(p => !p.teamId && p.status !== 'WAITLIST');
    const waitlistPlayers = allPlayers.filter(p => p.status === 'WAITLIST');
    const teams = sessionData.teams.map(team => ({
        ...team,
        players: allPlayers.filter(p => p.teamId === team.id),
    }));

    return (
        <DndContext collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg transition">
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">{sessionData.name}</h1>
                                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                                        <span>{allPlayers.length} total players</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {lastSyncTime ? <span>Last synced: {getTimeSince(lastSyncTime)}</span> : <span>Never synced</span>}
                                        </span>
                                        {autoSyncEnabled && (
                                            <>
                                                <span>•</span>
                                                <span className="text-green-600 font-medium">Auto-sync ON</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                {canEdit && (
                                    <>
                                        <button onClick={toggleAutoSync} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${autoSyncEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                            <RefreshCw className="w-4 h-4" />
                                            {autoSyncEnabled ? 'Auto-sync ON' : 'Auto-sync OFF'}
                                        </button>
                                        <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                            {syncing ? 'Syncing...' : 'Full Re-sync'}
                                        </button>
                                        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                                            <Save className="w-4 h-4" />
                                            {saving ? 'Saving...' : 'Save'}
                                        </button>
                                    </>
                                )}
                                {!canEdit && (
                                    <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg flex items-center gap-2">
                                        <span className="text-sm font-medium">👁️ View Only</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-1 space-y-6">
                            <PlayerPool players={unallocatedPlayers} />
                            <WaitingList players={waitlistPlayers} />
                        </div>
                        <div className="lg:col-span-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {teams.map(team => <TeamContainer key={team.id} team={team} />)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <DragOverlay>{activePlayer ? <PlayerCard player={activePlayer} isDragging /> : null}</DragOverlay>
        </DndContext>
    );
}

function PlayerPool({ players }: { players: Player[] }) {
    const { setNodeRef } = useDroppable({ id: 'pool' });
    return (
        <div ref={setNodeRef} className="bg-white rounded-2xl shadow-xl p-6 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Player Pool ({players.length})</h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {players.length === 0 ? <p className="text-sm text-gray-500 text-center py-8">All players allocated</p> : players.map(player => <PlayerCard key={player.id} player={player} />)}
            </div>
        </div>
    );
}

function WaitingList({ players }: { players: Player[] }) {
    const { setNodeRef } = useDroppable({ id: 'waitlist' });
    return (
        <div ref={setNodeRef} className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl shadow-xl p-6 border-2 border-orange-300 h-fit">
            <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-bold text-orange-900">Waiting List ({players.length})</h2>
            </div>
            <p className="text-xs text-orange-700 mb-3">Players waiting for team assignment</p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {players.length === 0 ? <p className="text-sm text-orange-600 text-center py-8">No players waiting</p> : players.map(player => <PlayerCard key={player.id} player={player} isWaitlist />)}
            </div>
        </div>
    );
}

function TeamContainer({ team }: { team: Team }) {
    const { setNodeRef } = useDroppable({ id: team.id });
    const avgSkill = team.players.length > 0 ? (team.players.reduce((sum, p) => sum + p.skillLevel, 0) / team.players.length).toFixed(1) : '0';
    return (
        <div ref={setNodeRef} className="bg-white rounded-2xl shadow-xl p-6">
            <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{team.name}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                    <span>{team.players.length} players</span>
                    <span>Avg Skill: {avgSkill}</span>
                </div>
            </div>
            <div className="space-y-2 min-h-[200px]">
                {team.players.map(player => <PlayerCard key={player.id} player={player} />)}
            </div>
        </div>
    );
}

function PlayerCard({ player, isDragging = false, isWaitlist = false }: { player: Player; isDragging?: boolean; isWaitlist?: boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging: isCurrentlyDragging } = useDraggable({ id: player.id });
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
    const bgColor = isWaitlist ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-300' : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200';

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`p-3 ${bgColor} rounded-lg border-2 cursor-grab active:cursor-grabbing transition ${isCurrentlyDragging ? 'opacity-50' : 'opacity-100'} ${isDragging ? 'shadow-2xl scale-105' : 'hover:shadow-md'}`}>
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{player.name}</p>
                    <p className="text-xs text-gray-600">{player.email || 'No email'}</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">{player.skillLevel}</span>
                    <span className="text-xs text-gray-500">{player.gender}</span>
                </div>
            </div>
        </div>
    );
}
