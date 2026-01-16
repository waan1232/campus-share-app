// Profanity/Blacklist filter for CampusShare
const BANNED_WORDS = [
  "badword1", // Replace with real banned words
  "badword2",
  "scam",
  "illegal",
  "weapon",
  "drugs",
  "violence"
];

export function containsBannedWords(text: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return BANNED_WORDS.some(word => lowerText.includes(word.toLowerCase()));
}

export function filterText(text: string): string {
  if (!text) return "";
  let filtered = text;
  BANNED_WORDS.forEach(word => {
    const regex = new RegExp(word, "gi");
    filtered = filtered.replace(regex, "***");
  });
  return filtered;
}
