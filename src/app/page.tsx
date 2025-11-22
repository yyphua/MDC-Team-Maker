'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { LogOut, Users, Calendar, RefreshCw, ArrowRightLeft, Plus, Trash2, Share2 } from 'lucide-react';
import { canManageSessions, canManageUsers, ROLES } from '@/lib/roles';
import CreateSessionModal from '@/components/CreateSessionModal';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    if (session || isGuest) {
      fetchSessions();
    }
  }, [session, isGuest]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    }
  };

  const handleSync = async (sessionId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/sync`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Sync failed');
      const data = await res.json();
      setMessage({ type: 'success', text: data.message });
      await fetchSessions();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sessionId: string, sessionName: string) => {
    if (!confirm(`Are you sure you want to delete "${sessionName}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setMessage({ type: 'success', text: 'Session deleted successfully' });
      await fetchSessions();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (sessionId: string) => {
    const url = `${window.location.origin}/sessions/${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ type: 'success', text: 'Session link copied to clipboard!' });
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to copy link' });
    }
  };

  const handleSwapRequest = async (requesterPlayerId: string, targetPlayerId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterPlayerId, targetPlayerId }),
      });
      if (!res.ok) throw new Error('Failed to create swap request');
      setMessage({ type: 'success', text: 'Swap request sent! Check your email.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (!session && !isGuest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full text-center">
          <div className="text-6xl mb-6">🏐</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Team Maker</h1>
          <p className="text-gray-600 mb-8">Balanced team generation for dodgeball sessions</p>
          <div className="space-y-4">
            <button
              onClick={() => signIn('google')}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg"
            >
              Sign In with Google
            </button>
            <button
              onClick={() => setIsGuest(true)}
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    );
  }

  const userRole = (session?.user as any)?.role || ROLES.USER;
  const isAdmin = session && canManageSessions(userRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Maker</h1>
              <p className="text-sm text-gray-600">
                {isGuest ? '👀 Guest Viewer' : (
                  <>
                    {userRole === ROLES.SUPER_ADMIN && '👑 Super Admin'}
                    {userRole === ROLES.COMMITTEE && '⭐ Committee'}
                    {userRole === ROLES.USER && '👤 User'}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {session && canManageUsers(userRole) && (
                <a
                  href="/admin/users"
                  className="flex items-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded-lg transition"
                >
                  <Users className="w-4 h-4" />
                  Manage Users
                </a>
              )}
              <span className="text-sm text-gray-700">{session?.user?.email || 'Guest'}</span>
              {session ? (
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => signIn('google')}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
            {message.text}
          </div>
        )}

        {/* Admin View */}
        {isAdmin ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Manage Sessions</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Create Session
                </button>
                {canManageUsers(userRole) && (
                  <a
                    href="/admin/users"
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                  >
                    <Users className="w-4 h-4" />
                    Manage Users
                  </a>
                )}
              </div>
            </div>

            <div className="grid gap-6">
              {sessions.map((session) => (
                <div key={session.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
                  {/* Clickable header area */}
                  <div
                    onClick={() => router.push(`/sessions/${session.id}`)}
                    className="p-6 cursor-pointer hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{session.name}</h3>
                        <p className="text-sm text-gray-600">
                          {session.teams.length} teams • Last synced: {
                            session.lastSyncAt
                              ? new Date(session.lastSyncAt).toLocaleString()
                              : 'Never'
                          }
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {session.teams.map((team: any) => (
                        <div key={team.id} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 mb-2">{team.name}</h4>
                          <p className="text-sm text-gray-600 mb-2">{team.players.length} players</p>
                          <ul className="text-sm space-y-1">
                            {team.players.slice(0, 3).map((player: any) => (
                              <li key={player.id} className="text-gray-700">• {player.name}</li>
                            ))}
                            {team.players.length > 3 && (
                              <li className="text-gray-500">+ {team.players.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons - not clickable for navigation */}
                  <div className="px-6 pb-6 flex gap-3 border-t border-gray-200 pt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(session.id);
                      }}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSync(session.id);
                      }}
                      disabled={loading}
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      Sync
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(session.id, session.name);
                      }}
                      disabled={loading}
                      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* User View */
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Teams</h2>

            {sessions.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No sessions available yet.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {sessions.map((session) => {
                  const userTeam = session.teams.find((team: any) =>
                    team.players.some((p: any) => p.email === session.user?.email)
                  );

                  return (
                    <div
                      key={session.id}
                      onClick={() => router.push(`/sessions/${session.id}`)}
                      className="bg-white rounded-xl shadow-md p-6 cursor-pointer hover:shadow-lg transition"
                    >
                      <h3 className="text-xl font-bold text-gray-900 mb-4">{session.name}</h3>

                      {userTeam && (
                        <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">You are on:</p>
                          <p className="text-lg font-semibold text-indigo-600">{userTeam.name}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {session.teams.map((team: any) => (
                          <div
                            key={team.id}
                            className={`rounded-lg p-4 ${team.id === userTeam?.id
                              ? 'bg-gradient-to-br from-indigo-100 to-purple-100 border-2 border-indigo-300'
                              : 'bg-gray-50'
                              }`}
                          >
                            <h4 className="font-semibold text-gray-900 mb-2">{team.name}</h4>
                            <ul className="text-sm space-y-1">
                              {team.players.map((player: any) => (
                                <li key={player.id} className="text-gray-700">• {player.name}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-sm text-gray-600 mb-2">
                          <ArrowRightLeft className="w-4 h-4 inline mr-1" />
                          Want to swap teams? Contact another player directly or use the swap request feature (coming soon).
                        </p>
                        <p className="text-xs text-indigo-600 font-medium mt-3">
                          👁️ Click anywhere to view full session details
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(sessionId) => {
          setShowCreateModal(false);
          router.push(`/sessions/${sessionId}`);
        }}
      />
    </div>
  );
}
