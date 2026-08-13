import { randomInt } from 'crypto';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)

export function generateLicenseKey(prefix = 'LIC') {
  let out = prefix + '-';
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      out += CHARS[randomInt(0, CHARS.length)];
    }
    if (i < 2) out += '-';
  }
  return out;
}
