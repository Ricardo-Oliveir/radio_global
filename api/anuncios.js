// Lista as imagens da pasta "anuncios" para o carrossel de propaganda do painel lateral.
// Funciona sozinha na Vercel: é só colocar a imagem na pasta e publicar. Links opcionais ficam em anuncios/links.txt
// (uma linha por imagem: nome-do-arquivo.png https://site-do-anunciante.com).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const EXT = /\.(png|jpe?g|webp|gif|avif)$/i;
const DIRS = ['public/anuncios', 'dist/anuncios', 'anuncios'];
export function listar(dir){
  let files = []; try { files = readdirSync(dir).filter(f => EXT.test(f)).sort(); } catch { return []; }
  const links = {}; try { for (const l of readFileSync(join(dir, 'links.txt'), 'utf8').split(/\r?\n/)){ const m = l.trim().match(/^(\S+)\s+(https:\/\/\S+)$/); if (m) links[m[1]] = m[2]; } } catch {}
  return files.map(f => ({ src: '/anuncios/' + encodeURIComponent(f), link: links[f] || '' }));
}
export default function handler(req, res){
  const dir = DIRS.map(d => join(process.cwd(), d)).find(d => existsSync(d));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(JSON.stringify({ itens: dir ? listar(dir) : [] }));
}
