// Prueba la web estática ya construida en un Chromium real, contra la PokeAPI real.
// Uso: node tools/test-web.mjs <carpeta del sitio>
// La sirve bajo /PokemonAPI/ (como en GitHub Pages) y deja los resultados como anotaciones de GitHub Actions.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = process.argv[2] || "_site";
const BASE = "/PokemonAPI/";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (!path.startsWith(BASE)) { res.writeHead(404); return res.end(); }
    path = path.slice(BASE.length) || "index.html";
    if (path.endsWith("/")) path += "index.html";
    try {
        const body = await readFile(join(ROOT, normalize(path)));
        res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" });
        res.end(body);
    } catch {
        res.writeHead(404, { "Content-Type": TYPES[".html"] });
        res.end(await readFile(join(ROOT, "404.html")));
    }
}).listen(0);
const origin = `http://localhost:${server.address().port}${BASE}`;

const results = [];
const failures = [];
const ci = process.env.GITHUB_ACTIONS === "true";
function check(ok, message) {
    results.push((ok ? "OK    " : "FALLO ") + message);
    if (!ok) failures.push(message);
    console.log((ok ? "  OK    " : "  FALLO ") + message);
}

const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Portada
    await page.goto(origin);
    await page.waitForSelector(".typegrid a", { timeout: 30000 });
    check(await page.locator(".typegrid a").count() === 18, "Portada: 18 accesos por tipo");
    check(await page.locator(".regions a").count() === 9, "Portada: 9 regiones");
    await page.waitForSelector(".hero__img.is-ready", { timeout: 30000 });
    const featuredName = await page.locator("#featured-caption strong").innerText();
    check(featuredName.length > 0, "Portada: Pokémon destacado " + featuredName);

    // Búsqueda rápida desde el menú
    await page.click("[data-search-open]");
    await page.keyboard.type("pikachu");
    await page.waitForSelector(".quicksearch__results a", { timeout: 10000 });
    check(await page.locator(".quicksearch__results a").count() >= 1, "Búsqueda rápida encuentra a Pikachu");
    await page.keyboard.press("Enter");
    await page.waitForURL(/pokemon\.html\?id=25$/, { timeout: 15000 });
    check(true, "Intro en la búsqueda rápida abre la ficha 25");

    // Pokémon aleatorio
    await page.goto(origin);
    await page.waitForSelector(".typegrid a", { timeout: 30000 });
    await page.click(".topbar [data-random]");
    await page.waitForURL(/pokemon\.html\?id=\d+$/, { timeout: 15000 });
    check(true, "Botón aleatorio abre una ficha");

    // Buscador del banner lleva a la Pokédex filtrada
    await page.goto(origin);
    await page.fill("#hero-q", "eevee");
    await page.press("#hero-q", "Enter");
    await page.waitForSelector(".dex-card", { timeout: 30000 });
    check(await page.locator(".dex-card:not([hidden])").count() === 1, "Buscador del banner filtra la Pokédex");

    // Pokédex
    await page.goto(origin + "pokedex.html");
    await page.waitForSelector(".dex-card", { timeout: 30000 });
    const cards = await page.locator(".dex-card").count();
    check(cards >= 1025, `Pokédex con ${cards} tarjetas`);
    check(await page.locator(".chip").count() === 18, "18 filtros de tipo");
    await page.fill("#q", "pikachu");
    await page.waitForTimeout(400);
    check(await page.locator(".dex-card:not([hidden])").count() === 1, "Búsqueda 'pikachu' deja 1 resultado");
    await page.fill("#q", "");
    await page.click(".chip[data-type=fire]");
    await page.click(".chip[data-type=flying]");
    await page.waitForTimeout(300);
    const fireFlying = await page.locator(".dex-card:not([hidden]) .dex-card__name").allInnerTexts();
    check(fireFlying.includes("Charizard"), `Fuego + Volador: ${fireFlying.length} (${fireFlying.slice(0, 4).join(", ")}…)`);
    check(page.url().includes("tipo=fire%2Cflying") || page.url().includes("tipo=fire,flying"), "Filtros guardados en la URL");
    const nameCode0 = await page.locator(".dex-card[data-id='772'] .dex-card__name").innerText();
    check(nameCode0 === "Código Cero", `Nombre en español en la Pokédex: ${nameCode0}`);
    await page.goto(origin + "pokedex.html?tipo=dragon");
    await page.waitForSelector(".dex-card", { timeout: 30000 });
    const dragons = await page.locator(".dex-card:not([hidden])").count();
    check(dragons > 50 && dragons < 200, `Enlace por tipo (dragón): ${dragons}`);

    // Ficha
    await page.goto(origin + "pokemon.html?id=6");
    await page.waitForSelector(".entry__name, .notice", { timeout: 30000 });
    check(await page.locator(".entry__name").innerText() === "Charizard", "Ficha 6: Charizard");
    check((await page.locator(".entry__genus").innerText()).length > 0, "Ficha con categoría");
    check((await page.locator(".entry__desc").innerText()).length > 20, "Ficha con descripción");
    check(await page.locator(".typechart__cell").count() === 18, "Tabla de daño con 18 tipos");
    check(await page.locator(".typechart__cell.type--rock .typechart__mult").innerText() === "×4", "Roca ×4 contra Charizard");
    check(await page.locator(".evo__member").count() === 3, "3 etapas evolutivas");
    check((await page.locator(".evo").innerText()).includes("Nivel 16"), "Condición 'Nivel 16'");
    check(await page.locator("[data-cry]").count() === 1, "Botón de grito");
    await page.click("[data-shiny-toggle]");
    await page.waitForTimeout(500);
    check((await page.getAttribute("#artwork", "src")).includes("shiny"), "Variocolor cambia la ilustración");
    await page.keyboard.press("ArrowRight");
    await page.waitForURL(/id=7$/, { timeout: 15000 });
    check(true, "Flecha derecha lleva a la 7");

    await page.goto(origin + "pokemon.html?id=133");
    await page.waitForSelector(".evo__member", { timeout: 30000 });
    const eevee = await page.locator(".evo__stage").nth(1).locator(".evo__member").count();
    check(eevee >= 8, `Eevee con ${eevee} evoluciones`);
    const conds = await page.locator(".evo__stage").nth(1).locator(".evo__condition").allInnerTexts();
    check(conds.every((c) => c.trim().length > 0), "Condiciones de Eevee: " + conds.join(" | "));

    await page.goto(origin + "pokemon.html?n=pikachu");
    await page.waitForSelector(".entry__name", { timeout: 30000 });
    check(page.url().endsWith("pokemon.html?id=25"), "?n=pikachu pasa a ?id=25");

    await page.goto(origin + "pokemon.html?id=99999");
    await page.waitForSelector(".notice", { timeout: 30000 });
    check((await page.locator(".notice").innerText()).includes("no está"), "Número inexistente muestra aviso");

    const notFound = await page.goto(origin + "no-existe");
    check(notFound.status() === 404 && (await page.locator(".notice").count()) === 1, "Página 404 propia");

    await page.goto(origin + "acerca.html");
    check(await page.locator(".prose h1").count() === 1, "Acerca de");

    check(errors.length === 0, "Sin errores de JavaScript" + (errors.length ? ": " + errors.join(" | ") : ""));
} catch (err) {
    check(false, "Excepción: " + err.message);
} finally {
    await browser.close();
    server.close();
}

const escape = (t) => t.replace(/%/g, "%25").replace(/\r/g, "").replace(/\n/g, "%0A");
if (ci) {
    console.log("::notice::" + escape("Prueba de la web estática:\n" + results.join("\n")));
    for (const f of failures) console.log("::error::" + escape("FALLO " + f));
}
process.exit(failures.length ? 1 : 0);
