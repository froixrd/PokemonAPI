using System.Web.Optimization;

namespace WebApplication3
{
    public class BundleConfig
    {
        public static void RegisterBundles(BundleCollection bundles)
        {
            // Se usa Bundle (sin minificar) a propósito: el minificador de WebGrease no entiende
            // JavaScript moderno (const, flechas) ni CSS actual (custom properties, color-mix).
            // En Release se sigue sirviendo con hash de versión para la caché del navegador.
            bundles.Add(new Bundle("~/bundles/app").Include("~/Scripts/app.js"));
            bundles.Add(new Bundle("~/Content/css").Include("~/Content/Site.css"));

            // Siempre con hash en la URL: así el navegador puede cachear sin servir CSS/JS viejos.
            BundleTable.EnableOptimizations = true;
        }
    }
}
