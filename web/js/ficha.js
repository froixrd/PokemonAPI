/* Pokédex estática — ficha de un Pokémon (pokemon.html?id=25 o ?n=pikachu). */
import {
    ARTWORK, NotFoundError, api, cleanText, esc, generation, isTyping, loadPokedex,
    normalize, pad, pickLanguage, prettyName, tryApi, typeBadge
} from "./common.js";

const main = document.querySelector("[data-ficha]");

const STAT_NAMES = {
    "hp": "PS", "attack": "Ataque", "defense": "Defensa",
    "special-attack": "At. esp.", "special-defense": "Def. esp.", "speed": "Velocidad"
};

const HABITATS = {
    "cave": "Cuevas", "forest": "Bosque", "grassland": "Praderas", "mountain": "Montaña", "rare": "Raro",
    "rough-terrain": "Terreno escarpado", "sea": "Mar", "urban": "Ciudad", "waters-edge": "Orillas"
};

const fmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const idFromUrl = (url) => Number(String(url).replace(/\/+$/, "").split("/").pop()) || 0;

// ---------- Datos ----------

async function resolveId(data) {
    const params = new URLSearchParams(location.search);
    const raw = (params.get("id") || params.get("n") || "").trim();
    if (/^\d+$/.test(raw)) return data.byId.has(Number(raw)) ? Number(raw) : null;
    if (!raw) return null;
    const wanted = normalize(raw.replace(/-/g, " "));
    const match = data.species.find((s) => normalize(s.slug.replace(/-/g, " ")) === wanted || normalize(s.name) === wanted);
    return match ? match.id : null;
}

async function nameOf(resource, data) {
    if (!resource) return "";
    if (/pokemon-species/.test(resource.url)) {
        const s = data.byId.get(idFromUrl(resource.url));
        if (s) return s.name;
    }
    if (/\/type\//.test(resource.url)) {
        const t = data.typeByKey.get(resource.name);
        if (t) return t.name;
    }
    const detail = await tryApi(resource.url);
    return (detail && pickLanguage(detail.names, "name")) || prettyName(resource.name);
}

async function describeEvolution(d, data) {
    const parts = [];
    const trigger = d.trigger && d.trigger.name;
    if (trigger === "level-up") parts.push(d.min_level ? "Nivel " + d.min_level : "Subir de nivel");
    else if (trigger === "trade") parts.push("Intercambio");
    else if (trigger === "use-item") parts.push(d.item ? await nameOf(d.item, data) : "Usar un objeto");
    else parts.push("Método especial");

    if (d.held_item) parts.push("llevando " + await nameOf(d.held_item, data));
    if (d.known_move) parts.push("sabiendo " + await nameOf(d.known_move, data));
    if (d.known_move_type) parts.push("con un movimiento de tipo " + (await nameOf(d.known_move_type, data)).toLowerCase());
    if (d.trade_species) parts.push("por " + await nameOf(d.trade_species, data));
    if (d.party_species) parts.push("con " + await nameOf(d.party_species, data) + " en el equipo");
    if (d.location) parts.push("en " + await nameOf(d.location, data));
    if (d.min_happiness) parts.push("con mucha amistad");
    if (d.min_affection) parts.push("con mucho afecto");
    if (d.min_beauty) parts.push("con mucha belleza");
    if (d.needs_overworld_rain) parts.push("mientras llueve");
    if (d.turn_upside_down) parts.push("con la consola boca abajo");
    if (d.time_of_day === "day") parts.push("de día");
    else if (d.time_of_day === "night") parts.push("de noche");
    else if (d.time_of_day === "dusk") parts.push("al anochecer");
    if (d.gender === 1) parts.push("(hembra)");
    else if (d.gender === 2) parts.push("(macho)");
    return parts.join(" ");
}

async function evolutionStages(species, currentId, data) {
    const chain = species.evolution_chain ? await tryApi(species.evolution_chain.url) : null;
    if (!chain || !chain.chain) return [];

    const levels = [];
    let current = [chain.chain];
    while (current.length) {
        levels.push(current);
        current = current.flatMap((link) => link.evolves_to || []);
    }

    return Promise.all(levels.map((level) => Promise.all(level.map(async (link) => {
        const id = idFromUrl(link.species.url);
        const detail = (link.evolution_details || [])[0];
        return {
            id,
            name: (data.byId.get(id) || {}).name || prettyName(link.species.name),
            condition: detail ? await describeEvolution(detail, data) : "",
            current: id === currentId
        };
    }))));
}

function typeChart(defending, data) {
    return data.types.map((attacker) => {
        let m = 1;
        for (const key of defending) {
            const def = data.typeByKey.get(key);
            if (!def) continue;
            if (def.noFrom.includes(attacker.key)) m *= 0;
            else if (def.doubleFrom.includes(attacker.key)) m *= 2;
            else if (def.halfFrom.includes(attacker.key)) m *= 0.5;
        }
        const label = m === 0 ? "×0" : m === 0.25 ? "×¼" : m === 0.5 ? "×½" : "×" + m;
        const css = { 0: "x0", 0.25: "x025", 0.5: "x05", 1: "x1", 2: "x2", 4: "x4" }[m] || "x1";
        return { type: attacker, multiplier: m, label, css };
    });
}

async function loadDetail(id, data) {
    const [pokemon, species] = await Promise.all([api("pokemon/" + id), api("pokemon-species/" + id)]);

    const abilitySlots = (pokemon.abilities || []).slice().sort((a, b) => a.slot - b.slot);
    const [abilities, stages] = await Promise.all([
        Promise.all(abilitySlots.map(async (slot) => {
            const detail = await tryApi(slot.ability.url);
            return {
                name: (detail && pickLanguage(detail.names, "name")) || prettyName(slot.ability.name),
                description: detail ? cleanText(pickLanguage(detail.flavor_text_entries, "flavor_text", true)) : null,
                hidden: slot.is_hidden
            };
        })),
        evolutionStages(species, id, data)
    ]);

    const typeKeys = (pokemon.types || []).slice().sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
    const other = (pokemon.sprites && pokemon.sprites.other) || {};
    const art = other["official-artwork"] || {};
    const home = other.home || {};
    const index = data.species.findIndex((s) => s.id === id);

    return {
        id,
        name: pickLanguage(species.names, "name") || prettyName(species.name),
        genus: pickLanguage(species.genera, "genus"),
        description: cleanText(pickLanguage(species.flavor_text_entries, "flavor_text", true)),
        types: typeKeys.map((k) => data.typeByKey.get(k) || { key: k, name: prettyName(k) }),
        height: pokemon.height / 10,
        weight: pokemon.weight / 10,
        baseExperience: pokemon.base_experience,
        captureRate: species.capture_rate,
        habitat: species.habitat ? (HABITATS[species.habitat.name] || prettyName(species.habitat.name)) : null,
        generation: generation(idFromUrl(species.generation.url)),
        legendary: species.is_legendary,
        mythical: species.is_mythical,
        baby: species.is_baby,
        artwork: art.front_default || home.front_default || (pokemon.sprites || {}).front_default,
        artworkShiny: art.front_shiny || home.front_shiny || (pokemon.sprites || {}).front_shiny,
        cry: pokemon.cries ? (pokemon.cries.latest || pokemon.cries.legacy) : null,
        stats: (pokemon.stats || []).map((s) => ({ name: STAT_NAMES[s.stat.name] || prettyName(s.stat.name), value: s.base_stat })),
        abilities,
        chart: typeChart(typeKeys, data),
        stages,
        previous: index > 0 ? data.species[index - 1] : null,
        next: index >= 0 && index < data.species.length - 1 ? data.species[index + 1] : null
    };
}

// ---------- Pintar ----------

const band = (v) => v < 50 ? "low" : v < 90 ? "mid" : v < 120 ? "high" : "top";
const href = (id) => "pokemon.html?id=" + id;

function render(p) {
    const total = p.stats.reduce((sum, s) => sum + s.value, 0);
    const tags = [p.legendary && "Legendario", p.mythical && "Singular", p.baby && "Bebé"].filter(Boolean);

    const pager = `
<nav class="pager" aria-label="Pokémon anterior y siguiente">
    ${p.previous ? `<a class="pager__link pager__link--prev" rel="prev" data-nav="prev" href="${href(p.previous.id)}">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        <span><small>${pad(p.previous.id)}</small> ${esc(p.previous.name)}</span></a>` : ""}
    <a class="pager__all" href="./">Todas las especies</a>
    ${p.next ? `<a class="pager__link pager__link--next" rel="next" data-nav="next" href="${href(p.next.id)}">
        <span><small>${pad(p.next.id)}</small> ${esc(p.next.name)}</span>
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></a>` : ""}
</nav>`;

    const specimen = `
<figure class="specimen">
    <span class="specimen__number" aria-hidden="true">${pad(p.id)}</span>
    ${p.artwork ? `<img class="specimen__img" id="artwork" src="${esc(p.artwork)}" data-normal="${esc(p.artwork)}" data-shiny="${esc(p.artworkShiny || "")}"
        alt="Ilustración oficial de ${esc(p.name)}" width="475" height="475" fetchpriority="high" />` : ""}
    <figcaption class="specimen__actions">
        ${p.artworkShiny ? `<button type="button" class="button button--ghost" data-shiny-toggle aria-pressed="false">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-2.2z" /></svg>
            <span data-shiny-label>Ver variocolor</span></button>` : ""}
        ${p.cry ? `<button type="button" class="button button--ghost" data-cry="${esc(p.cry)}">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>
            Escuchar grito</button>` : ""}
    </figcaption>
</figure>`;

    const facts = [
        ["Altura", fmt.format(p.height) + " m"],
        ["Peso", fmt.format(p.weight) + " kg"],
        ["Generación", `${p.generation.roman}, ${p.generation.region}`],
        p.habitat && ["Hábitat", p.habitat],
        ["Ratio de captura", p.captureRate],
        p.baseExperience != null && ["Experiencia base", p.baseExperience]
    ].filter(Boolean);

    const summary = `
<div class="entry__summary">
    <p class="entry__number">Nº ${pad(p.id)}</p>
    <h1 class="entry__name">${esc(p.name)}</h1>
    ${p.genus ? `<p class="entry__genus">${esc(p.genus)}</p>` : ""}
    <p class="entry__types">${p.types.map((t) => typeBadge(t, " type--lg")).join("")}${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</p>
    ${p.description ? `<p class="entry__desc">${esc(p.description)}</p>` : ""}
    <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
</div>`;

    const stats = `
<section class="panel panel--stats" aria-labelledby="h-stats">
    <h2 id="h-stats">Estadísticas base</h2>
    <table class="stats">
        <tbody>${p.stats.map((s) => `<tr><th scope="row">${esc(s.name)}</th><td class="stats__value">${s.value}</td>
            <td class="stats__bar" aria-hidden="true"><span class="bar bar--${band(s.value)}" style="--v: ${Math.round(s.value * 100 / 255)}%"></span></td></tr>`).join("")}</tbody>
        <tfoot><tr><th scope="row">Total</th><td class="stats__value">${total}</td><td></td></tr></tfoot>
    </table>
</section>`;

    const chart = `
<section class="panel" aria-labelledby="h-matchups">
    <h2 id="h-matchups">Daño recibido</h2>
    <ul class="typechart">${p.chart.map((e) => `<li class="typechart__cell typechart__cell--${e.css} type--${esc(e.type.key)}" title="${esc(e.type.name)}: ${e.label}">
        <span class="typechart__icon" aria-hidden="true"></span>
        <span class="typechart__name">${esc(e.type.name)}</span>
        <span class="typechart__mult">${e.label}</span></li>`).join("")}</ul>
    <p class="typechart-legend">
        <span><strong>×4 ×2</strong>débil</span>
        <span><strong>×½ ×¼</strong>resistente</span>
        <span><strong>×0</strong>inmune</span>
    </p>
</section>`;

    const abilities = `
<section class="panel panel--wide" aria-labelledby="h-abilities">
    <h2 id="h-abilities">Habilidades</h2>
    <ul class="abilities">${p.abilities.map((a) => `<li>
        <p class="abilities__name">${esc(a.name)}${a.hidden ? ` <span class="tag tag--quiet">Oculta</span>` : ""}</p>
        ${a.description ? `<p class="abilities__desc">${esc(a.description)}</p>` : ""}</li>`).join("")}</ul>
</section>`;

    const evolution = `
<section class="panel panel--wide" aria-labelledby="h-evolution">
    <h2 id="h-evolution">Evolución</h2>
    ${p.stages.length <= 1 ? `<p class="muted">${esc(p.name)} no evoluciona.</p>` : `<ol class="evo">${p.stages.map((stage) => `<li class="evo__stage"><ul class="evo__members">${stage.map((m) => `
        <li class="evo__member${m.current ? " is-current" : ""}">
            <span class="evo__condition">${esc(m.condition)}</span>
            <a href="${href(m.id)}"${m.current ? ` aria-current="page"` : ""}>
                <img src="${ARTWORK(m.id)}" alt="" width="120" height="120" loading="lazy" decoding="async" />
                <span class="evo__name">${esc(m.name)}</span>
                <span class="evo__num">${pad(m.id)}</span>
            </a>
        </li>`).join("")}</ul></li>`).join("")}</ol>`}
</section>`;

    main.innerHTML = `
<article class="entry tc-${esc(p.types[0] ? p.types[0].key : "normal")}">
    ${pager}
    <div class="entry__hero">${specimen}${summary}</div>
    <div class="entry__panels">${stats}${chart}${abilities}${evolution}</div>
</article>`;

    document.title = `${p.name} (Nº ${pad(p.id)}) | Pokédex`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && p.description) meta.setAttribute("content", p.description);
}

function renderNotice(code, title, text, action) {
    main.innerHTML = `
<section class="notice">
    <p class="notice__code" aria-hidden="true">${code}</p>
    <h1>${title}</h1>
    <p>${text}</p>
    <p>${action}</p>
</section>`;
    document.title = title + " | Pokédex";
}

// ---------- Interacción ----------

function wire() {
    const artwork = document.getElementById("artwork");
    const shinyToggle = document.querySelector("[data-shiny-toggle]");
    if (artwork && shinyToggle) {
        const label = shinyToggle.querySelector("[data-shiny-label]");
        new Image().src = artwork.getAttribute("data-shiny"); // precarga
        shinyToggle.addEventListener("click", () => {
            const shiny = shinyToggle.getAttribute("aria-pressed") !== "true";
            artwork.classList.add("is-swapping");
            setTimeout(() => {
                artwork.onload = () => artwork.classList.remove("is-swapping");
                artwork.src = artwork.getAttribute(shiny ? "data-shiny" : "data-normal");
                if (artwork.complete) artwork.classList.remove("is-swapping");
            }, 160);
            shinyToggle.setAttribute("aria-pressed", shiny ? "true" : "false");
            label.textContent = shiny ? "Ver color normal" : "Ver variocolor";
        });
    }

    const cryButton = document.querySelector("[data-cry]");
    if (cryButton) {
        let cry;
        cryButton.addEventListener("click", () => {
            if (!cry) {
                cry = new Audio(cryButton.getAttribute("data-cry"));
                cry.volume = 0.5;
            }
            cry.currentTime = 0;
            const playing = cry.play();
            if (playing && playing.catch) playing.catch(() => { /* el navegador bloqueó el audio */ });
        });
    }
}

// Flechas izquierda/derecha: Pokémon anterior/siguiente.
document.addEventListener("keydown", (event) => {
    if (isTyping(event) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const link = document.querySelector(event.key === "ArrowLeft" ? "[data-nav='prev']" : event.key === "ArrowRight" ? "[data-nav='next']" : null);
    if (link) link.click();
});

// ---------- Arranque ----------

try {
    const data = await loadPokedex();
    const id = await resolveId(data);
    if (!id) {
        renderNotice("404", "Ese Pokémon no está en la Pokédex",
            "Revisa el número o el nombre del enlace, o búscalo en el listado.",
            `<a class="button" href="./">Ir al listado</a>`);
    } else {
        render(await loadDetail(id, data));
        wire();
        if (new URLSearchParams(location.search).get("id") !== String(id)) {
            history.replaceState(null, "", "pokemon.html?id=" + id);
        }
    }
} catch (err) {
    if (err instanceof NotFoundError) {
        renderNotice("404", "Ese Pokémon no está en la Pokédex",
            "Revisa el número o el nombre del enlace, o búscalo en el listado.",
            `<a class="button" href="./">Ir al listado</a>`);
    } else {
        console.error(err);
        renderNotice("503", "PokeAPI no responde ahora mismo",
            "Los datos vienen de PokeAPI y no ha contestado tras varios intentos. Suele volver en unos minutos.",
            `<a class="button" href="${esc(location.href)}">Reintentar</a>`);
    }
}
