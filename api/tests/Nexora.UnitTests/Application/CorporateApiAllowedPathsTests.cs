using Nexora.Application.Features.CorporateProxy;
using Xunit;

namespace Nexora.UnitTests.Application;

/// <summary>
/// GUVENLIK-YOL-HARITASI.md madde 2: bu allowlist, proxy'nin serbest bir
/// passthrough olmamasını sağlayan TEK kontrol noktasıdır. Burada bir hata
/// (ör. çok geniş bir prefix eşleşmesi) doğrudan kurumsal API'nin ileride
/// eklenebilecek bir yazma/yönetim ucuna erişim açar.
/// </summary>
public class CorporateApiAllowedPathsTests
{
    [Theory]
    [InlineData("announcements")]
    [InlineData("app-sliders")]
    [InlineData("directorates")]
    [InlineData("facilities")]
    [InlineData("municipal/contact")]
    [InlineData("municipal/events")]
    [InlineData("municipal/neighborhoods")]
    [InlineData("municipal/popup")]
    [InlineData("municipal/president/contents")]
    [InlineData("municipal/president/gallery")]
    [InlineData("municipal/president/general-information")]
    [InlineData("municipal/references")]
    [InlineData("navigation/banner")]
    [InlineData("navigation/banner-slider")]
    [InlineData("navigation/banners")]
    [InlineData("navigation/fast-menu")]
    [InlineData("navigation/menu")]
    [InlineData("news")]
    [InlineData("organization/chart")]
    [InlineData("organization/council-members")]
    [InlineData("organization/municipal-councils")]
    [InlineData("organization/vice-presidents")]
    [InlineData("projects")]
    [InlineData("services")]
    [InlineData("services/categories")]
    [InlineData("sultangazi/city-guide-categories")]
    [InlineData("sultangazi/city-guides")]
    public void MobilUygulamaninKullandigiTum27Yol_Izinli(string path)
    {
        Assert.True(CorporateApiAllowedPaths.IsAllowed(path));
    }

    [Theory]
    [InlineData("projects/1")]
    [InlineData("projects/42")]
    [InlineData("organization/vice-presidents/1")]
    [InlineData("organization/vice-presidents/999")]
    public void NumarikDetayYollari_Izinli(string path)
    {
        Assert.True(CorporateApiAllowedPaths.IsAllowed(path));
    }

    [Theory]
    [InlineData("auth/token", "secret alan uc asla proxy'lenmemeli")]
    [InlineData("auth/refresh", "secret alan uc asla proxy'lenmemeli")]
    [InlineData("auth/revoke", "yonetim ucu")]
    [InlineData("admin/users", "var olmayan ama varsayimsal yonetim ucu")]
    [InlineData("organization/municipal-councils/1", "listede olmayan detay yolu")]
    [InlineData("projects/1/delete", "id sonrasi ekstra segment sizmamali")]
    [InlineData("projects/abc", "rakam olmayan id reddedilmeli")]
    [InlineData("projects/1x", "kismen rakam id reddedilmeli")]
    [InlineData("projects/1/../../auth/token", "path traversal denemesi")]
    [InlineData("PROJECTS", "buyuk/kucuk harf farkli yol izinli olmamali")]
    [InlineData("", "bos yol")]
    [InlineData("news/../auth/token", "prefix sonrasi traversal")]
    public void AllowlistDisiYollar_Reddedilir(string path, string _)
    {
        Assert.False(CorporateApiAllowedPaths.IsAllowed(path));
    }

    [Fact]
    public void BasindaSonundaSlashOlanYol_Normalize_Edilir()
    {
        Assert.True(CorporateApiAllowedPaths.IsAllowed("/news/"));
        Assert.True(CorporateApiAllowedPaths.IsAllowed("news"));
    }
}
