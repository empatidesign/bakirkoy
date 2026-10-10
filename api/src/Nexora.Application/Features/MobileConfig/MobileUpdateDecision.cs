using Nexora.Application.Common;
using Nexora.Domain.Enums;

namespace Nexora.Application.Features.MobileConfig;

/// <summary>
/// Sürüm karşılaştırmasının saf (yan etkisiz) karar mantığı. Servisten ayrı
/// tutulur çünkü buradaki bir hata kullanıcıyı uygulamadan tamamen kilitler;
/// doğrudan test edilebilir olması gerekir.
/// </summary>
public static class MobileUpdateDecision
{
    /// <summary>
    /// İstemci sürümüne göre güncelleme kararını verir.
    ///
    /// Belirsizlikte ZORLAMA YAPILMAZ: platformu veya sürümü ayrıştırılamayan
    /// bir istemciyi store'a kilitlemek, sunucunun tanımadığı her istemciyi
    /// (yeni platform, bozuk header) kullanılamaz hale getirirdi. Gerçekten
    /// her istemciyi durdurmak gerekiyorsa webview kill-switch kullanılır.
    /// </summary>
    public static MobileUpdateStatus Evaluate(string? clientVersion, string? minVersion, string? latestVersion)
    {
        if (!SemanticVersion.TryParse(clientVersion, out _))
            return MobileUpdateStatus.UpToDate;

        if (IsStrictlyBelow(clientVersion, minVersion))
            return MobileUpdateStatus.ForceUpdate;

        if (IsStrictlyBelow(clientVersion, latestVersion))
            return MobileUpdateStatus.OptionalUpdate;

        return MobileUpdateStatus.UpToDate;
    }

    /// <summary>
    /// version &lt; other. IsAtMost eşitliği de kapsadığı için ters yön ile ayıklanır:
    /// sürümü tam olarak eşleşen kullanıcıya güncelleme gösterilmemelidir.
    /// </summary>
    private static bool IsStrictlyBelow(string? version, string? other)
        => SemanticVersion.TryParse(other, out _)
            && SemanticVersion.IsAtMost(version, other)
            && !SemanticVersion.IsAtMost(other, version);
}
