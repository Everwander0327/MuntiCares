// Simple client-side SHA-256 hashing utility for passwords.
// NOTE: Client-side hashing is not a substitute for server-side salted hashing (bcrypt/argon2).
// This is an interim measure to avoid storing plaintext passwords in the DB.
export async function sha256Hex(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
