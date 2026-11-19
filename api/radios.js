// /radios/<pais>/ e /radios/<pais>/<cidade>/ (reescrito pelo vercel.json). Cache de CDN de 1 dia.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { index, render } from './_lib/radios.js';
let IX = null;
const load = () => IX || (IX = index(JSON.parse(readFileSync(['public/assets', 'dist/assets', 'assets'].map(d => join(process.cwd(), d, 'cities.json')).find(existsSync), 'utf8'))));
export default function handler(req, res){
  const SITE = (process.env.SITE_URL || 'https://radioglobal-phi.vercel.app').replace(/\/$/, '');
  const html = render(load(), (req.query && req.query.p) || '', SITE);
  if (!html){ res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8'); return res.send('<!doctype html><meta charset="utf-8"><title>Página não encontrada</title><p>Página não encontrada. <a href="/">Voltar ao WAVE GLOBAL</a></p>'); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(html);
}
