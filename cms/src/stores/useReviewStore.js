import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { emptySession } from '../engine/packReview';

/**
 * The change-pack inbox as the CMS sees it, and each pack's review in progress.
 * ⚠️ Its own storage key, never the workspace's: a review's decisions are not content, and an
 * entry opened in the editor to tweak is already in the workspace, so the session must survive a
 * reload to be able to put it back on Reject.
 */
export const useReviewStore = create(
    persist(
        (set, get) => ({
            /** `GET /api/change-packs`: `{ inbox, applied }`, or null before the first read. */
            listing: null,
            listingError: null,
            /** Review sessions by pack file name (`engine/packReview.js`). */
            sessions: {},

            refresh: async () => {
                try {
                    const res = await fetch('/api/change-packs');
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    set({ listing: await res.json(), listingError: null });
                } catch (err) {
                    set({ listingError: err.message });
                }
                return get().listing;
            },

            sessionFor: (file) => get().sessions[file] || emptySession(),
            setSession: (file, session) => set((s) => ({ sessions: { ...s.sessions, [file]: session } })),
            dropSession: (file) => set((s) => {
                const sessions = { ...s.sessions };
                delete sessions[file];
                return { sessions };
            }),
        }),
        {
            name: 'fantasy-guild-cms-review',
            version: 1,
            partialize: (s) => ({ sessions: s.sessions }),
        }
    )
);
