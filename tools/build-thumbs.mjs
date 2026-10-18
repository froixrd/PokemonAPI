// Genera las imágenes ligeras de la web estática a partir de las ilustraciones oficiales:
//   img/p/<id>.webp     miniatura de 200 px para tarjetas, búsqueda, regiones y evoluciones
//   img/hero/<id>.webp  560 px para los Pokémon del banner de la portada
// Las que ya existen en la carpeta de salida no se vuelven a generar (la carpeta se cachea en CI).
// Uso: node tools/build-thumbs.mjs <pokedex.json> <carpeta de salida>
import { access, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { FEATURED } from "../web/js/featured.js";

const DATA = process.argv[2] || "web/data/pokedex.json";
const OUT = process.argv[3] || "web/img";
const CONCURRENCY = 16;
const RAW = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const SOURCES = (id) => [`${RAW}other/official-artwork/${id}.png`, `${RAW}other/home/${id}.png`, `${RAW}${id}.png`];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (path) => access(path).then(() => true, () => false);

async function download(id) {
    for (const url of SOURCES(id)) {
        for (let attempt = 1; attempt <= 4; attempt++) {
            try {
                const res = await fetch(url);
                if (res.status === 404) break; // probar la siguiente fuente
                if (res.ok) return Buffer.from(await res.arrayBuffer());
            } catch { /* reintentar */ }
            await sleep(400 * 2 ** (attempt - 1));
        }
    }
    return null;
}

async function pool(items, worker) {
    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (next < items.length) await worker(items[next++]);
    }));
}

const data = JSON.parse(await readFile(DATA, "utf8"));
const ids = data.species.map((s) => s.id);
const heroIds = new Set(FEATURED.map(([id]) => id));
await mkdir(join(OUT, "p"), { recursive: true });
await mkdir(join(OUT, "hero"), { recursive: true });

let made = 0, cached = 0, missing = [];
const t0 = Date.now();
await pool(ids, async (id) => {
    const thumb = join(OUT, "p", `${id}.webp`);
    const big = join(OUT, "hero", `${id}.webp`);
    const needThumb = !(await exists(thumb));
    const needHero = heroIds.has(id) && !(await exists(big));
    if (!needThumb && !needHero) { cached++; return; }

    const source = await download(id);
    if (!source) { missing.push(id); return; }
    const render = async (trim) => {
        const image = trim ? sharp(source).trim({ threshold: 1 }) : sharp(source); // sin margen transparente
        if (needThumb) {
            await image.clone().resize(200, 200, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 80, alphaQuality: 90, effort: 5 }).toFile(thumb);
        }
        if (needHero) {
            await image.clone().resize(560, 560, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 84, alphaQuality: 92, effort: 5 }).toFile(big);
        }
    };
    try { await render(true); } catch { await render(false); }
    made++;
    if (made % 100 === 0) console.log(`  ${made} imágenes nuevas…`);
});

console.log(`OK: ${made} nuevas, ${cached} ya estaban, ${missing.length} sin imagen${missing.length ? " (" + missing.join(", ") + ")" : ""} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (missing.length > 20) process.exit(1);
