/* Pokédex estática — página de tipos: cuántas especies tiene cada uno y su tabla de ataque y defensa. */
import { esc, loadPokedex } from "./common.js";

const list = document.getElementById("type-list");

let data;
try {
    data = await loadPokedex();
} catch (err) {
    console.error(err);
    document.getElementById("load-error").hidden = false;
    throw err;
}

const counts = new Map(data.types.map((t) => [t.key, 0]));
for (const s of data.species) for (const t of s.types) counts.set(t, (counts.get(t) || 0) + 1);

// pokedex.json guarda la defensa de cada tipo; el ataque se deduce mirando la defensa de los demás.
const attack = (key, field) => data.types.filter((d) => d[field].includes(key));
const byKeys = (keys) => keys.map((k) => data.typeByKey.get(k)).filter(Boolean);

function row(label, mult, types) {
    return `<div class="tcard__row">
    <dt><span class="tcard__mult tcard__mult--${mult.css}">${mult.label}</span>${label}</dt>
    <dd>${types.length
        ? types.map((t) => `<a class="tcard__chip type--${esc(t.key)}" href="#${esc(t.key)}" title="${esc(t.name)}">${esc(t.name)}</a>`).join("")
        : `<span class="muted">Ninguno</span>`}</dd>
</div>`;
}

const X2 = { label: "×2", css: "x2" };
const X05 = { label: "×½", css: "x05" };
const X0 = { label: "×0", css: "x0" };

list.innerHTML = data.types.map((t) => {
    const n = counts.get(t.key);
    return `<section class="tcard type--${esc(t.key)}" id="${esc(t.key)}" aria-labelledby="t-${esc(t.key)}">
    <header class="tcard__head">
        <span class="tcard__icon" aria-hidden="true"></span>
        <span>
            <h2 class="tcard__name" id="t-${esc(t.key)}">${esc(t.name)}</h2>
            <a class="tcard__count" href="pokedex.html?tipo=${esc(t.key)}">${n} ${n === 1 ? "especie" : "especies"}</a>
        </span>
    </header>
    <div class="tcard__cols">
        <div>
            <h3>Al atacar</h3>
            <dl>
                ${row("Muy eficaz contra", X2, attack(t.key, "doubleFrom"))}
                ${row("Poco eficaz contra", X05, attack(t.key, "halfFrom"))}
                ${row("No afecta a", X0, attack(t.key, "noFrom"))}
            </dl>
        </div>
        <div>
            <h3>Al defender</h3>
            <dl>
                ${row("Débil a", X2, byKeys(t.doubleFrom))}
                ${row("Resiste", X05, byKeys(t.halfFrom))}
                ${row("Inmune a", X0, byKeys(t.noFrom))}
            </dl>
        </div>
    </div>
</section>`;
}).join("");

// El contenido se pinta después de cargar: si se llegó con un ancla (#fire), ir ahora a ella.
if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView();
}
