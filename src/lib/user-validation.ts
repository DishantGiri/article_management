/**
 * User validation utilities.
 * Validates names, emails, and profile inputs to prevent symbols, special characters (e.g. @#$%&), and corrupt data.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a user's full/display name.
 * Disallows numbers, symbols, and special characters (like @, #, $, %, &, *, etc.).
 * Allows Unicode alphabetical letters (international), spaces, hyphens (-), apostrophes ('), and periods (.).
 */
export function validateUserName(name: unknown): ValidationResult {
  if (name === null || name === undefined || typeof name !== "string") {
    return { isValid: false, error: "Full name is required." };
  }

  const trimmed = name.trim();

  if (!trimmed) {
    return { isValid: false, error: "Full name is required." };
  }

  if (trimmed.length < 2) {
    return { isValid: false, error: "Name must be at least 2 characters long." };
  }

  if (trimmed.length > 70) {
    return { isValid: false, error: "Name cannot exceed 70 characters." };
  }

  // Check for disallowed characters (only letters, spaces, hyphens, apostrophes, and periods allowed)
  const validNameRegex = /^[\p{L}\s.'-]+$/u;
  if (!validNameRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Name cannot contain numbers, symbols, or special characters (such as @, #, $, %, &).",
    };
  }

  // Ensure there are at least 2 actual letters (prevents strings like ".-" or "---")
  const lettersOnly = trimmed.replace(/[^\p{L}]/gu, "");
  if (lettersOnly.length < 2) {
    return {
      isValid: false,
      error: "Name must contain at least 2 alphabetical letters.",
    };
  }

  // Prevent consecutive special punctuation like ".." or "--"
  if (/([.'-])\1+/.test(trimmed)) {
    return {
      isValid: false,
      error: "Name cannot contain consecutive punctuation marks.",
    };
  }

  return { isValid: true };
}

/**
 * Strips out disallowed symbols and normalizes whitespace in names.
 */
export function sanitizeUserName(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name
    .replace(/[^\p{L}\s.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Real-time input filter for name fields.
 * Strips disallowed symbols and numbers as the user types or pastes,
 * preserving only letters, spaces, hyphens (-), apostrophes ('), and periods (.).
 */
export function filterNameInput(value: string): string {
  if (!value || typeof value !== "string") return "";
  return value.replace(/[^\p{L}\s.'-]/gu, "");
}

/**
 * Real-time keydown handler that prevents typing special characters or numbers directly into name inputs.
 */
export function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
  // Allow navigation, deletion, and keyboard shortcuts
  if (
    e.key === "Backspace" ||
    e.key === "Delete" ||
    e.key === "ArrowLeft" ||
    e.key === "ArrowRight" ||
    e.key === "ArrowUp" ||
    e.key === "ArrowDown" ||
    e.key === "Tab" ||
    e.key === "Enter" ||
    e.key === "Escape" ||
    e.key === "Home" ||
    e.key === "End" ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  ) {
    return;
  }

  // Check single character keystrokes
  if (e.key.length === 1) {
    const isAllowed = /^[\p{L}\s.'-]$/u.test(e.key);
    if (!isAllowed) {
      e.preventDefault();
    }
  }
}
