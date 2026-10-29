// When to remind about a backup. Kept in localStorage: it lives and dies with the data itself.

const LAST_BACKUP_KEY = "offerhive:last-backup";
const SNOOZED_KEY = "offerhive:backup-snoozed";

export const BACKUP_INTERVAL_DAYS = 7;
const INTERVAL_MS = BACKUP_INTERVAL_DAYS * 86_400_000;

function read(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked: the reminder simply shows again later.
  }
}

/** A full export happened: the data is backed up as of now. */
export function markBackedUp(now = Date.now()) {
  write(LAST_BACKUP_KEY, now);
}

/** "Later": don't remind for another interval. */
export function snoozeBackupReminder(now = Date.now()) {
  write(SNOOZED_KEY, now);
}

/**
 * Due a week after the last backup, or a week after the oldest application if there was none,
 * unless snoozed within the last week.
 */
export function isBackupDue(oldestCreatedAt: string | null, now = Date.now()) {
  if (!oldestCreatedAt) return false;
  const since = Math.max(read(LAST_BACKUP_KEY) ?? Date.parse(oldestCreatedAt), read(SNOOZED_KEY) ?? 0);
  return now - since >= INTERVAL_MS;
}
