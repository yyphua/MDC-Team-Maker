'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';

function SwapVerifyContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const { data: session, status } = useSession();

    const [swapRequest, setSwapRequest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (token && status !== 'loading') {
            fetchSwapRequest();
        }
    }, [token, status]);

    const fetchSwapRequest = async () => {
        try {
            const res = await fetch(`/api/swaps/verify?token=${token}`);
            if (!res.ok) {
                throw new Error('Swap request not found or expired');
            }
            const data = await res.json();
            setSwapRequest(data.swapRequest);
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleResponse = async (approve: boolean) => {
        if (!session) {
            signIn('google');
            return;
        }

        setProcessing(true);
        setMessage(null);

        try {
            const res = await fetch('/api/swaps/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, approve }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Failed to process request');
            }

            const data = await res.json();
            setMessage({ type: 'success', text: data.message });

            await fetchSwapRequest();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading swap request...</p>
                </div>
            </div>
        );
    }

    if (!swapRequest) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Request</h1>
                    <p className="text-gray-600">{message?.text || 'Swap request not found or has expired.'}</p>
                </div>
            </div>
        );
    }

    const isExpired = new Date() > new Date(swapRequest.expiresAt);
    const isProcessed = swapRequest.status !== 'PENDING';

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
                <div className="text-center mb-8">
                    <div className="text-5xl mb-4">🔄</div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Swap Request</h1>
                    <p className="text-gray-600">Review the details below</p>
                </div>

                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">From</p>
                            <p className="font-semibold text-gray-900">{swapRequest.requesterPlayer.name}</p>
                            <p className="text-sm text-indigo-600">{swapRequest.requesterPlayer.team?.name || 'No Team'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 mb-1">To</p>
                            <p className="font-semibold text-gray-900">{swapRequest.targetPlayer.name}</p>
                            <p className="text-sm text-purple-600">{swapRequest.targetPlayer.team?.name || 'No Team'}</p>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-sm text-gray-700">
                            <strong>{swapRequest.requesterPlayer.name}</strong> wants to swap teams with you.
                            If you accept, you will move to <strong>{swapRequest.requesterPlayer.team?.name || 'No Team'}</strong> and
                            they will move to <strong>{swapRequest.targetPlayer.team?.name || 'No Team'}</strong>.
                        </p>
                    </div>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                        }`}>
                        {message.text}
                    </div>
                )}

                {!session && (
                    <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 rounded-lg">
                        Please sign in to respond to this request.
                    </div>
                )}

                {isExpired && (
                    <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-lg">
                        This swap request has expired.
                    </div>
                )}

                {isProcessed && (
                    <div className={`mb-6 p-4 rounded-lg ${swapRequest.status === 'APPROVED' ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-800'
                        }`}>
                        This request has been {swapRequest.status.toLowerCase()}.
                    </div>
                )}

                <div className="flex gap-4">
                    {!session ? (
                        <button
                            onClick={() => signIn('google')}
                            className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition"
                        >
                            Sign In with Google
                        </button>
                    ) : !isExpired && !isProcessed ? (
                        <>
                            <button
                                onClick={() => handleResponse(true)}
                                disabled={processing}
                                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {processing ? 'Processing...' : 'Accept Swap'}
                            </button>
                            <button
                                onClick={() => handleResponse(false)}
                                disabled={processing}
                                className="flex-1 bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
                            >
                                {processing ? 'Processing...' : 'Decline'}
                            </button>
                        </>
                    ) : (
                        <a
                            href="/"
                            className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-700 transition text-center"
                        >
                            Go to Dashboard
                        </a>
                    )}
                </div>

                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>Expires: {new Date(swapRequest.expiresAt).toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    );
}

export default function SwapVerifyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        }>
            <SwapVerifyContent />
        </Suspense>
    );
}
