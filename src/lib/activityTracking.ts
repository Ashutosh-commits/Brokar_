/**
 * User Activity Tracking Service
 * Tracks viewed properties, inquiries, and other user interactions.
 * Stores activity per-user (when logged in) using a storage key that
 * includes the user id so counts/lists are specific to each account.
 */

export interface ViewedEntry {
  propertyId: string;
  viewedAt: string; // ISO timestamp
}

export interface UserActivity {
  viewed: ViewedEntry[]; // ordered by time ascending (oldest -> newest)
  inquiries: Inquiry[];
}

export interface Inquiry {
  id: string;
  propertyId: string;
  createdAt: string;
  status: 'pending' | 'contacted' | 'closed';
  message?: string;
}

const STORAGE_KEY_PREFIX = 'brokar_user_activity_';
const ANON_KEY = STORAGE_KEY_PREFIX + 'anonymous';

import { loadUser } from './auth';

/**
 * Get user activity from localStorage
 */
function getStorageKey(userId?: string | null): string {
  if (userId) return STORAGE_KEY_PREFIX + userId;
  const fromAuth = loadUser();
  if (fromAuth && fromAuth.id) return STORAGE_KEY_PREFIX + fromAuth.id;
  return ANON_KEY;
}

/**
 * Get user activity from localStorage for the provided userId (or current user)
 */
export function getUserActivity(userId?: string | null): UserActivity {
  if (typeof localStorage === 'undefined') {
    return { viewed: [], inquiries: [] };
  }

  try {
    const key = getStorageKey(userId);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : { viewed: [], inquiries: [] };
  } catch {
    return { viewed: [], inquiries: [] };
  }
}

/**
 * Save user activity to localStorage
 */
export function saveUserActivity(activity: UserActivity, userId?: string | null): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(activity));
  } catch (e) {
    console.error('Failed to save user activity:', e);
  }
}

/**
 * Track a property view
 */
export function trackPropertyView(propertyId: string): void {
  const user = loadUser();
  const activity = getUserActivity(user?.id);

  // Append viewed entry (we keep duplicates removed but update timestamp to keep ordering)
  const existingIndex = activity.viewed.findIndex((v) => v.propertyId === propertyId);
  const entry: ViewedEntry = { propertyId, viewedAt: new Date().toISOString() };

  if (existingIndex >= 0) {
    // Remove the old entry so we can push it to the end (most recent)
    activity.viewed.splice(existingIndex, 1);
  }
  activity.viewed.push(entry);
  // Trim to a reasonable size to avoid unbounded growth
  if (activity.viewed.length > 500) activity.viewed.splice(0, activity.viewed.length - 500);
  saveUserActivity(activity, user?.id);
}

/**
 * Create or update an inquiry
 */
export function createInquiry(propertyId: string, message?: string): Inquiry {
  const user = loadUser();
  const activity = getUserActivity(user?.id);

  const inquiry: Inquiry = {
    id: `inquiry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    propertyId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    message,
  };

  activity.inquiries.push(inquiry);
  saveUserActivity(activity, user?.id);

  return inquiry;
}

/**
 * Update an inquiry status
 */
export function updateInquiry(inquiryId: string, status: Inquiry['status']): void {
  const user = loadUser();
  const activity = getUserActivity(user?.id);

  const inquiry = activity.inquiries.find(i => i.id === inquiryId);
  if (inquiry) {
    inquiry.status = status;
    saveUserActivity(activity, user?.id);
  }
}

/**
 * Get active inquiries (not closed)
 */
export function getActiveInquiries(): Inquiry[] {
  const user = loadUser();
  const activity = getUserActivity(user?.id);
  return activity.inquiries.filter(i => i.status !== 'closed');
}

/**
 * Get viewed properties count
 */
export function getViewedPropertiesCount(): number {
  const user = loadUser();
  const activity = getUserActivity(user?.id);
  return activity.viewed.length;
}

/**
 * Return viewed property entries in reverse-chronological order (most recent first)
 */
export function getViewedProperties(): ViewedEntry[] {
  const user = loadUser();
  const activity = getUserActivity(user?.id);
  return [...activity.viewed].reverse();
}

/**
 * Clear all user activity
 */
export function clearUserActivity(): void {
  const user = loadUser();
  const key = getStorageKey(user?.id);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
}
