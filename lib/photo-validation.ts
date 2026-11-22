export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function imageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export function photoMetadata(data: { get(name: string): unknown }) {
  const caption = String(data.get('caption') ?? '').trim();
  const people = String(data.get('people') ?? '').trim();
  const publicationConsent = data.get('publicationConsent') === 'true';
  if (!caption || caption.length > 300 || !people || people.length > 500) {
    throw Error('Indica uma legenda (até 300 caracteres) e quem aparece na fotografia (até 500 caracteres).');
  }
  return { caption, people, publicationConsent };
}
