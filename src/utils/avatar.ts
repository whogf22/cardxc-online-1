/**
 * Returns a DiceBear lorelei cartoon avatar URL for the given seed.
 * Same seed always produces the same avatar.
 */
export function getCartoonAvatarUrl(seed: string, size = 96): string {
  const params = new URLSearchParams({
    seed: seed || 'default',
    backgroundColor: 'fde047',
    size: String(size),
  });
  return `https://api.dicebear.com/9.x/lorelei/svg?${params}`;
}
