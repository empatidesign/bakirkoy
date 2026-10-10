using System.Text.RegularExpressions;
using Xunit;

namespace Nexora.UnitTests.Application;

public class ReviewWindowParityTests
{
    private static string ServicesRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "src", "Nexora.Infrastructure")))
            dir = dir.Parent;
        return Path.Combine(dir!.FullName, "src", "Nexora.Infrastructure", "Services");
    }

    private static string Read(string fileName)
    {
        var path = Path.Combine(ServicesRoot(), fileName);
        Assert.True(File.Exists(path), $"Kaynak dosya bulunamadı: {path}");
        return File.ReadAllText(path);
    }

    private static string DefaultFor(string source, string key)
    {
        var m = Regex.Match(source, $@"GetValue\(""ReviewSettings:{key}"",\s*(\d+)\)");
        Assert.True(m.Success, $"{key} için GetValue varsayılanı bulunamadı.");
        return m.Groups[1].Value;
    }

    [Theory]
    [InlineData("EventWindowDays")]
    [InlineData("TravelWindowDays")]
    public void HistoryService_ve_ReviewService_ayni_pencere_varsayilanini_kullanir(string key)
    {
        var history = Read("HistoryService.cs");
        var review = Read("ReviewService.cs");

        Assert.Equal(DefaultFor(review, key), DefaultFor(history, key));
    }

    [Fact]
    public void HistoryService_seansli_etkinlikte_pencereyi_seans_tarihinden_DEGIL_EndDate_uzerinden_olcer()
    {
        var history = Read("HistoryService.cs");

        Assert.DoesNotContain("daysSinceSession", history);
        Assert.Contains("var eventEnded = ev.EndDate < now;", history);
        Assert.Contains("eventEnded && (now - ev.EndDate).TotalDays <= EventWindowDays", history);
    }
}
