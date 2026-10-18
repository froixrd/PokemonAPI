/* Pokédex estática — portada: banner con un Pokémon destacado, tipos y regiones. */
import { ARTWORK, GENERATIONS, HERO, THUMB, esc, loadPokedex, pad, typeBadge } from "./common.js";
import { featuredToday } from "./featured.js";
import { STARTERS } from "./regions-data.js";

const hero = document.getElementById("hero");
const featured = document.getElementById("featured");
const img = document.getElementById("featured-img");
const caption = document.getElementById("featured-caption");

// El banner empieza a cargar su imagen ya, sin esperar a los datos.
const today = featuredToday();
const pickId = today.id;
hero.classList.add("tc-" + today.type);
img.addEventListener("load", () => img.classList.add("is-ready"), { once: true });
img.setAttribute("data-fallback", ARTWORK(pickId));
img.src = HERO(pickId);
featured.href = "pokemon.html?id=" + pickId;

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

const pick = data.byId.get(pickId) || data.species[0];
const pickTypes = pick.types.map((k) => data.typeByKey.get(k)).filter(Boolean);

featured.setAttribute("aria-label", `Pokémon destacado de hoy: ${pick.name}, número ${pick.id}. Ver ficha`);
caption.innerHTML = `<span><small>Destacado de hoy</small><strong>${esc(pick.name)} <span class="muted">Nº ${pad(pick.id)}</span></strong></span>
<span class="hero__caption-types">${pickTypes.map((t) => typeBadge(t)).join("")}</span>`;
caption.hidden = false;

document.getElementById("hero-lead").textContent =
    `Las ${data.species.length} especies de las ${GENERATIONS.length} generaciones, con sus tipos, estadísticas, habilidades, debilidades y evoluciones. En español.`;

// ---------- Tipos ----------

const counts = new Map(data.types.map((t) => [t.key, 0]));
for (const s of data.species) for (const t of s.types) counts.set(t, (counts.get(t) || 0) + 1);

document.getElementById("typegrid").innerHTML = data.types.map((t) => {
    const n = counts.get(t.key);
    return `<li class="type--${esc(t.key)}">
    <a href="pokedex.html?tipo=${esc(t.key)}">
        <span class="typegrid__icon" aria-hidden="true"></span>
        <span class="typegrid__text">
            <span class="typegrid__name">${esc(t.name)}</span>
            <span class="typegrid__count">${n} ${n === 1 ? "especie" : "especies"}</span>
        </span>
    </a>
</li>`;
}).join("");

// ---------- Regiones ----------

document.getElementById("regions").innerHTML = GENERATIONS.map((g) => {
    const list = data.species.filter((s) => s.gen === g.n);
    if (!list.length) return "";
    const starters = (STARTERS[g.n] || []).map((id) => data.byId.get(id)).filter(Boolean);
    return `<li><a href="pokedex.html?gen=${g.n}" aria-label="${esc(g.region)}, generación ${g.roman}: ${list.length} especies">
    <span class="regions__head">
        <span class="regions__name">${esc(g.region)}</span>
        <span class="regions__gen">Gen. ${g.roman}</span>
    </span>
    <span class="regions__meta">${list.length} ${list.length === 1 ? "especie" : "especies"}, del ${pad(list[0].id)} al ${pad(list[list.length - 1].id)}</span>
    <span class="regions__starters" aria-hidden="true">${starters.map((s) =>
        `<span class="tc-${esc(s.types[0] || "normal")}"><img src="${THUMB(s.id)}" data-fallback="${ARTWORK(s.id)}" alt="" width="96" height="96" loading="lazy" decoding="async" /></span>`).join("")}</span>
</a></li>`;
}).join("");

// Enlaces antiguos a #tipos o #regiones: ir a la sección ahora que ya tiene contenido.
if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView();
}
