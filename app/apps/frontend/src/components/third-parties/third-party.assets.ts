export function thirdPartyIconSrc(identifier: string): string {
  if (identifier === 'aurora') {
    return '/icons/third-party/Aurora.jpeg';
  }
  return `/icons/third-party/${identifier}.png`;
}
