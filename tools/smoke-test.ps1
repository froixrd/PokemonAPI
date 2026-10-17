# Prueba de humo contra la PokeAPI real.
# 1) Carga la DLL compilada y comprueba que el servicio entiende las respuestas de la API.
# 2) Si hay IIS Express, levanta la web y pide las páginas principales.
param(
    [string]$Project = (Join-Path $PSScriptRoot "..\WebApplication3")
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Project = (Resolve-Path $Project).Path
$bin = Join-Path $Project "bin"
$failures = New-Object System.Collections.Generic.List[string]
$results = New-Object System.Collections.Generic.List[string]
$ci = $env:GITHUB_ACTIONS -eq "true"

# En GitHub Actions los resultados también salen como anotaciones, visibles sin abrir el log.
function Annotate([string]$level, [string]$text) {
    if ($ci) { Write-Host ("::" + $level + "::" + ($text -replace "%", "%25" -replace "`r", "" -replace "`n", "%0A")) }
}

trap {
    Annotate "error" ("Excepción en la prueba: " + $_.Exception.ToString() + " en " + $_.InvocationInfo.PositionMessage)
    Write-Host $_.Exception.ToString() -ForegroundColor Red
    exit 1
}

function Check([bool]$condition, [string]$message) {
    if ($condition) { Write-Host "  OK   $message"; $results.Add("OK    $message") }
    else {
        Write-Host "  FALLO $message" -ForegroundColor Red
        $failures.Add($message)
        $results.Add("FALLO $message")
        Annotate "error" "FALLO $message"
    }
}

function Await($task) { return $task.GetAwaiter().GetResult() }

Write-Host "== Servicio (DLL) contra PokeAPI =="
Add-Type -AssemblyName System.Runtime.Caching
[Reflection.Assembly]::LoadFrom((Join-Path $bin "Newtonsoft.Json.dll")) | Out-Null
[Reflection.Assembly]::LoadFrom((Join-Path $bin "WebApplication3.dll")) | Out-Null

$svc = New-Object WebApplication3.Services.PokemonService

$dex = Await $svc.GetPokedexAsync()
Check ($dex.Entries.Count -ge 1025) "Listado con $($dex.Entries.Count) especies"
$charizard = $dex.Entries | Where-Object { $_.Id -eq 6 }
Check (($charizard.Types -join ",") -eq "fire,flying") "Tipos de Charizard en el listado: $($charizard.Types -join ',')"
Check ($dex.TypeNames["fire"] -eq "Fuego") "Nombre de tipo en español: $($dex.TypeNames['fire'])"
$sinTipo = @($dex.Entries | Where-Object { $_.Types.Count -eq 0 }).Count
Check ($sinTipo -eq 0) "Especies sin tipo: $sinTipo"

$d = Await $svc.GetDetailAsync(6)
Check ($d.Name -eq "Charizard") "Ficha 6: nombre $($d.Name)"
Check (-not [string]::IsNullOrEmpty($d.Genus)) "Categoría: $($d.Genus)"
Check (-not [string]::IsNullOrEmpty($d.Description)) "Descripción: $($d.Description)"
Check ($d.Stats.Count -eq 6 -and $d.StatTotal -eq 534) "Estadísticas: $($d.Stats.Count), total $($d.StatTotal)"
Check ($d.Abilities.Count -ge 2) "Habilidades: $(($d.Abilities | ForEach-Object { $_.Name }) -join ', ')"
Check ($d.EvolutionStages.Count -eq 3) "Etapas evolutivas: $($d.EvolutionStages.Count)"
Check ($d.EvolutionStages[1][0].Condition -eq "Nivel 16") "Condición Charmeleon: $($d.EvolutionStages[1][0].Condition)"
Check (-not [string]::IsNullOrEmpty($d.ArtworkUrl) -and -not [string]::IsNullOrEmpty($d.ArtworkShinyUrl)) "Ilustraciones normal y variocolor"
Check (-not [string]::IsNullOrEmpty($d.CryUrl)) "Grito: $($d.CryUrl)"
$x4 = $d.Matchups | Where-Object { $_.Css -eq "x4" }
Check ($x4 -ne $null -and ($x4.Types | ForEach-Object { $_.Key }) -contains "rock") "Debilidad x4 a Roca"
Check ($d.Previous.Id -eq 5 -and $d.Next.Id -eq 7) "Anterior/siguiente: $($d.Previous.Name) / $($d.Next.Name)"

$eevee = Await $svc.GetDetailAsync(133)
Check ($eevee.EvolutionStages[1].Count -ge 8) "Eevee: $($eevee.EvolutionStages[1].Count) evoluciones"
$condiciones = ($eevee.EvolutionStages[1] | ForEach-Object { "$($_.Name): $($_.Condition)" }) -join " | "
Check (@($eevee.EvolutionStages[1] | Where-Object { [string]::IsNullOrEmpty($_.Condition) }).Count -eq 0) "Condiciones: $condiciones"

$last = Await $svc.GetDetailAsync($dex.Entries[$dex.Entries.Count - 1].Id)
Check ($last.Next -eq $null) "Última especie ($($last.Name)) sin siguiente"

$err = $null
try { Await $svc.GetDetailAsync(99999) | Out-Null } catch { $err = $_.Exception }
while ($err -ne $null -and -not ($err -is [WebApplication3.Services.PokeApiNotFoundException])) { $err = $err.InnerException }
Check ($err -ne $null) "99999 da PokeApiNotFoundException"

$found = Await $svc.FindIdByNameAsync("pikachu")
Check ($found -eq 25) "Buscar por nombre: pikachu -> $found"

$iis = Join-Path ${env:ProgramFiles} "IIS Express\iisexpress.exe"
if (Test-Path $iis) {
    Write-Host "== Web completa en IIS Express =="
    $port = 8080
    $proc = Start-Process $iis -ArgumentList "/path:`"$Project`"", "/port:$port", "/systray:false" -PassThru -WindowStyle Hidden
    try {
        $base = "http://localhost:$port"
        function Get-Page($path) {
            $req = [Net.HttpWebRequest]::Create("$base$path")
            $req.AllowAutoRedirect = $false
            $req.Timeout = 120000
            try { $resp = $req.GetResponse() }
            catch {
                $ex = $_.Exception
                while ($ex -ne $null -and -not ($ex -is [Net.WebException])) { $ex = $ex.InnerException }
                if ($ex -ne $null -and $ex.Response -ne $null) { $resp = $ex.Response } else { throw }
            }
            $reader = New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $reader.Close()
            $status = [int]$resp.StatusCode
            $resp.Close()
            return [pscustomobject]@{ Status = $status; Content = $body }
        }

        $ready = $false
        for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
            Start-Sleep -Seconds 2
            try { $ready = (Get-Page "/home/about").Status -eq 200 } catch { }
        }
        Check $ready "La web arranca"

        $portada = Get-Page "/"
        Check ($portada.Status -eq 200 -and $portada.Content -match "dex-card" -and $portada.Content -match "Charizard") "Portada 200 con tarjetas"
        Check ($portada.Content.Contains("Pokédex Nacional") -and $portada.Content.Contains("Generación")) "Portada con acentos correctos (UTF-8)"
        $p = Get-Page "/pokemon/25"
        $i = $p.Content.IndexOf("h-stats")
        $fragment = if ($i -ge 0) { $p.Content.Substring($i, [Math]::Min(60, $p.Content.Length - $i)) } else { "(sin h-stats)" }
        Check ($p.Status -eq 200) "Ficha /pokemon/25 responde ($($p.Status))"
        Check ($p.Content -match "Pikachu") "Ficha /pokemon/25 muestra a Pikachu"
        Check ($p.Content.Contains("Estadísticas base")) "Ficha /pokemon/25 con estadísticas: $fragment"
        $p = Get-Page "/pokemon/133"
        Check ($p.Status -eq 200 -and $p.Content -match "Vaporeon") "Ficha /pokemon/133 con evoluciones"
        $r = Get-Page "/pokemon/pikachu"
        Check ($r.Status -eq 301) "/pokemon/pikachu redirige ($($r.Status))"
        $n = Get-Page "/pokemon/99999"
        Check ($n.Status -eq 404) "/pokemon/99999 da 404 ($($n.Status))"
        $css = Get-Page "/Content/css"
        Check ($css.Status -eq 200) "CSS servido"
    }
    finally {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "IIS Express no está instalado: se omite la prueba de la web completa."
}

Annotate "notice" ("Resultados de la prueba:`n" + ($results -join "`n"))

if ($failures.Count -gt 0) {
    Write-Host "`n$($failures.Count) comprobaciones fallidas." -ForegroundColor Red
    exit 1
}
Write-Host "`nTodo correcto."
