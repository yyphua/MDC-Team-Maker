'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface CreateSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (sessionId: string) => void;
}

export default function CreateSessionModal({ isOpen, onClose, onSuccess }: CreateSessionModalProps) {
    const [name, setName] = useState('');
    const [sheetUrl, setSheetUrl] = useState('');
    const [teamCount, setTeamCount] = useState(2);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name || `Session ${new Date().toLocaleDateString()}`,
                    sheetUrl,
                    teamCount,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to create session');
            }

            const data = await res.json();
            onSuccess(data.session.id);

            // Reset form
            setName('');
            setSheetUrl('');
            setTeamCount(2);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Create New Session</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Session Name (Optional)
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="e.g., Week 1 Teams"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Google Sheet URL *
                        </label>
                        <input
                            type="url"
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Sheet must have columns: UUID, Name, Email, Gender, Skill Level
                        </p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Number of Teams *
                        </label>
                        <input
                            type="number"
                            value={teamCount}
                            onChange={(e) => setTeamCount(parseInt(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            min={2}
                            max={10}
                            required
                        />
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Session'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
