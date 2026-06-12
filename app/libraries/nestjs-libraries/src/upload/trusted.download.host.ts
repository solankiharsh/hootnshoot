/**
 * Hostnames under these suffixes may resolve to private IPs inside a VPC
 * (split-horizon DNS) while still being legitimate vendor CDN URLs from an
 * authenticated API. Used only for download URLs returned by trusted backends
 * (e.g. Gener8), never for raw user input.
 *
 * Set TRUSTED_DOWNLOAD_HOST_SUFFIXES to a comma-separated list of suffixes,
 * e.g. `myapi.example.com,storage.example.net`.
 */
export function isTrustedDownloadHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    process.env.GENER8_API_KEY?.trim() &&
    (h === 'supabase.co' ||
      h.endsWith('.supabase.co') ||
      h === 'supabase.in' ||
      h.endsWith('.supabase.in'))
  ) {
    return true;
  }
  const raw = process.env.TRUSTED_DOWNLOAD_HOST_SUFFIXES?.trim();
  if (!raw) {
    return false;
  }
  for (const part of raw.split(',')) {
    const s = part.trim().toLowerCase().replace(/^\.+/, '');
    if (!s) {
      continue;
    }
    if (h === s || h.endsWith(`.${s}`)) {
      return true;
    }
  }
  return false;
}
