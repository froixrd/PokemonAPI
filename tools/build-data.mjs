// Genera data/pokedex.json para la web estática: todas las especies con su nombre
// en español, tipos y generación, y los 18 tipos con su nombre y relaciones de daño.
// Uso: node tools/build-data.mjs <ruta de salida>
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const API = "https://pokeapi.co/api/v2/";
const OUT = process.argv[2] || "web/data/pokedex.json";
const CONCURRENCY = 12;

const TYPE_KEYS = [
    "normal", "fire", "water", "grass", "electric", "ice", "fighting", "poison", "ground",
    "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, attempt = 1) {
    const url = path.startsWith("http") ? path : API + path;
    try {
        const res = await fetch(url, { headers: { "User-Agent": "PokedexStatic/1.0 (+https://github.com/froixrd/PokemonAPI)" } });
        if (res.ok) return await res.json();
        if (res.status === 404) throw Object.assign(new Error("404 " + url), { notFound: true });
        if (attempt >= 5 || (res.status < 500 && res.status !== 429)) throw new Error(res.status + " " + url);
    } catch (err) {
        if (err.notFound || attempt >= 5) throw err;
    }
    await sleep(500 * 2 ** (attempt - 1));
    return get(path, attempt + 1);
}

async function pool(items, worker) {
    const results = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await worker(items[i], i);
        }
    }));
    return results;
}

const idFromUrl = (url) => Number(url.replace(/\/+$/, "").split("/").pop()) || 0;
const pick = (list, lang, field = "name") => (list || []).find((x) => x.language && x.language.name === lang)?.[field];
const pretty = (slug) => slug.split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

const t0 = Date.now();
const [types, list] = await Promise.all([
    Promise.all(TYPE_KEYS.map((k) => get("type/" + k))),
    get("pokemon-species?limit=10000")
]);

const speciesRefs = list.results.map((r) => ({ slug: r.name, id: idFromUrl(r.url) })).filter((r) => r.id > 0).sort((a, b) => a.id - b.id);
const ids = new Set(speciesRefs.map((r) => r.id));

const typesById = new Map();
for (const t of types) {
    for (const p of t.pokemon) {
        const id = idFromUrl(p.pokemon.url);
        if (!ids.has(id)) continue;
        if (!typesById.has(id)) typesById.set(id, []);
        typesById.get(id).push({ slot: p.slot, type: t.name });
    }
}

let done = 0;
const species = await pool(speciesRefs, async (ref) => {
    const s = await get("pokemon-species/" + ref.id);
    if (++done % 100 === 0) console.log(`  ${done}/${speciesRefs.length} especies`);
    return {
        id: ref.id,
        slug: ref.slug,
        name: pick(s.names, "es") || pick(s.names, "en") || pretty(ref.slug),
        gen: idFromUrl(s.generation.url),
        types: (typesById.get(ref.id) || []).sort((a, b) => a.slot - b.slot).map((x) => x.type)
    };
});

const data = {
    generated: new Date().toISOString(),
    types: types.map((t) => ({
        key: t.name,
        name: pick(t.names, "es") || pretty(t.name),
        doubleFrom: t.damage_relations.double_damage_from.map((x) => x.name),
        halfFrom: t.damage_relations.half_damage_from.map((x) => x.name),
        noFrom: t.damage_relations.no_damage_from.map((x) => x.name)
    })),
    species
};

const missing = species.filter((s) => s.types.length === 0);
if (species.length < 1000 || missing.length > 0) {
    console.error(`Datos incompletos: ${species.length} especies, ${missing.length} sin tipo.`);
    process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(data));
console.log(`OK: ${species.length} especies y ${data.types.length} tipos en ${OUT} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
