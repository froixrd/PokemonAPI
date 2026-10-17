using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WebApplication3.Models;
using WebApplication3.Models.Api;

namespace WebApplication3.Services
{
    /// <summary>
    /// Convierte las respuestas crudas de PokeAPI en los modelos que pintan las vistas.
    /// Todas las llamadas pasan por PokeApiClient, que cachea, así que repetir peticiones es barato.
    /// </summary>
    public class PokemonService
    {
        private const string Language = "es";
        private const string FallbackLanguage = "en";
        private const string SpeciesListPath = "pokemon-species?limit=10000";
        private const string SpriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{0}.png";
        private const string ArtworkUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{0}.png";

        /// <summary>Los 18 tipos jugables, en el orden de la tabla de tipos.</summary>
        public static readonly string[] TypeKeys =
        {
            "normal", "fire", "water", "grass", "electric", "ice", "fighting", "poison", "ground",
            "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"
        };

        public static readonly IReadOnlyList<GenerationInfo> Generations = new[]
        {
            new GenerationInfo { Number = 1, Roman = "I",    Region = "Kanto",   FirstId = 1,   LastId = 151 },
            new GenerationInfo { Number = 2, Roman = "II",   Region = "Johto",   FirstId = 152, LastId = 251 },
            new GenerationInfo { Number = 3, Roman = "III",  Region = "Hoenn",   FirstId = 252, LastId = 386 },
            new GenerationInfo { Number = 4, Roman = "IV",   Region = "Sinnoh",  FirstId = 387, LastId = 493 },
            new GenerationInfo { Number = 5, Roman = "V",    Region = "Teselia", FirstId = 494, LastId = 649 },
            new GenerationInfo { Number = 6, Roman = "VI",   Region = "Kalos",   FirstId = 650, LastId = 721 },
            new GenerationInfo { Number = 7, Roman = "VII",  Region = "Alola",   FirstId = 722, LastId = 809 },
            new GenerationInfo { Number = 8, Roman = "VIII", Region = "Galar",   FirstId = 810, LastId = 905 },
            new GenerationInfo { Number = 9, Roman = "IX",   Region = "Paldea",  FirstId = 906, LastId = 1025 }
        };

        private static readonly Dictionary<string, string> StatNames = new Dictionary<string, string>
        {
            { "hp", "PS" },
            { "attack", "Ataque" },
            { "defense", "Defensa" },
            { "special-attack", "At. esp." },
            { "special-defense", "Def. esp." },
            { "speed", "Velocidad" }
        };

        private static readonly Dictionary<string, string> HabitatNames = new Dictionary<string, string>
        {
            { "cave", "Cuevas" }, { "forest", "Bosque" }, { "grassland", "Praderas" }, { "mountain", "Montaña" },
            { "rare", "Raro" }, { "rough-terrain", "Terreno escarpado" }, { "sea", "Mar" }, { "urban", "Ciudad" },
            { "waters-edge", "Orillas" }
        };

        // Nombres que no salen bien de "capitalizar y quitar guiones".
        private static readonly Dictionary<string, string> NameFixes = new Dictionary<string, string>
        {
            { "nidoran-f", "Nidoran♀" }, { "nidoran-m", "Nidoran♂" }, { "mr-mime", "Mr. Mime" },
            { "mime-jr", "Mime Jr." }, { "mr-rime", "Mr. Rime" }, { "farfetchd", "Farfetch'd" },
            { "sirfetchd", "Sirfetch'd" }, { "flabebe", "Flabébé" }, { "type-null", "Código Cero" },
            { "ho-oh", "Ho-Oh" }, { "porygon-z", "Porygon-Z" }, { "jangmo-o", "Jangmo-o" },
            { "hakamo-o", "Hakamo-o" }, { "kommo-o", "Kommo-o" }, { "wo-chien", "Wo-Chien" },
            { "chien-pao", "Chien-Pao" }, { "ting-lu", "Ting-Lu" }, { "chi-yu", "Chi-Yu" }
        };

        private static readonly Regex Whitespace = new Regex(@"\s+", RegexOptions.Compiled);

        private readonly PokeApiClient _api;

        public PokemonService() : this(PokeApiClient.Shared) { }

        public PokemonService(PokeApiClient api)
        {
            if (api == null) throw new ArgumentNullException("api");
            _api = api;
        }

        // =====================================================================
        // Listado
        // =====================================================================

        public async Task<PokedexViewModel> GetPokedexAsync()
        {
            var speciesTask = _api.GetAsync<ResourceList>(SpeciesListPath);
            var typesTask = GetTypesAsync();
            await Task.WhenAll(speciesTask, typesTask).ConfigureAwait(false);

            var types = typesTask.Result;
            var typesById = BuildTypeIndex(types.Values);

            var entries = speciesTask.Result.Results
                .Select(r => new { Resource = r, Id = IdFromUrl(r.Url) })
                .Where(x => x.Id > 0)
                .OrderBy(x => x.Id)
                .Select(x =>
                {
                    List<string> entryTypes;
                    if (!typesById.TryGetValue(x.Id, out entryTypes)) entryTypes = new List<string>();
                    return new PokedexEntry
                    {
                        Id = x.Id,
                        Slug = x.Resource.Name,
                        Name = PrettyName(x.Resource.Name),
                        Types = entryTypes,
                        Generation = GenerationOf(x.Id).Number,
                        SpriteUrl = string.Format(SpriteUrl, x.Id),
                        ArtworkUrl = string.Format(ArtworkUrl, x.Id)
                    };
                })
                .ToList();

            var typeInfos = TypeKeys.Select(k => ToTypeInfo(k, types)).ToList();

            return new PokedexViewModel
            {
                Entries = entries,
                Types = typeInfos,
                TypeNames = typeInfos.ToDictionary(t => t.Key, t => t.Name),
                Generations = Generations
            };
        }

        /// <summary>Busca el número de una especie por su nombre en inglés ("pikachu"). Null si no existe.</summary>
        public async Task<int?> FindIdByNameAsync(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return null;
            var slug = name.Trim().ToLowerInvariant().Replace(' ', '-');
            var list = await _api.GetAsync<ResourceList>(SpeciesListPath).ConfigureAwait(false);
            var match = list.Results.FirstOrDefault(r => r.Name == slug);
            return match == null ? (int?)null : IdFromUrl(match.Url);
        }

        /// <summary>Precarga lo que necesita la portada para que la primera visita no espere a PokeAPI.</summary>
        public Task WarmUpAsync()
        {
            return GetPokedexAsync();
        }

        // =====================================================================
        // Ficha
        // =====================================================================

        public async Task<PokemonDetailViewModel> GetDetailAsync(int id)
        {
            var pokemonTask = _api.GetAsync<PokemonResponse>("pokemon/" + id);
            var speciesTask = _api.GetAsync<SpeciesResponse>("pokemon-species/" + id);
            var typesTask = GetTypesAsync();
            var listTask = _api.GetAsync<ResourceList>(SpeciesListPath);
            await Task.WhenAll(pokemonTask, speciesTask, typesTask, listTask).ConfigureAwait(false);

            var pokemon = pokemonTask.Result;
            var species = speciesTask.Result;
            var types = typesTask.Result;

            var typeKeys = (pokemon.Types ?? new List<PokemonTypeSlot>())
                .OrderBy(t => t.Slot)
                .Select(t => t.Type.Name)
                .ToList();

            var abilitiesTask = GetAbilitiesAsync(pokemon);
            var evolutionTask = GetEvolutionStagesAsync(species, id);
            await Task.WhenAll(abilitiesTask, evolutionTask).ConfigureAwait(false);

            var other = pokemon.Sprites == null ? null : pokemon.Sprites.Other;
            var artwork = other == null ? null : other.OfficialArtwork;
            var home = other == null ? null : other.Home;

            var neighbors = FindNeighbors(listTask.Result, id);

            return new PokemonDetailViewModel
            {
                Id = id,
                Slug = species.Name,
                Name = Localized(species.Names) ?? PrettyName(species.Name),
                Genus = PickLanguage(species.Genera, g => g.Language, g => g.Text),
                Description = CleanText(PickLanguage(species.FlavorTextEntries, f => f.Language, f => f.Text, latest: true)),
                Types = typeKeys.Select(k => ToTypeInfo(k, types)).ToList(),

                HeightMeters = pokemon.Height / 10m,
                WeightKg = pokemon.Weight / 10m,
                BaseExperience = pokemon.BaseExperience,
                CaptureRate = species.CaptureRate,
                Habitat = species.Habitat == null ? null : Lookup(HabitatNames, species.Habitat.Name),
                Generation = GenerationFromResource(species.Generation) ?? GenerationOf(id),
                IsLegendary = species.IsLegendary,
                IsMythical = species.IsMythical,
                IsBaby = species.IsBaby,

                ArtworkUrl = FirstNonEmpty(artwork == null ? null : artwork.FrontDefault,
                                           home == null ? null : home.FrontDefault,
                                           pokemon.Sprites == null ? null : pokemon.Sprites.FrontDefault),
                ArtworkShinyUrl = FirstNonEmpty(artwork == null ? null : artwork.FrontShiny,
                                                home == null ? null : home.FrontShiny,
                                                pokemon.Sprites == null ? null : pokemon.Sprites.FrontShiny),
                CryUrl = pokemon.Cries == null ? null : FirstNonEmpty(pokemon.Cries.Latest, pokemon.Cries.Legacy),

                Stats = (pokemon.Stats ?? new List<PokemonStat>())
                    .Select(s => new StatItem { Name = Lookup(StatNames, s.Stat.Name), Value = s.BaseStat })
                    .ToList(),
                Abilities = abilitiesTask.Result,
                Matchups = BuildMatchups(typeKeys, types),
                EvolutionStages = evolutionTask.Result,

                Previous = neighbors == null ? null : neighbors.Item1,
                Next = neighbors == null ? null : neighbors.Item2
            };
        }

        private async Task<IReadOnlyList<AbilityItem>> GetAbilitiesAsync(PokemonResponse pokemon)
        {
            var slots = (pokemon.Abilities ?? new List<PokemonAbility>()).OrderBy(a => a.Slot).ToList();
            var details = await Task.WhenAll(slots.Select(a => _api.TryGetAsync<AbilityResponse>(a.Ability.Url))).ConfigureAwait(false);

            return slots.Select((slot, i) =>
            {
                var detail = details[i];
                return new AbilityItem
                {
                    Name = (detail == null ? null : Localized(detail.Names)) ?? PrettyName(slot.Ability.Name),
                    Description = detail == null ? null
                        : CleanText(PickLanguage(detail.FlavorTextEntries, f => f.Language, f => f.Text, latest: true)),
                    IsHidden = slot.IsHidden
                };
            }).ToList();
        }

        private async Task<IReadOnlyList<IReadOnlyList<EvolutionMember>>> GetEvolutionStagesAsync(SpeciesResponse species, int currentId)
        {
            var empty = new List<IReadOnlyList<EvolutionMember>>();
            if (species.EvolutionChain == null) return empty;

            var chain = await _api.TryGetAsync<EvolutionChainResponse>(species.EvolutionChain.Url).ConfigureAwait(false);
            if (chain == null || chain.Chain == null) return empty;

            // Recorrido por niveles: cada nivel de la cadena es una columna (Eevee tiene 8 en la segunda).
            var levels = new List<List<ChainLink>>();
            var current = new List<ChainLink> { chain.Chain };
            while (current.Count > 0)
            {
                levels.Add(current);
                current = current.Where(l => l.EvolvesTo != null).SelectMany(l => l.EvolvesTo).ToList();
            }

            var stages = new List<IReadOnlyList<EvolutionMember>>();
            foreach (var level in levels)
            {
                var members = await Task.WhenAll(level.Select(link => BuildEvolutionMemberAsync(link, currentId))).ConfigureAwait(false);
                stages.Add(members.Where(m => m != null).ToList());
            }

            return stages;
        }

        private async Task<EvolutionMember> BuildEvolutionMemberAsync(ChainLink link, int currentId)
        {
            var id = IdFromUrl(link.Species.Url);
            if (id <= 0) return null;

            var speciesTask = _api.TryGetAsync<SpeciesResponse>(link.Species.Url);
            var detail = link.EvolutionDetails == null ? null : link.EvolutionDetails.FirstOrDefault();
            var conditionTask = detail == null ? Task.FromResult<string>(null) : DescribeEvolutionAsync(detail);
            await Task.WhenAll(speciesTask, conditionTask).ConfigureAwait(false);

            var species = speciesTask.Result;
            return new EvolutionMember
            {
                Id = id,
                Name = (species == null ? null : Localized(species.Names)) ?? PrettyName(link.Species.Name),
                ImageUrl = string.Format(ArtworkUrl, id),
                Condition = conditionTask.Result,
                IsCurrent = id == currentId
            };
        }

        private async Task<string> DescribeEvolutionAsync(EvolutionDetail d)
        {
            var parts = new List<string>();
            var trigger = d.Trigger == null ? null : d.Trigger.Name;

            switch (trigger)
            {
                case "level-up":
                    parts.Add(d.MinLevel.HasValue ? "Nivel " + d.MinLevel.Value : "Subir de nivel");
                    break;
                case "trade":
                    parts.Add("Intercambio");
                    break;
                case "use-item":
                    parts.Add(d.Item == null ? "Usar un objeto" : await NameOfAsync(d.Item).ConfigureAwait(false));
                    break;
                default:
                    parts.Add("Método especial");
                    break;
            }

            if (d.HeldItem != null) parts.Add("llevando " + await NameOfAsync(d.HeldItem).ConfigureAwait(false));
            if (d.KnownMove != null) parts.Add("sabiendo " + await NameOfAsync(d.KnownMove).ConfigureAwait(false));
            if (d.KnownMoveType != null) parts.Add("con un movimiento de tipo " + (await NameOfAsync(d.KnownMoveType).ConfigureAwait(false)).ToLowerInvariant());
            if (d.TradeSpecies != null) parts.Add("por " + await NameOfAsync(d.TradeSpecies).ConfigureAwait(false));
            if (d.PartySpecies != null) parts.Add("con " + await NameOfAsync(d.PartySpecies).ConfigureAwait(false) + " en el equipo");
            if (d.Location != null) parts.Add("en " + await NameOfAsync(d.Location).ConfigureAwait(false));
            if (d.MinHappiness.HasValue) parts.Add("con mucha amistad");
            if (d.MinAffection.HasValue) parts.Add("con mucho afecto");
            if (d.MinBeauty.HasValue) parts.Add("con mucha belleza");
            if (d.NeedsOverworldRain) parts.Add("mientras llueve");
            if (d.TurnUpsideDown) parts.Add("con la consola boca abajo");

            switch (d.TimeOfDay)
            {
                case "day": parts.Add("de día"); break;
                case "night": parts.Add("de noche"); break;
                case "dusk": parts.Add("al anochecer"); break;
            }

            if (d.Gender == 1) parts.Add("(hembra)");
            else if (d.Gender == 2) parts.Add("(macho)");

            return string.Join(" ", parts);
        }

        /// <summary>Nombre en español de cualquier recurso con "names" (objeto, movimiento, lugar, especie, tipo).</summary>
        private async Task<string> NameOfAsync(NamedApiResource resource)
        {
            var detail = await _api.TryGetAsync<LocalizableResource>(resource.Url).ConfigureAwait(false);
            return (detail == null ? null : Localized(detail.Names)) ?? PrettyName(resource.Name);
        }

        // =====================================================================
        // Tipos
        // =====================================================================

        private async Task<IReadOnlyDictionary<string, TypeResponse>> GetTypesAsync()
        {
            var all = await Task.WhenAll(TypeKeys.Select(k => _api.GetAsync<TypeResponse>("type/" + k))).ConfigureAwait(false);
            return all.ToDictionary(t => t.Name, t => t);
        }

        /// <summary>Número de especie → tipos ordenados por slot, a partir de las 18 listas de /type.</summary>
        private static Dictionary<int, List<string>> BuildTypeIndex(IEnumerable<TypeResponse> types)
        {
            return types
                .Where(t => t.Pokemon != null)
                .SelectMany(t => t.Pokemon.Select(p => new { Id = IdFromUrl(p.Pokemon.Url), p.Slot, Type = t.Name }))
                .Where(x => x.Id > 0)
                .GroupBy(x => x.Id)
                .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Slot).Select(x => x.Type).Distinct().ToList());
        }

        private static TypeInfo ToTypeInfo(string key, IReadOnlyDictionary<string, TypeResponse> types)
        {
            TypeResponse type;
            var name = types.TryGetValue(key, out type) ? Localized(type.Names) : null;
            return new TypeInfo { Key = key, Name = name ?? PrettyName(key) };
        }

        /// <summary>Multiplicador de daño que recibe la combinación de tipos frente a cada tipo atacante.</summary>
        private static IReadOnlyList<TypeMatchupGroup> BuildMatchups(IList<string> defending, IReadOnlyDictionary<string, TypeResponse> types)
        {
            var multipliers = new Dictionary<string, double>();
            foreach (var attacker in TypeKeys)
            {
                var m = 1.0;
                foreach (var key in defending)
                {
                    TypeResponse def;
                    if (!types.TryGetValue(key, out def) || def.DamageRelations == null) continue;
                    var r = def.DamageRelations;
                    if (Contains(r.NoDamageFrom, attacker)) m *= 0;
                    else if (Contains(r.DoubleDamageFrom, attacker)) m *= 2;
                    else if (Contains(r.HalfDamageFrom, attacker)) m *= 0.5;
                }
                multipliers[attacker] = m;
            }

            var groups = new[]
            {
                new { Value = 4.0,  Label = "×4", Description = "Muy débil",      Css = "x4" },
                new { Value = 2.0,  Label = "×2", Description = "Débil",          Css = "x2" },
                new { Value = 0.5,  Label = "×½", Description = "Resistente",     Css = "x05" },
                new { Value = 0.25, Label = "×¼", Description = "Muy resistente", Css = "x025" },
                new { Value = 0.0,  Label = "×0", Description = "Inmune",         Css = "x0" }
            };

            return groups
                .Select(g => new TypeMatchupGroup
                {
                    Label = g.Label,
                    Description = g.Description,
                    Css = g.Css,
                    Types = TypeKeys.Where(k => Math.Abs(multipliers[k] - g.Value) < 0.001)
                                    .Select(k => ToTypeInfo(k, types))
                                    .ToList()
                })
                .Where(g => g.Types.Count > 0)
                .ToList();
        }

        private static bool Contains(List<NamedApiResource> list, string name)
        {
            return list != null && list.Any(x => x.Name == name);
        }

        // =====================================================================
        // Utilidades
        // =====================================================================

        private static Tuple<PokedexNeighbor, PokedexNeighbor> FindNeighbors(ResourceList list, int id)
        {
            var ordered = list.Results
                .Select(r => new PokedexNeighbor { Id = IdFromUrl(r.Url), Name = PrettyName(r.Name) })
                .Where(n => n.Id > 0)
                .OrderBy(n => n.Id)
                .ToList();

            var index = ordered.FindIndex(n => n.Id == id);
            if (index < 0) return null;

            return Tuple.Create(
                index > 0 ? ordered[index - 1] : null,
                index < ordered.Count - 1 ? ordered[index + 1] : null);
        }

        public static GenerationInfo GenerationOf(int id)
        {
            return Generations.FirstOrDefault(g => id >= g.FirstId && id <= g.LastId) ?? Generations[Generations.Count - 1];
        }

        private static GenerationInfo GenerationFromResource(NamedApiResource generation)
        {
            if (generation == null) return null;
            var number = IdFromUrl(generation.Url);
            return Generations.FirstOrDefault(g => g.Number == number);
        }

        /// <summary>"https://pokeapi.co/api/v2/pokemon-species/25/" → 25</summary>
        public static int IdFromUrl(string url)
        {
            if (string.IsNullOrEmpty(url)) return 0;
            var trimmed = url.TrimEnd('/');
            var slash = trimmed.LastIndexOf('/');
            int id;
            return int.TryParse(trimmed.Substring(slash + 1), NumberStyles.None, CultureInfo.InvariantCulture, out id) ? id : 0;
        }

        public static string PrettyName(string slug)
        {
            if (string.IsNullOrEmpty(slug)) return slug;
            string fixedName;
            if (NameFixes.TryGetValue(slug, out fixedName)) return fixedName;

            var words = slug.Split(new[] { '-' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(w => char.ToUpperInvariant(w[0]) + w.Substring(1));
            return string.Join(" ", words);
        }

        private static string Localized(IEnumerable<LocalizedName> names)
        {
            return PickLanguage(names, n => n.Language, n => n.Name);
        }

        /// <summary>Texto en español; si no hay, en inglés. Con latest=true toma la entrada más reciente.</summary>
        private static string PickLanguage<T>(IEnumerable<T> items, Func<T, NamedApiResource> language, Func<T, string> text, bool latest = false)
        {
            if (items == null) return null;
            var list = items.Where(i => language(i) != null && !string.IsNullOrWhiteSpace(text(i))).ToList();

            foreach (var lang in new[] { Language, FallbackLanguage })
            {
                var matches = list.Where(i => language(i).Name == lang).ToList();
                if (matches.Count > 0) return text(latest ? matches[matches.Count - 1] : matches[0]);
            }
            return null;
        }

        /// <summary>Los textos de los juegos traen saltos de línea y avances de página a mitad de frase.</summary>
        private static string CleanText(string text)
        {
            if (string.IsNullOrEmpty(text)) return text;
            var cleaned = text.Replace('\f', ' ').Replace('\n', ' ').Replace('\r', ' ').Replace("­ ", string.Empty).Replace("­", string.Empty);
            return Whitespace.Replace(cleaned, " ").Trim();
        }

        private static string Lookup(Dictionary<string, string> map, string key)
        {
            string value;
            return map.TryGetValue(key, out value) ? value : PrettyName(key);
        }

        private static string FirstNonEmpty(params string[] values)
        {
            return values.FirstOrDefault(v => !string.IsNullOrEmpty(v));
        }
    }
}
