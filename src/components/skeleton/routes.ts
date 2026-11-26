/**
 * The loading screens by name (item 4j). A plain module, not 'use client', so
 * the server preview route can read the list (a value exported from a client
 * module reaches the server only as a reference).
 */
export const SKELETON_ROUTES = ['home', 'subjects', 'subject', 'ask', 'settings'] as const;
export type SkeletonRoute = (typeof SKELETON_ROUTES)[number];
