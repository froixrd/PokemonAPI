using System.Collections.Generic;
using Newtonsoft.Json;

// Modelos de respuesta de PokeAPI (https://pokeapi.co/docs/v2).
// Solo se declaran los campos que usa la web; el resto del JSON se ignora.
// Los nombres en snake_case se mapean con SnakeCaseNamingStrategy (ver PokeApiClient).
namespace WebApplication3.Models.Api
{
    public class NamedApiResource
    {
        public string Name { get; set; }
        public string Url { get; set; }
    }

    public class ApiResource
    {
        public string Url { get; set; }
    }

    public class ResourceList
    {
        public int Count { get; set; }
        public List<NamedApiResource> Results { get; set; }
    }

    public class LocalizedName
    {
        public string Name { get; set; }
        public NamedApiResource Language { get; set; }
    }

    /// <summary>Cualquier recurso que solo interesa por sus nombres traducidos (objetos, movimientos, lugares...).</summary>
    public class LocalizableResource
    {
        public string Name { get; set; }
        public List<LocalizedName> Names { get; set; }
    }

    public class FlavorText
    {
        [JsonProperty("flavor_text")]
        public string Text { get; set; }
        public NamedApiResource Language { get; set; }
    }

    public class Genus
    {
        [JsonProperty("genus")]
        public string Text { get; set; }
        public NamedApiResource Language { get; set; }
    }

    // ---------- /type/{name} ----------

    public class TypeResponse
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public List<LocalizedName> Names { get; set; }
        public DamageRelations DamageRelations { get; set; }
        public List<TypePokemon> Pokemon { get; set; }
    }

    public class DamageRelations
    {
        public List<NamedApiResource> DoubleDamageFrom { get; set; }
        public List<NamedApiResource> HalfDamageFrom { get; set; }
        public List<NamedApiResource> NoDamageFrom { get; set; }
    }

    public class TypePokemon
    {
        public int Slot { get; set; }
        public NamedApiResource Pokemon { get; set; }
    }

    // ---------- /pokemon/{id} ----------

    public class PokemonResponse
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public int Height { get; set; }
        public int Weight { get; set; }
        public int? BaseExperience { get; set; }
        public List<PokemonAbility> Abilities { get; set; }
        public List<PokemonTypeSlot> Types { get; set; }
        public List<PokemonStat> Stats { get; set; }
        public PokemonSprites Sprites { get; set; }
        public PokemonCries Cries { get; set; }
        public NamedApiResource Species { get; set; }
    }

    public class PokemonAbility
    {
        public bool IsHidden { get; set; }
        public int Slot { get; set; }
        public NamedApiResource Ability { get; set; }
    }

    public class PokemonTypeSlot
    {
        public int Slot { get; set; }
        public NamedApiResource Type { get; set; }
    }

    public class PokemonStat
    {
        public int BaseStat { get; set; }
        public NamedApiResource Stat { get; set; }
    }

    public class PokemonSprites
    {
        public string FrontDefault { get; set; }
        public string FrontShiny { get; set; }
        public SpritesOther Other { get; set; }
    }

    public class SpritesOther
    {
        [JsonProperty("official-artwork")]
        public ArtworkSprites OfficialArtwork { get; set; }

        [JsonProperty("home")]
        public ArtworkSprites Home { get; set; }
    }

    public class ArtworkSprites
    {
        public string FrontDefault { get; set; }
        public string FrontShiny { get; set; }
    }

    public class PokemonCries
    {
        public string Latest { get; set; }
        public string Legacy { get; set; }
    }

    // ---------- /pokemon-species/{id} ----------

    public class SpeciesResponse
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public List<LocalizedName> Names { get; set; }
        public List<Genus> Genera { get; set; }
        public List<FlavorText> FlavorTextEntries { get; set; }
        public ApiResource EvolutionChain { get; set; }
        public NamedApiResource Generation { get; set; }
        public NamedApiResource Habitat { get; set; }
        public int CaptureRate { get; set; }
        public bool IsBaby { get; set; }
        public bool IsLegendary { get; set; }
        public bool IsMythical { get; set; }
    }

    // ---------- /ability/{name} ----------

    public class AbilityResponse
    {
        public string Name { get; set; }
        public List<LocalizedName> Names { get; set; }
        public List<FlavorText> FlavorTextEntries { get; set; }
    }

    // ---------- /evolution-chain/{id} ----------

    public class EvolutionChainResponse
    {
        public int Id { get; set; }
        public ChainLink Chain { get; set; }
    }

    public class ChainLink
    {
        public NamedApiResource Species { get; set; }
        public List<EvolutionDetail> EvolutionDetails { get; set; }
        public List<ChainLink> EvolvesTo { get; set; }
    }

    public class EvolutionDetail
    {
        public NamedApiResource Trigger { get; set; }
        public int? MinLevel { get; set; }
        public NamedApiResource Item { get; set; }
        public NamedApiResource HeldItem { get; set; }
        public NamedApiResource KnownMove { get; set; }
        public NamedApiResource KnownMoveType { get; set; }
        public NamedApiResource Location { get; set; }
        public NamedApiResource TradeSpecies { get; set; }
        public NamedApiResource PartySpecies { get; set; }
        public int? MinHappiness { get; set; }
        public int? MinAffection { get; set; }
        public int? MinBeauty { get; set; }
        public int? Gender { get; set; }
        public string TimeOfDay { get; set; }
        public bool NeedsOverworldRain { get; set; }
        public bool TurnUpsideDown { get; set; }
    }
}
