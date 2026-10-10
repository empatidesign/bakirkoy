using System.Text.RegularExpressions;
using Xunit;

namespace Nexora.UnitTests.Application;

public class EndpointPermissionCoverageTests
{
    private static readonly string[] SelfScopedFiles =
    [
        "ParticipantAuthEndpoints.cs",
        "CompanyAuthEndpoints.cs",
        "MePresenceEndpoints.cs",
        "MeTeamEndpoints.cs",
        "LibraryMesaiEndpoints.cs",
        "DevTestEndpoints.cs",
    ];

    private static readonly string[] SelfScopedRoutes =
    [
        "/histories",
        "/histories/{id:guid}",
        "/check-in",
        "/welcome-bonus/consume",
        "/rewards/redeem",
        "/redemptions/{id:guid}/claim",
        "/webaccess",
        // Kullanıcı isteği (2026-09-07): "muhtar yönetimi sayfasında bypass ederek girsin" —
        // AuthEndpoints.cs'e eklenen bypass-code ucu ilk kez "AdminOrAbove" metnini bu dosyaya
        // taşıdı, bu da testin dosya-seviyesi taramasını (source.Contains("AdminOrAbove"))
        // tetikleyip dosyadaki ÖNCEDEN VAR OLAN kimlik-bazlı ("me/self") uçları da işaretledi.
        // Bu dört uç RequirePermission taşımaz çünkü zaten currentUser.Id'ye göre kendi
        // kaydını değiştirir — izin kontrolüne değil kimlik doğrulamaya dayanır.
        "/logout",
        "/change-initial-password",
        "/profile",
        "/change-password",
        // Both endpoints resolve the caller from ICurrentUser; neither accepts another user ID.
        "/streak-modal/acknowledge",
        "/request-otp",
    ];

    private static string EndpointsRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "src", "Nexora.Api")))
            dir = dir.Parent;
        Assert.NotNull(dir);
        return Path.Combine(dir!.FullName, "src", "Nexora.Api", "Endpoints");
    }

    private static string ExtractCall(string source, int start)
    {
        var i = source.IndexOf('(', start);
        if (i < 0) return string.Empty;
        var depth = 0;
        for (; i < source.Length; i++)
        {
            if (source[i] == '(') depth++;
            else if (source[i] == ')')
            {
                depth--;
                if (depth == 0) break;
            }
        }
        var end = source.IndexOf(';', Math.Min(i, source.Length - 1));
        return source[start..(end > 0 ? end : Math.Min(i + 1, source.Length))];
    }

    [Fact]
    public void AdminOrAbove_yazma_uclarinin_hepsi_RequirePermission_tasimali()
    {
        var root = EndpointsRoot();
        Assert.True(Directory.Exists(root), $"Endpoints dizini bulunamadı: {root}");

        var unprotected = new List<string>();

        foreach (var file in Directory.EnumerateFiles(root, "*.cs", SearchOption.AllDirectories))
        {
            var name = Path.GetFileName(file);
            if (SelfScopedFiles.Contains(name)) continue;

            var source = File.ReadAllText(file);
            if (!source.Contains("AdminOrAbove")) continue;

            foreach (Match m in Regex.Matches(source, @"\.Map(Post|Put|Patch|Delete)\("))
            {
                var chunk = ExtractCall(source, m.Index);
                if (chunk.Contains("RequirePermission") || chunk.Contains("RequireAnyPermission")) continue;
                if (chunk.Contains("AllowAnonymous")) continue;

                var route = Regex.Match(chunk, "\\.Map\\w+\\(\\s*\"([^\"]*)\"");
                var routeValue = route.Success ? route.Groups[1].Value : "?";
                if (SelfScopedRoutes.Contains(routeValue)) continue;

                var line = source[..m.Index].Count(c => c == '\n') + 1;
                unprotected.Add($"{name}:{line} .Map{m.Groups[1].Value}(\"{routeValue}\")");
            }
        }

        Assert.True(unprotected.Count == 0,
            "PermissionEnforcementMiddleware fail-open çalışır: RequirePermission taşımayan bir yazma ucu " +
            "403 yerine 200 döner. Aşağıdaki uçlara izin kontrolü eklenmeli (kimlik-bazlı korunan 'me/self' " +
            "uçlarıysa test başındaki beyaz listeye alınmalı):\n  " + string.Join("\n  ", unprotected));
    }
}
