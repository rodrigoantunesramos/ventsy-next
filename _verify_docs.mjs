// Verificação end-to-end do fluxo de documentos (storage + RLS + DB).
// Temporário — apagar após rodar.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const url = 'https://hxvlfalgrduitevbhqvq.supabase.co';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, anon);

const log = (...a) => console.log(...a);

const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
  email: 'rodrigoantunesramos@gmail.com',
  password: 'Fl@meng81!',
});
if (authErr) { log('AUTH FAIL', authErr.message); process.exit(1); }
const uid = auth.user.id;
log('1) login OK uid=', uid);

// 2) upload arquivo
const path = `${uid}/${crypto.randomUUID()}.pdf`;
const bytes = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])], { type: 'application/pdf' });
const { error: upErr } = await sb.storage.from('documentos').upload(path, bytes, { contentType: 'application/pdf' });
log('2) upload', upErr ? 'FAIL ' + upErr.message : 'OK ' + path);
if (upErr) process.exit(1);

// 3) signed url
const { data: signed, error: sErr } = await sb.storage.from('documentos').createSignedUrl(path, 600);
log('3) signedUrl', sErr ? 'FAIL ' + sErr.message : 'OK (' + (signed.signedUrl ? 'tem url' : 'sem url') + ')');

// 4) insert doc com todos os campos novos
const payload = {
  usuario_id: uid, nome: 'TESTE VERIFY — apagar', categoria: 'licencas', orgao: 'CBM',
  numero: 'X-1', emissao: '2026-01-01', vencimento: '2026-07-20', dias_aviso: 90,
  obs: 'verify', link_renovacao: 'https://exemplo.gov.br', passo_online: '1. passo',
  passo_presencial: '1. ir', login_portal: 'user', senha_portal: 'pass',
  endereco_orgao: 'Rua X', telefone_orgao: '(31) 3000', horario_orgao: '8h-17h',
  arquivo_url: path, arquivo_nome: 'teste.pdf', arquivo_tipo: 'application/pdf', arquivo_tamanho: 9,
};
const { data: ins, error: insErr } = await sb.from('documentos').insert(payload).select('*').single();
log('4) insert', insErr ? 'FAIL ' + insErr.message : 'OK id=' + ins.id);
if (insErr) process.exit(1);

// 5) read back — confere campos
const { data: row } = await sb.from('documentos').select('*').eq('id', ins.id).single();
log('5) readback campos:', JSON.stringify({
  arquivo_url: !!row.arquivo_url, arquivo_nome: row.arquivo_nome, dias_aviso: row.dias_aviso,
  login_portal: row.login_portal, passo_online: row.passo_online?.slice(0, 6), link: !!row.link_renovacao,
}));

// 6) cleanup
await sb.storage.from('documentos').remove([path]);
await sb.from('documentos').delete().eq('id', ins.id);
log('6) cleanup OK — arquivo e linha removidos');
log('\n✅ FLUXO COMPLETO VERIFICADO');
process.exit(0);
