using System.Collections.Generic;

namespace WebApplication3.Models
{
    public class Pokemon
    {
        public string Name { get; set; }
        public int Order { get; set; }
        public List<object> PastAbilities { get; set; } // La lista de habilidades pasadas es de tipo object, ya que no se proporciona un tipo específico en los datos del API
        public List<object> PastTypes { get; set; } // La lista de tipos pasados es de tipo object, ya que no se proporciona un tipo específico en los datos del API
        public Species Species { get; set; }
        public Sprites Sprites { get; set; }
        public List<Stats> Stats { get; set; }
        public List<Types> Types { get; set; }
        public int Weight { get; set; }
    }

    public class Species
    {
        public string Name { get; set; }
        public string Url { get; set; }
    }

    public class Sprites
    {
        public string BackDefault { get; set; }
        public object BackFemale { get; set; }
        public string BackShiny { get; set; }
        public object BackShinyFemale { get; set; }
        public string FrontDefault { get; set; }
        public object FrontFemale { get; set; }
        public string FrontShiny { get; set; }
        public object FrontShinyFemale { get; set; }
        public Other Other { get; set; }
        public Versions Versions { get; set; }
    }

    public class Other
    {
        public DreamWorld DreamWorld { get; set; }
        public Home Home { get; set; }
        public OfficialArtwork OfficialArtwork { get; set; }
        public Showdown Showdown { get; set; }
    }

    public class DreamWorld
    {
        public string FrontDefault { get; set; }
        public object FrontFemale { get; set; }
    }

    public class Home
    {
        public string FrontDefault { get; set; }
        public object FrontFemale { get; set; }
        public string FrontShiny { get; set; }
        public object FrontShinyFemale { get; set; }
    }

    public class OfficialArtwork
    {
        public string FrontDefault { get; set; }
        public string FrontShiny { get; set; }
    }

    public class Showdown
    {
        public string BackDefault { get; set; }
        public object BackFemale { get; set; }
        public string BackShiny { get; set; }
        public object BackShinyFemale { get; set; }
        public string FrontDefault { get; set; }
        public object FrontFemale { get; set; }
        public string FrontShiny { get; set; }
        public object FrontShinyFemale { get; set; }
    }

    public class Versions
    {
        // Propiedades para las diferentes generaciones de juegos de Pokémon
    }

    public class Stats
    {
        public int BaseStat { get; set; }
        public int Effort { get; set; }
        public Stat Stat { get; set; }
    }

    public class Stat
    {
        public string Name { get; set; }
        public string Url { get; set; }
    }

    public class Types
    {
        public int Slot { get; set; }
        public Type Type { get; set; }
    }

    public class Type
    {
        public string Name { get; set; }
        public string Url { get; set; }
    }
}
