/* Pokédex estática — página de regiones. */
import { ARTWORK, GENERATIONS, THUMB, esc, loadPokedex, pad } from "./common.js";
import { BLURBS, LEGENDARIES, STARTERS } from "./regions-data.js";

const list = document.getElementById("region-list");
const nav = document.getElementById("region-nav");

const slug = (g) => g.region.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

let data;
try {
    data = await loadPokedex();
} catch (err) {
    console.error(err);
    document.getElementById("load-error").hidden = false;
    throw err;
}

const regions = GENERATIONS.map((g) => ({ g, species: data.species.filter((s) => s.gen === g.n) })).filter((r) => r.species.length);

function mons(ids, size) {
    return ids.map((id) => data.byId.get(id)).filter(Boolean).map((s) => `<li>
    <a href="pokemon.html?id=${s.id}" class="tc-${esc(s.types[0] || "normal")}">
        <span class="mon__art"><img src="${THUMB(s.id)}" data-fallback="${ARTWORK(s.id)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" /></span>
        <span class="mon__name">${esc(s.name)}</span>
    </a>
</li>`).join("");
}

function topTypes(species, n = 3) {
    const counts = new Map();
    for (const s of species) for (const t of s.types) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([key, count]) => ({ type: data.typeByKey.get(key), count })).filter((x) => x.type);
}

nav.innerHTML = regions.map(({ g }) => `<a class="genchip" href="#${slug(g)}"><small>${g.roman}</small>${esc(g.region)}</a>`).join("");

list.innerHTML = regions.map(({ g, species }) => {
    const first = species[0].id;
    const last = species[species.length - 1].id;
    const common = topTypes(species);
    return `<section class="region" id="${slug(g)}" aria-labelledby="r-${g.n}">
    <div class="region__info">
        <p class="region__gen">Generación ${g.roman}</p>
        <h2 class="region__name" id="r-${g.n}">${esc(g.region)}</h2>
        <p class="region__blurb">${esc(BLURBS[g.n] || "")}</p>
        <dl class="region__facts">
            <div><dt>Especies</dt><dd>${species.length}</dd></div>
            <div><dt>Números</dt><dd>${pad(first)} a ${pad(last)}</dd></div>
        </dl>
        <p class="region__types-label">Tipos más frecuentes</p>
        <p class="region__types">${common.map(({ type, count }) =>
            `<a class="type type--${esc(type.key)}" href="pokedex.html?gen=${g.n}&amp;tipo=${esc(type.key)}">${esc(type.name)} <span class="muted">${count}</span></a>`).join("")}</p>
        <a class="button region__cta" href="pokedex.html?gen=${g.n}">Ver las ${species.length} especies</a>
    </div>
    <div class="region__mons">
        <h3>Iniciales</h3>
        <ul class="mons mons--starters">${mons(STARTERS[g.n] || [], 128)}</ul>
        <h3>Legendarios</h3>
        <ul class="mons mons--legend">${mons(LEGENDARIES[g.n] || [], 96)}</ul>
    </div>
</section>`;
}).join("");

// El contenido se pinta después de cargar: si se llegó con un ancla (#kanto), ir ahora a ella.
if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView();
}
