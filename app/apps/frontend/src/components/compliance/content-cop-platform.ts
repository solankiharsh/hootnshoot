export type ContentCopPlatform =
  | 'Instagram'
  | 'Facebook'
  | 'X'
  | 'TikTok'
  | 'LinkedIn';

/** Maps Hootnshoot integration id to Content Cop platform, or null if that network is not supported. */
export function providerIdentifierToContentCopPlatform(
  providerIdentifier: string
): ContentCopPlatform | null {
  const id = (providerIdentifier || '').toLowerCase();
  if (id === 'instagram' || id === 'instagram-standalone') return 'Instagram';
  if (id === 'facebook') return 'Facebook';
  if (id === 'x' || id === 'twitter') return 'X';
  if (id === 'tiktok') return 'TikTok';
  if (id === 'linkedin' || id === 'linkedin-page') return 'LinkedIn';
  return null;
}

/** Matches backend Content Cop channel list — integrations outside this get no scan badge / job. */
export function isContentCopProviderSupported(
  providerIdentifier: string
): boolean {
  return providerIdentifierToContentCopPlatform(providerIdentifier) !== null;
}

export function isContentCopAdminRole(
  role: string | undefined
): boolean {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}
