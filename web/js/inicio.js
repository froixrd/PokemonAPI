/* Pokédex estática — portada: banner con un Pokémon destacado, tipos y regiones. */
import { ARTWORK, GENERATIONS, SPRITE, esc, loadPokedex, pad, typeBadge } from "./common.js";

// Destacados del banner: uno distinto cada día.
const FEATURED = [6, 25, 94, 448, 658, 384, 150, 133, 197, 149, 445, 700, 1, 9, 143, 249, 282, 887, 1007, 815, 778, 571, 248, 130];

// Las tres iniciales de cada región.
const STARTERS = {
    1: [1, 4, 7], 2: [152, 155, 158], 3: [252, 255, 258], 4: [387, 390, 393], 5: [495, 498, 501],
    6: [650, 653, 656], 7: [722, 725, 728], 8: [810, 813, 816], 9: [906, 909, 912]
};

const hero = document.getElementById("hero");
const featured = document.getElementById("featured");
const img = document.getElementById("featured-img");
const caption = document.getElementById("featured-caption");

function dayIndex() {
    const now = new Date();
    return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}

let data;
try {
    data = await loadPokedex();
} catch (err) {
    // Sin datos la portada sigue funcionando: buscador y enlaces a la Pokédex.
    console.error(err);
    document.getElementById("tipos").hidden = true;
    document.getElementById("regiones").hidden = true;
    throw err;
}

// ---------- Banner ----------

const ids = FEATURED.filter((id) => data.byId.has(id));
const pick = data.byId.get(ids[dayIndex() % ids.length]) || data.species[0];
const pickTypes = pick.types.map((k) => data.typeByKey.get(k)).filter(Boolean);

hero.classList.add("tc-" + (pick.types[0] || "normal"));
featured.href = "pokemon.html?id=" + pick.id;
featured.setAttribute("aria-label", `Pokémon destacado de hoy: ${pick.name}, número ${pick.id}. Ver ficha`);
img.addEventListener("load", () => img.classList.add("is-ready"), { once: true });
img.src = ARTWORK(pick.id);
caption.innerHTML = `<span><small>Destacado de hoy</small><strong>${esc(pick.name)} <span class="muted">Nº ${pad(pick.id)}</span></strong></span>
<span class="hero__caption-types">${pickTypes.map((t) => typeBadge(t)).join("")}</span>`;
caption.hidden = false;

document.getElementById("hero-lead").textContent =
    `Las ${data.species.length} especies de las ${GENERATIONS.length} generaciones, con sus tipos, estadísticas, habilidades, debilidades y evoluciones. En español.`;

// ---------- Tipos ----------

const counts = new Map(data.types.map((t) => [t.key, 0]));
for (const s of data.species) for (const t of s.types) counts.set(t, (counts.get(t) || 0) + 1);

document.getElementById("typegrid").innerHTML = data.types.map((t) => `<li class="type--${esc(t.key)}">
    <a href="pokedex.html?tipo=${esc(t.key)}">
        <span class="typegrid__icon" aria-hidden="true"></span>
        <span><span class="typegrid__name">${esc(t.name)}</span><span class="typegrid__count">${counts.get(t.key)} ${counts.get(t.key) === 1 ? "especie" : "especies"}</span></span>
    </a>
</li>`).join("");

// ---------- Regiones ----------

document.getElementById("regions").innerHTML = GENERATIONS.map((g) => {
    const list = data.species.filter((s) => s.gen === g.n);
    if (!list.length) return "";
    return `<li><a href="pokedex.html?gen=${g.n}">
    <span>
        <span class="regions__name">${esc(g.region)}</span>
        <span class="regions__meta">Generación ${g.roman}, ${list.length} ${list.length === 1 ? "especie" : "especies"}</span>
    </span>
    <span class="regions__starters" aria-hidden="true">${(STARTERS[g.n] || []).map((id) =>
        `<img src="${SPRITE(id)}" data-fallback="${ARTWORK(id)}" alt="" width="52" height="52" loading="lazy" />`).join("")}</span>
</a></li>`;
}).join("");
