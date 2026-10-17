using System.Collections.Generic;

namespace WebApplication3.Models
{
    public class TypeInfo
    {
        public string Key { get; set; }   // "fire"
        public string Name { get; set; }  // "Fuego"
    }

    public class GenerationInfo
    {
        public int Number { get; set; }
        public string Roman { get; set; }
        public string Region { get; set; }
        public int FirstId { get; set; }
        public int LastId { get; set; }

        public string Label
        {
            get { return "Gen. " + Roman + " (" + Region + ")"; }
        }
    }

    // ---------- Listado ----------

    public class PokedexEntry
    {
        public int Id { get; set; }
        public string Slug { get; set; }
        public string Name { get; set; }
        public IReadOnlyList<string> Types { get; set; }
        public int Generation { get; set; }
        public string SpriteUrl { get; set; }
        public string ArtworkUrl { get; set; }

        public string Number
        {
            get { return Id.ToString("0000"); }
        }

        public string PrimaryType
        {
            get { return Types.Count > 0 ? Types[0] : "normal"; }
        }
    }

    public class PokedexViewModel
    {
        public IReadOnlyList<PokedexEntry> Entries { get; set; }
        public IReadOnlyList<TypeInfo> Types { get; set; }
        public IReadOnlyList<GenerationInfo> Generations { get; set; }
        public IReadOnlyDictionary<string, string> TypeNames { get; set; }
    }

    // ---------- Ficha ----------

    public class StatItem
    {
        public string Name { get; set; }
        public int Value { get; set; }

        /// <summary>Porcentaje sobre 255, el máximo posible de una estadística base.</summary>
        public int Percent
        {
            get { return (int)System.Math.Round(Value * 100.0 / 255.0); }
        }

        /// <summary>Tramo para colorear la barra: bajo, medio, alto, top.</summary>
        public string Band
        {
            get
            {
                if (Value < 50) return "low";
                if (Value < 90) return "mid";
                if (Value < 120) return "high";
                return "top";
            }
        }
    }

    public class AbilityItem
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public bool IsHidden { get; set; }
    }

    public class TypeMatchupGroup
    {
        public string Label { get; set; }       // "×2"
        public string Description { get; set; } // "Débil"
        public string Css { get; set; }
        public IReadOnlyList<TypeInfo> Types { get; set; }
    }

    public class EvolutionMember
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string ImageUrl { get; set; }
        public string Condition { get; set; }
        public bool IsCurrent { get; set; }
    }

    public class PokedexNeighbor
    {
        public int Id { get; set; }
        public string Name { get; set; }

        public string Number
        {
            get { return Id.ToString("0000"); }
        }
    }

    public class PokemonDetailViewModel
    {
        public int Id { get; set; }
        public string Slug { get; set; }
        public string Name { get; set; }
        public string Genus { get; set; }
        public string Description { get; set; }
        public IReadOnlyList<TypeInfo> Types { get; set; }

        public decimal HeightMeters { get; set; }
        public decimal WeightKg { get; set; }
        public int? BaseExperience { get; set; }
        public int CaptureRate { get; set; }
        public string Habitat { get; set; }
        public GenerationInfo Generation { get; set; }
        public bool IsLegendary { get; set; }
        public bool IsMythical { get; set; }
        public bool IsBaby { get; set; }

        public string ArtworkUrl { get; set; }
        public string ArtworkShinyUrl { get; set; }
        public string CryUrl { get; set; }

        public IReadOnlyList<StatItem> Stats { get; set; }
        public IReadOnlyList<AbilityItem> Abilities { get; set; }
        public IReadOnlyList<TypeMatchupGroup> Matchups { get; set; }
        public IReadOnlyList<IReadOnlyList<EvolutionMember>> EvolutionStages { get; set; }

        public PokedexNeighbor Previous { get; set; }
        public PokedexNeighbor Next { get; set; }

        public string Number
        {
            get { return Id.ToString("0000"); }
        }

        public string PrimaryType
        {
            get { return Types.Count > 0 ? Types[0].Key : "normal"; }
        }

        public int StatTotal
        {
            get
            {
                var total = 0;
                foreach (var s in Stats) total += s.Value;
                return total;
            }
        }
    }
}
