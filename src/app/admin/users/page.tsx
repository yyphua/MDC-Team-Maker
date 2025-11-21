'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface User {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
}

export default function AdminUsersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('COMMITTEE');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        } else if (status === 'authenticated') {
            fetchUsers();
        }
    }, [status, router]);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (!res.ok) {
                if (res.status === 403) {
                    router.push('/');
                    return;
                }
                throw new Error('Failed to fetch users');
            }
            const data = await res.json();
            setUsers(data.users);
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (!newUserEmail) {
            setMessage({ type: 'error', text: 'Email is required' });
            return;
        }

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newUserEmail,
                    role: newUserRole,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to add user');
            }

            setMessage({ type: 'success', text: 'User added successfully' });
            setNewUserEmail('');
            setShowAddModal(false);
            fetchUsers();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    const handleRemoveAccess = async (userId: string, userEmail: string) => {
        if (!confirm(`Remove admin/committee access for ${userEmail}?`)) {
            return;
        }

        setMessage(null);

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    role: 'USER',
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to update user');
            }

            setMessage({ type: 'success', text: 'Access removed successfully' });
            fetchUsers();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    const adminUsers = users.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'COMMITTEE');

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
                            <p className="text-gray-600">Manage admin and committee access</p>
                        </div>
                        <button
                            onClick={() => router.push('/')}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition"
                        >
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {message && (
                    <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Add User Button */}
                <div className="mb-6">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition shadow-md"
                    >
                        + Add Admin/Committee User
                    </button>
                </div>

                {/* Users List */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-gray-900">Admin & Committee Users</h2>
                        <p className="text-sm text-gray-600 mt-1">{adminUsers.length} users with elevated access</p>
                    </div>

                    {adminUsers.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            No admin or committee users found
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {adminUsers.map((user) => (
                                <div key={user.id} className="p-6 hover:bg-gray-50 transition">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {user.name || user.email}
                                                </h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.role === 'SUPER_ADMIN'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                    {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Committee'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Added: {new Date(user.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>

                                        {user.role !== 'SUPER_ADMIN' && (
                                            <button
                                                onClick={() => handleRemoveAccess(user.id, user.email)}
                                                className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                title="Remove access"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Add User</h2>
                        <form onSubmit={handleAddUser}>
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="user@example.com"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    User must sign in at least once before you can assign a role
                                </p>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Role
                                </label>
                                <select
                                    value={newUserRole}
                                    onChange={(e) => setNewUserRole(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    <option value="COMMITTEE">Committee</option>
                                    <option value="SUPER_ADMIN">Super Admin</option>
                                </select>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setNewUserEmail('');
                                        setMessage(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                                >
                                    Add User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
