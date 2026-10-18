// Prueba la web estática ya construida en un Chromium real, contra la PokeAPI real.
// Uso: node tools/test-web.mjs <carpeta del sitio>
// La sirve bajo /PokemonAPI/ (como en GitHub Pages) y deja los resultados como anotaciones de GitHub Actions.
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = process.argv[2] || "_site";
const BASE = "/PokemonAPI/";
const SCREENS = process.env.SCREENS_DIR || "";
const TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2"
};

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
    await page.waitForSelector(".dex-card:not([hidden])", { timeout: 30000 });
    check(await page.locator(".dex-card:not([hidden])").count() === 1, "Buscador del banner filtra la Pokédex");

    // Pokédex
    await page.goto(origin + "pokedex.html");
    await page.waitForSelector(".dex-card:not([hidden])", { timeout: 30000 });
    const cards = await page.locator(".dex-card").count();
    check(cards >= 1025, `Pokédex con ${cards} tarjetas`);
    check(await page.locator(".typepick").count() === 18, "18 filtros de tipo");
    check(await page.locator(".genchip").count() === 10, "Filtro de generación (Todas + 9)");
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
    check(await page.locator("#active-filters .token").count() === 2, "Filtros activos como etiquetas");
    await page.click("#active-filters .token[data-key=flying]");
    await page.waitForTimeout(300);
    check(!page.url().includes("flying"), "Quitar un filtro desde su etiqueta");
    await page.click(".genchip[data-gen='1']");
    await page.waitForTimeout(300);
    const kantoFire = await page.locator(".dex-card:not([hidden])").count();
    check(kantoFire > 5 && kantoFire < 20, `Fuego en Kanto: ${kantoFire}`);
    const nameCode0 = await page.locator(".dex-card[data-id='772'] .dex-card__name").innerText();
    check(nameCode0 === "Código Cero", `Nombre en español en la Pokédex: ${nameCode0}`);
    await page.goto(origin + "pokedex.html?tipo=dragon");
    await page.waitForSelector(".dex-card:not([hidden])", { timeout: 30000 });
    const dragons = await page.locator(".dex-card:not([hidden])").count();
    check(dragons > 50 && dragons < 200, `Enlace por tipo (dragón): ${dragons}`);

    // Ficha
    await page.goto(origin + "pokemon.html?id=6");
    await page.waitForSelector(".entry__name, .notice", { timeout: 30000 });
    check(await page.locator(".entry__name").innerText() === "Charizard", "Ficha 6: Charizard");
    check((await page.locator(".entry__genus").innerText()).length > 0, "Ficha con categoría");
    check((await page.locator(".entry__desc").innerText()).length > 20, "Ficha con descripción");
    const dmgTotal = (await page.locator(".dmg__item").count()) + (await page.locator(".dmg__neutral-icons span").count());
    check(dmgTotal === 18, `Daño recibido cubre los 18 tipos (${dmgTotal})`);
    check(await page.locator(".dmg__group--weak .dmg__item.type--rock .dmg__mult").innerText() === "×4", "Roca ×4 contra Charizard");
    check(await page.locator(".dmg__group--immune .dmg__item.type--ground").count() === 1, "Charizard inmune a Tierra");
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

    // Imágenes propias y peso de la carga inicial
    const thumb = await page.goto(origin + "img/p/25.webp");
    check(thumb.status() === 200 && (await thumb.body()).length < 30000, `Miniatura WebP propia (${(await thumb.body()).length} bytes)`);
    for (const [name, path, selector] of [["Portada", "", ".typegrid a"], ["Pokédex", "pokedex.html", ".dex-card"], ["Ficha", "pokemon.html?id=6", ".entry__name"]]) {
        const t0 = Date.now();
        await page.goto(origin + path);
        await page.waitForSelector(selector, { timeout: 30000 });
        const ready = Date.now() - t0;
        await page.waitForLoadState("load");
        const stats = await page.evaluate(() => {
            const res = performance.getEntriesByType("resource");
            const local = res.filter((r) => r.name.startsWith(location.origin));
            return { requests: res.length, localKb: Math.round(local.reduce((sum, r) => sum + (r.encodedBodySize || 0), 0) / 1024) };
        });
        check(ready < 8000, `${name}: contenido en ${ready} ms, ${stats.requests} peticiones, ${stats.localKb} KB propios`);
    }

    check(errors.length === 0, "Sin errores de JavaScript" + (errors.length ? ": " + errors.join(" | ") : ""));

    // Capturas para revisar el diseño con datos reales
    if (SCREENS) {
        await mkdir(SCREENS, { recursive: true });
        const shots = [["inicio", ""], ["pokedex", "pokedex.html"], ["pokedex-filtro", "pokedex.html?tipo=dragon&gen=4"], ["ficha", "pokemon.html?id=6"], ["ficha-eevee", "pokemon.html?id=133"]];
        for (const [w, h, label, scheme] of [[1280, 900, "escritorio", "light"], [390, 844, "movil", "dark"]]) {
            const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
            const shot = await ctx.newPage();
            for (const [name, path] of shots) {
                await shot.goto(origin + path);
                await shot.waitForSelector(".typegrid a, .dex-card, .entry__name", { timeout: 30000 });
                await shot.waitForLoadState("networkidle").catch(() => {});
                await shot.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await shot.waitForTimeout(800);
                await shot.evaluate(() => window.scrollTo(0, 0));
                await shot.waitForTimeout(300);
                await shot.screenshot({ path: `${SCREENS}/${name}-${label}.png`, fullPage: name !== "pokedex" && name !== "pokedex-filtro" });
            }
            await ctx.close();
        }
    }
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
