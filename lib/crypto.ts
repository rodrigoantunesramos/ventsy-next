// ⚠️ SERVER-ONLY. Criptografia em repouso de segredos (ex.: senha de portal de
// documentos). AES-256-GCM com chave em DOCS_ENC_KEY (env, fora do banco) —
// assim um dump do banco não revela as senhas. NUNCA importar em 'use client'.

import crypto from 'node:crypto';

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.DOCS_ENC_KEY;
  if (!raw) throw new Error('DOCS_ENC_KEY ausente no ambiente.');
  // Aceita base64 (44 chars) ou hex (64 chars) → 32 bytes.
  const buf = raw.length === 64 && /^[0-9a-f]+$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('DOCS_ENC_KEY deve representar 32 bytes (256 bits).');
  return buf;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function decryptSecret(payload: string | null | undefined): string {
  if (payload == null) return '';
  // Compatibilidade: dados legados em texto puro (sem prefixo) voltam como estão.
  if (!isEncrypted(payload)) return payload;
  const parts = payload.split(':'); // ['enc','v1',iv,tag,ct]
  if (parts.length !== 5) throw new Error('Formato de segredo inválido.');
  const [, , ivB, tagB, ctB] = parts;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
}
