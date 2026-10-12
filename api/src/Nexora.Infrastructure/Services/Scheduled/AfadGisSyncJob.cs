using System.Globalization;
using Hangfire;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Configuration;
using Nexora.Application.Features.EmergencyAreas;
using Nexora.Domain.Entities.EmergencyAreas;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface IAfadGisSyncJob
{
    Task RunAsync(CancellationToken ct);
    Task<AfadGisSyncResultDto> SyncAsync(CancellationToken ct);
    Task<AfadGisSyncStatusDto> GetStatusAsync(CancellationToken ct);
}

/// AFAD toplanma alanlarını Netcad GIS servisinden (ext_afad_3.servis) Nexora acil toplanma alanlarına aktarır.
/// Kurallar:
/// - Eşleştirme anahtarı ext_afad_3.objectid (ExternalSource="AFAD_GIS", ExternalId=objectid).
/// - GIS kaynaklı alanlar (ad, mahalle, adres, konum, kapasite, m²) yalnızca serviste değer varsa güncellenir.
/// - Panelden yönetilen alanlara (sorumlu, donanım, acil telefon, açıklama, durum) dokunulmaz.
/// - Serviste artık bulunmayan kayıtlar silinmez, pasife alınır. Panelden silinen kayıt geri getirilmez.
/// - Servis hata verir veya boş liste dönerse mevcut veri korunur.
[DisableConcurrentExecution(timeoutInSeconds: 600)]
public class AfadGisSyncJob(
    IUnitOfWork uow,
    IAfadGisClient client,
    IAuditService audit,
    IOptionsMonitor<AfadGisSettings> options,
    ILogger<AfadGisSyncJob> logger) : IAfadGisSyncJob
{
    public const string Source = "AFAD_GIS";

    public async Task RunAsync(CancellationToken ct)
    {
        if (!options.CurrentValue.IsConfigured) return;
        await SyncAsync(ct);
    }

    public async Task<AfadGisSyncStatusDto> GetStatusAsync(CancellationToken ct)
    {
        var synced = await uow.EmergencyAreas.FindAsync(x => x.ExternalSource == Source, ct);
        return new AfadGisSyncStatusDto(
            options.CurrentValue.IsConfigured,
            synced.Count == 0 ? null : synced.Max(x => x.ExternalSyncedAt),
            synced.Count);
    }

    public async Task<AfadGisSyncResultDto> SyncAsync(CancellationToken ct)
    {
        IReadOnlyList<AfadGisAreaItem> items;
        try
        {
            items = await client.FetchAllAsync(ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            // HttpClient zaman aşımı TaskCanceledException fırlatır; istek iptali değilse normal hata sayılır.
            logger.LogError(ex, "AFAD GIS toplanma alanı senkronizasyonu başarısız oldu.");
            var message = ex is TaskCanceledException
                ? "AFAD GIS servisine bağlantı zaman aşımına uğradı (sunucu bu ağdan erişilemiyor olabilir)."
                : ex.Message;
            return new AfadGisSyncResultDto(false, 0, 0, 0, 0, message);
        }

        if (items.Count == 0)
        {
            logger.LogWarning("AFAD GIS servisi boş liste döndürdü, mevcut veri korunuyor.");
            return new AfadGisSyncResultDto(false, 0, 0, 0, 0, "Servis boş liste döndürdü, mevcut veri korundu.");
        }

        var now = DateTime.UtcNow;
        var existing = (await uow.EmergencyAreas.FindIncludingDeletedAsync(x => x.ExternalSource == Source, ct))
            .Where(x => x.ExternalId.HasValue)
            .GroupBy(x => x.ExternalId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.IsDeleted).First());

        int created = 0, updated = 0, removed = 0;
        foreach (var item in items)
        {
            if (existing.TryGetValue(item.ObjectId, out var area))
            {
                if (area.IsDeleted) continue; // panelden bilinçli silinmiş
                Apply(area, item, isNew: false);
                area.MarkSynced(Source, item.ObjectId, now);
                uow.EmergencyAreas.Update(area);
                updated++;
            }
            else
            {
                area = EmergencyArea.Create(Fit(BuildName(item), 200), ResolveNeighborhood(item.Neighborhood), "-");
                Apply(area, item, isNew: true);
                area.MarkSynced(Source, item.ObjectId, now);
                await uow.EmergencyAreas.AddAsync(area, ct);
                created++;
            }
        }

        var fetchedIds = items.Select(i => i.ObjectId).ToHashSet();
        foreach (var stale in existing.Values.Where(x => !x.IsDeleted && x.Status == EmergencyAreaStatus.Active && !fetchedIds.Contains(x.ExternalId!.Value)))
        {
            stale.SetStatus(EmergencyAreaStatus.Passive);
            uow.EmergencyAreas.Update(stale);
            removed++;
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Import,
            EntityType = "EmergencyArea",
            Module = "EmergencyAreas",
            Description = $"AFAD GIS senkronizasyonu: {items.Count} kayıt okundu, {created} yeni, {updated} güncellendi, {removed} pasife alındı.",
        }, ct);

        logger.LogInformation(
            "AFAD GIS senkronizasyonu tamamlandı: {Fetched} okundu, {Created} yeni, {Updated} güncellendi, {Removed} pasife alındı.",
            items.Count, created, updated, removed);

        return new AfadGisSyncResultDto(true, items.Count, created, updated, removed, null);
    }

    private static void Apply(EmergencyArea area, AfadGisAreaItem item, bool isNew)
    {
        var name = !string.IsNullOrWhiteSpace(item.Name) ? Fit(item.Name, 200) : area.Name;
        var neighborhood = !string.IsNullOrWhiteSpace(item.Neighborhood) ? ResolveNeighborhood(item.Neighborhood) : area.Neighborhood;
        // Gerçek servis (ext_afad_3) yalnızca ad + poligon döndürüyor; adres yoksa "Belirtilmemiş" yerine ilçe yazılır.
        var address = !string.IsNullOrWhiteSpace(item.Address)
            ? Fit(item.Address, 500)
            : isNew || string.IsNullOrWhiteSpace(area.Address) || area.Address is "-" or "Belirtilmemiş"
                ? (neighborhood == "Belirtilmemiş" ? "Bakırköy / İstanbul" : Fit($"{neighborhood}, Bakırköy / İstanbul", 500))
                : area.Address;
        var hasPoint = item.Latitude.HasValue && item.Longitude.HasValue;

        area.SetBasics(
            name,
            neighborhood,
            address,
            hasPoint ? Math.Round(item.Latitude!.Value, 7) : area.Latitude,
            hasPoint ? Math.Round(item.Longitude!.Value, 7) : area.Longitude,
            item.Capacity is > 0 ? item.Capacity.Value : area.Capacity,
            item.AreaSizeM2 is > 0 ? item.AreaSizeM2.Value : area.AreaSizeM2,
            area.Description);
    }

    private static string BuildName(AfadGisAreaItem item)
        => !string.IsNullOrWhiteSpace(item.Name) ? item.Name! : $"AFAD Toplanma Alanı #{item.ObjectId}";

    /// GIS mahalle değerini ("GAZİ MAH.", "Gazi", "gazi mahallesi") sistemdeki standart adla ("Gazi Mahallesi") eşler.
    internal static string ResolveNeighborhood(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "Belirtilmemiş";
        var key = NeighborhoodKey(raw);
        var match = BakirkoyNeighborhoods.Names.FirstOrDefault(n => NeighborhoodKey(n) == key);
        return match ?? Fit(TitleCase(raw.Trim()), 150);
    }

    private static readonly CultureInfo Tr = new("tr-TR");

    private static string NeighborhoodKey(string s)
    {
        var lower = s.Trim().ToLower(Tr);
        foreach (var suffix in new[] { "mahallesi", "mahalle", "mah.", "mah", "mh.", "mh" })
            if (lower.EndsWith(suffix)) { lower = lower[..^suffix.Length]; break; }
        return new string(lower.Where(char.IsLetterOrDigit).ToArray());
    }

    private static string TitleCase(string s) => Tr.TextInfo.ToTitleCase(s.ToLower(Tr));

    private static string Fit(string s, int max) => s.Length > max ? s[..max] : s;
}
