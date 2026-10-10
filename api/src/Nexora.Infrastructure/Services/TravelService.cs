using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;
using Nexora.Domain.Common;

namespace Nexora.Infrastructure.Services;

public class TravelService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IUserScopeService userScope,
    IScopedStaffService scopedStaff,
    IServiceProvider serviceProvider,
    IOptionsMonitor<MinioSettings> minioOptions,
    IAuditService audit,
    IActivityLogger log) : ITravelService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<PagedResult<TravelDto>> GetPagedAsync(TravelListParams p, CancellationToken ct)
    {
        var scopedRefIds = currentUser.Id is Guid uid
            ? await userScope.GetScopedRefIdsAsync(uid, "travels", ct)
            : null;
        return await MapPageAsync(await uow.Travels.GetPagedAsync(p, scopedRefIds, ct), ct);
    }

    public async Task<PagedResult<TravelDto>> GetTrashAsync(TravelListParams p, CancellationToken ct)
    {
        var scopedRefIds = currentUser.Id is Guid uid
            ? await userScope.GetScopedRefIdsAsync(uid, "travels", ct)
            : null;

        var paged = await uow.Travels.GetTrashAsync(p, ct);
        if (scopedRefIds is null) return await MapPageAsync(paged, ct);

        var filtered = paged.Items.Where(t => scopedRefIds.Contains(t.Id)).ToList();
        return await MapPageAsync(new PagedResult<Travel> { Items = filtered, Total = filtered.Count, Page = paged.Page, Limit = paged.Limit }, ct);
    }

    public async Task<TravelSummaryDto> GetSummaryAsync(Guid? routeId, CancellationToken ct)
    {
        var (total, active, registered, capacity, heldToDate, upcoming) = await uow.Travels.GetSummaryAsync(routeId, ct);
        var (avgRating, totalReviews) = await uow.Travels.GetRatingSummaryAsync(routeId, ct);
        // Kullanıcı isteği (2026-08-07): routeId verilmemişse (Geziler ana sayfası) toplam
        // rota (Gezi) sayısı da gösterilsin; bir gruba özel bakılırken (routeId varsa) bu
        // alan anlamsız olduğu için 1 döner (o tek grup).
        var totalRoutes = routeId.HasValue ? 1 : await uow.TravelRoutes.CountAsync(null, ct);
        return new TravelSummaryDto(total, active, total - active, registered, capacity, totalRoutes, avgRating, totalReviews, heldToDate, upcoming);
    }

    public async Task<TravelDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var t = await uow.Travels.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);
        return await ToDtoAsync(t, ct);
    }

    public async Task<List<TravelOptionDto>> GetOptionsAsync(string? search, bool includeInactive, CancellationToken ct)
    {
        var items = await uow.Travels.GetOptionsAsync(search, includeInactive, ct);
        return items.Select(t => new TravelOptionDto(t.Id, t.Name, t.Destination, t.Code, t.StartDate, t.EndDate)).ToList();
    }

    public async Task<TravelDto> CreateAsync(TravelFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.RouteId });

        var route = await uow.TravelRoutes.GetByIdAsync(req.RouteId, ct)
            ?? throw new NotFoundException("Gezi (rota) bulunamadı.", "TRAVEL_ROUTE_NOT_FOUND");

        if (TurkeyTime.ToTurkey(req.StartDate).Date < TurkeyTime.TodayDate())
            throw new ConflictException("Geçmiş tarihli gezi oluşturulamaz.", "PAST_DATE");

        await EnsureCrewAvailableAsync(req.Crew, req.StartDate, req.EndDate, null, ct);

        var code = $"GEZ-{await uow.Travels.NextCodeNumberAsync(ct):D6}";
        var travel = Travel.Create(ToData(req, route), code, currentUser.Name);

        await uow.Travels.AddAsync(travel, ct);
        await uow.SaveChangesAsync(ct);

        await GrantGuideAccessAsync(travel, req.Crew, ct);

        await AssignBusesAsync(travel, req.BusIds, ct);
        await uow.SaveChangesAsync(ct);

        return await ToDtoAsync(travel, ct);
    }

    // Yetki alani (scope) kisitli bir kullanicinin, kendi liste ekraninda gormedigi
    // bir gezinin ID'sini biliyorsa bile erismesini engeller (IDOR onlemi).
    private async Task EnsureInScopeAsync(Guid id, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, "travels", ct);
        if (scopedRefIds is not null && !scopedRefIds.Contains(id))
            throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
    }

    public async Task<TravelDto> UpdateAsync(Guid id, TravelFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var travel = await uow.Travels.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var route = await uow.TravelRoutes.GetByIdAsync(req.RouteId, ct)
            ?? throw new NotFoundException("Gezi (rota) bulunamadı.", "TRAVEL_ROUTE_NOT_FOUND");

        if (travel.IsActive)
        {
            var currentBusIds = (await uow.TravelBuses.GetByTravelAsync(id, ct)).Select(b => b.Id).OrderBy(x => x).ToList();
            var newBusIds = (req.BusIds ?? []).Distinct().OrderBy(x => x).ToList();
            if (!currentBusIds.SequenceEqual(newBusIds))
                throw new ConflictException("Yayınlanmış gezinin otobüsü değiştirilemez. Önce geziyi pasife alın.", "BUS_LOCKED_PUBLISHED");
        }

        await EnsureCrewAvailableAsync(req.Crew, req.StartDate, req.EndDate, id, ct);

        travel.Update(ToData(req, route), currentUser.Name);
        uow.Travels.Update(travel);
        await uow.SaveChangesAsync(ct);

        await GrantGuideAccessAsync(travel, req.Crew, ct);

        await AssignBusesAsync(travel, req.BusIds, ct);
        await uow.SaveChangesAsync(ct);

        return await ToDtoAsync(travel, ct);
    }

    private async Task AssignBusesAsync(Travel travel, List<Guid>? busIds, CancellationToken ct)
    {
        var ids = (busIds ?? []).Distinct().ToList();

        // Kullanıcı bulgusu (2026-08-07): admin panel formu (TravelForm.tsx) zaten birden
        // fazla araç seçimine izin veriyor ("Birden fazla araç seçebilirsiniz; kontenjan
        // seçili araçların açık kontenjan toplamını aşamaz" ipucu, çoklu RemovableTag listesi)
        // ama backend hâlâ eski "tek araç" kısıtını (TRAVEL_SINGLE_BUS_ONLY) uyguluyordu —
        // ikinci bir araç eklenip kaydedilince kaydetme her zaman bu hatayla başarısız
        // oluyordu. Kısıt kaldırıldı; sistem yalnızca toplam kontenjan/koltuk sayısıyla
        // ilgilenmeye devam ediyor (aşağıdaki CAPACITY_EXCEEDS_BUS kontrolü).
        var requested = ids.Count > 0
            ? (await uow.TravelBuses.FindAsync(b => ids.Contains(b.Id), ct)).ToList()
            : [];

        if (ids.Count > 0)
        {
            if (requested.Count != ids.Count)
                throw new NotFoundException("Seçilen otobüslerden biri bulunamadı.", "TRAVEL_BUS_NOT_FOUND");

            // Kullanıcı isteği (2026-08-05): bir araç, tarihleri çakışan başka seferlere de
            // serbestçe atanabilir — plaka/şoför gerçek dünyada aynı anda tek yerde olabilir
            // kısıtı burada uygulanmaz; sistem yalnızca kontenjan/koltuk sayısıyla ilgilenir.
            // Önceden burada BUS_DATE_CONFLICT hatası fırlatılıyordu, artık kaldırıldı.

            var totalSeats = requested.Where(b => b.IsActive)
                .Sum(b => b.IsCapacityOnly ? b.Capacity : Nexora.Application.Common.BusSeatMath.OpenSeats(b.SeatStatesJson, b.TemplateId));
            if (totalSeats > 0 && travel.Capacity > totalSeats)
                throw new ConflictException($"Kontenjan araç kapasitesinden ({totalSeats}) büyük olamaz.", "CAPACITY_EXCEEDS_BUS");
        }

        var existing = await uow.TravelBuses.GetAssignmentsByTravelAsync(travel.Id, ct);
        var existingBusIds = existing.Select(a => a.BusId).ToHashSet();

        var removeBusIds = existing.Where(a => !ids.Contains(a.BusId)).Select(a => a.BusId).ToList();
        if (removeBusIds.Count > 0)
            await uow.TravelBuses.RemoveAssignmentsByBusForTravelAsync(travel.Id, removeBusIds, ct);

        foreach (var busId in ids.Where(id => !existingBusIds.Contains(id)))
        {
            var bus = requested.First(b => b.Id == busId);
            await uow.TravelBuses.AddAssignmentAsync(travel.Id, busId, bus.SeatStatesJson, ct);
        }

        travel.SetBusCount(ids.Count);
        uow.Travels.Update(travel);
    }

    private async Task EnsureCrewAvailableAsync(JsonElement crew, DateTime start, DateTime end, Guid? excludeId, CancellationToken ct)
    {
        var ids = ExtractCrewIds(crew);
        if (ids.Count == 0) return;
        var s = DateTime.SpecifyKind(start, DateTimeKind.Utc);
        var e = DateTime.SpecifyKind(end, DateTimeKind.Utc);
        var overlapping = await uow.Travels.FindAsync(
            t => (!excludeId.HasValue || t.Id != excludeId.Value) && t.StartDate <= e && t.EndDate >= s, ct);
        foreach (var t in overlapping)
        {
            var otherIds = ExtractCrewIds(ParseJson(t.CrewJson));
            if (ids.Intersect(otherIds).Any())
                throw new ConflictException($"Seçilen şoför/rehber/sorumlu çakışan bir gezide ('{t.Name}') görevli.", "CREW_DOUBLE_BOOKED");
        }
    }

    private async Task GrantGuideAccessAsync(Travel travel, JsonElement crew, CancellationToken ct)
    {
        if (crew.ValueKind != JsonValueKind.Object) return;
        if (!crew.TryGetProperty("responsible", out var responsible) || responsible.ValueKind != JsonValueKind.Object) return;

        if (!ReadBool(responsible, "grantAccess")) return;

        var existingId = ReadString(responsible, "id");
        if (Guid.TryParse(existingId, out var existingGuid) && existingGuid != Guid.Empty) return;

        var name = ReadString(responsible, "name");
        var email = ReadString(responsible, "email");
        var phone = ReadString(responsible, "phone");
        var tckn = ReadString(responsible, "tckn");

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email))
            throw new ConflictException("Sisteme erişim verilecek kişinin adı ve e-postası zorunludur.", "STAFF_INFO_REQUIRED");

        var staff = await scopedStaff.AssignAsync(new AssignScopedStaffRequest(
            FullName: name,
            Tckn: string.IsNullOrWhiteSpace(tckn) ? null : tckn,
            Phone: string.IsNullOrWhiteSpace(phone) ? null : phone,
            Email: email,
            RoleTemplateKey: "gezi-sorumlusu",
            ScopeModuleKey: "travels",
            ScopeRefId: travel.Id,
            ScopeName: travel.Name,
            ScopeType: "Travel",
            DeliveryChannel: "Email"), ct);

        var node = JsonNode.Parse(crew.GetRawText())!;
        var responsibleNode = node["responsible"]!.AsObject();
        responsibleNode["id"] = staff.AdminUserId.ToString();
        responsibleNode["roleKey"] = staff.RoleKey;
        responsibleNode["role"] = staff.RoleName;

        travel.SetCrewJson(node.ToJsonString(), currentUser.Name);
        uow.Travels.Update(travel);
        await uow.SaveChangesAsync(ct);
    }

    private static bool ReadBool(JsonElement obj, string property)
    {
        if (!obj.TryGetProperty(property, out var el)) return false;
        return el.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.String => bool.TryParse(el.GetString(), out var b) && b,
            _ => false,
        };
    }

    private static string ReadString(JsonElement obj, string property)
        => obj.TryGetProperty(property, out var el) && el.ValueKind == JsonValueKind.String ? el.GetString() ?? "" : "";

    private static List<Guid> ExtractCrewIds(JsonElement crew)
    {
        var ids = new List<Guid>();
        if (crew.ValueKind != JsonValueKind.Object) return ids;
        foreach (var key in new[] { "driver", "guide", "responsible" })
            if (crew.TryGetProperty(key, out var p) && p.ValueKind == JsonValueKind.Object
                && p.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String
                && Guid.TryParse(idEl.GetString(), out var g) && g != Guid.Empty)
                ids.Add(g);
        return ids;
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        travel.MarkDeleted(currentUser.Name);
        uow.Travels.Update(travel);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<TravelDto> RestoreAsync(Guid id, CancellationToken ct)
    {
        var travel = await uow.Travels.GetAnyByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        if (!travel.IsDeleted)
            throw new ConflictException("Gezi zaten arşivde değil.", "TRAVEL_NOT_DELETED");

        travel.Restore();
        uow.Travels.Update(travel);
        await uow.SaveChangesAsync(ct);

        return await ToDtoAsync(travel, ct);
    }

    public async Task PermanentDeleteAsync(Guid id, CancellationToken ct)
    {
        var travel = await uow.Travels.GetAnyByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        if (!travel.IsDeleted)
            throw new ConflictException("Kalıcı silmeden önce gezi çöp kutusunda olmalıdır.", "TRAVEL_NOT_IN_TRASH");

        uow.Travels.HardRemove(travel);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<TravelDto> CopyAsync(Guid id, TravelCopyRequest req, CancellationToken ct)
    {
        var src = await uow.Travels.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var route = await uow.TravelRoutes.GetByIdAsync(src.RouteId, ct)
            ?? throw new NotFoundException("Gezi (rota) bulunamadı.", "TRAVEL_ROUTE_NOT_FOUND");

        var copy = await CreateCopyCoreAsync(src, route, req, ct);
        return await ToDtoAsync(copy, ct);
    }

    // Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme/kopyalama" — tek işlemde birden
    // fazla hedef tarih/kayıt aralığı için bağımsız sefer kopyaları oluşturur. FacilityGroup
    // CopyToFacilitiesAsync ile aynı "best-effort" deseni: bir hedef başarısız olursa (ör.
    // çakışan şoför/rehber) diğer hedefler etkilenmez, sonuç listesinde ayrı ayrı raporlanır.
    public async Task<TravelBulkCopyResult> BulkCopyAsync(Guid id, TravelBulkCopyRequest req, CancellationToken ct)
    {
        var src = await uow.Travels.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var route = await uow.TravelRoutes.GetByIdAsync(src.RouteId, ct)
            ?? throw new NotFoundException("Gezi (rota) bulunamadı.", "TRAVEL_ROUTE_NOT_FOUND");

        var targets = req.Targets ?? [];
        if (targets.Count == 0)
            throw new ConflictException("En az bir hedef tarih aralığı girilmelidir.", "COPY_TARGETS_EMPTY");

        var results = new List<TravelBulkCopyItemResult>();
        for (var i = 0; i < targets.Count; i++)
        {
            try
            {
                var copy = await CreateCopyCoreAsync(src, route, targets[i], ct);
                results.Add(new TravelBulkCopyItemResult(i, true, copy.Id, copy.Code, null));
            }
            catch (Exception ex) when (ex is ConflictException or NotFoundException)
            {
                results.Add(new TravelBulkCopyItemResult(i, false, null, null, ex.Message));
            }
        }

        return new TravelBulkCopyResult(results);
    }

    private async Task<Travel> CreateCopyCoreAsync(Travel src, TravelRoute route, TravelCopyRequest req, CancellationToken ct)
    {
        if (req.EndDate < req.StartDate)
            throw new ConflictException("Dönüş tarihi gidiş tarihinden önce olamaz.", "TRAVEL_DATE_INVALID");
        if (req.RegistrationEndDate < req.RegistrationStartDate)
            throw new ConflictException("Kayıt bitiş tarihi kayıt başlangıcından önce olamaz.", "TRAVEL_REGISTRATION_DATE_INVALID");

        var data = new TravelData(
            route.Id, route.Name, route.CategoryId, route.Destination, route.Latitude, route.Longitude,
            route.Description, route.Conditions, route.InternalNote,
            req.StartDate, req.EndDate, req.RegistrationStartDate, req.RegistrationEndDate,
            route.Gender, route.MinAge, route.MaxAge, src.Capacity, src.ReserveCapacity,
            src.ParticipationPeriod, src.ParticipationLimit, src.ExemptFromParticipationLimit, src.CancellationDeadlineHours,
            route.RestrictionsJson, route.ImagesJson, route.PricingJson, route.PointsJson, src.CrewJson, false, route.SultangaziResidentOnly,
            route.DeparturePoint);

        var code = $"GEZ-{await uow.Travels.NextCodeNumberAsync(ct):D6}";
        var copy = Travel.Create(data, code, currentUser.Name);
        copy.Deactivate();

        await uow.Travels.AddAsync(copy, ct);
        await uow.SaveChangesAsync(ct);

        var sourceBusIds = (await uow.TravelBuses.GetByTravelAsync(src.Id, ct)).Select(b => b.Id).ToList();
        if (sourceBusIds.Count > 0)
        {
            var newBusIds = new List<Guid>();
            if (req.CloneBuses)
            {
                foreach (var busId in sourceBusIds)
                {
                    var bus = await uow.TravelBuses.GetByIdAsync(busId, ct);
                    if (bus is null) continue;
                    var clone = TravelBus.Create(
                        bus.Name, bus.PlateNumber, bus.VehicleType, bus.TemplateId, bus.Capacity,
                        bus.IsCapacityOnly ? "{}" : bus.SeatStatesJson, 0, currentUser.Name, bus.Id);
                    await uow.TravelBuses.AddAsync(clone, ct);
                    newBusIds.Add(clone.Id);
                }
                await uow.SaveChangesAsync(ct);
            }
            else
            {
                newBusIds = sourceBusIds;
            }

            await AssignBusesAsync(copy, newBusIds, ct);
            await uow.SaveChangesAsync(ct);
        }

        return copy;
    }

    public async Task<TravelDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        if (travel.IsActive)
        {
            travel.Deactivate();
        }
        else
        {
            // SORUN 2 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı):
            // Bu kontrol araçsız (kontenjan bazlı) seferlerin liste ekranındaki toggle ile
            // aktif edilmesini engelliyordu — ama TravelForm.tsx UI'de açıkça "araç
            // seçmezseniz sefer sadece kontenjan sınırıyla (koltuk ataması olmadan)
            // yürütülür" deniyor, ve aynı veriyle PUT update (CreateAsync/UpdateAsync)
            // hiçbir kısıtlama olmadan izin veriyordu — iki yol arasında tutarsızlık
            // vardı. Araçsız seferler kasıtlı ve desteklenen bir kullanım şekli olduğu
            // için bu kontrol kaldırıldı.
            travel.Activate();
        }

        uow.Travels.Update(travel);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Travel",
            EntityId = travel.Id,
            Module = "Travels",
            Description = travel.IsActive
                ? $"Gezi aktifleştirildi: {travel.Name}"
                : $"Gezi pasifleştirildi: {travel.Name}",
        }, ct);

        return await ToDtoAsync(travel, ct);
    }

    public async Task<List<TravelAuditEntryDto>> GetAuditLogAsync(Guid id, CancellationToken ct)
    {
        var logs = await uow.AuditLogs.FindAsync(a => a.EntityType == "Travel" && a.EntityId == id, ct);
        return logs
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new TravelAuditEntryDto(a.Id, MapAction(a.Action), a.CreatedAt, a.UserName ?? "Sistem", ParseNullable(a.OldValues), ParseNullable(a.NewValues)))
            .ToList();
    }

    public async Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, string? purpose, CancellationToken ct)
    {
        var storage = serviceProvider.GetService<IFileStorageService>()
            ?? throw new ConflictException("Dosya depolama servisi yapılandırılmamış.", "STORAGE_NOT_CONFIGURED");

        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();

        var settingsService = serviceProvider.GetService<IEventSettingsService>();
        if (settingsService is not null)
        {
            var settings = await settingsService.GetAsync(ct);
            ImageSpecGuard.Validate(bytes, purpose, settings.Images);
        }

        var bucket = minioOptions.CurrentValue.PublicBucket;
        using var upload = new MemoryStream(bytes);
        var result = await storage.UploadAsync(upload, fileName, contentType, bucket, ct);
        return result.Url;
    }

    private static TravelData ToData(TravelFormRequest r, TravelRoute route)
        => new(
            route.Id, route.Name, route.CategoryId, route.Destination, route.Latitude, route.Longitude,
            route.Description, route.Conditions, route.InternalNote,
            r.StartDate, r.EndDate, r.RegistrationStartDate, r.RegistrationEndDate,
            route.Gender, route.MinAge, route.MaxAge, r.Capacity, r.ReserveCapacity,
            r.ParticipationPeriod, r.ParticipationLimit, r.ExemptFromParticipationLimit, r.CancellationDeadlineHours,
            route.RestrictionsJson, route.ImagesJson, route.PricingJson, route.PointsJson, RawOrEmpty(r.Crew), r.IsActive, route.SultangaziResidentOnly,
            route.DeparturePoint);

    private static string RawOrEmpty(JsonElement el)
        => el.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null ? "{}" : el.GetRawText();

    private async Task<PagedResult<TravelDto>> MapPageAsync(PagedResult<Travel> paged, CancellationToken ct)
    {
        var catIds = paged.Items.Select(e => e.CategoryId).Distinct().ToList();
        var cats = catIds.Count == 0
            ? new Dictionary<Guid, TravelCategory>()
            : (await uow.TravelCategories.FindAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id);

        var counts = await uow.TravelApplications.CountByTravelsAsync(paged.Items.Select(e => e.Id).ToList(), ct);

        return new PagedResult<TravelDto>
        {
            Items = paged.Items.Select(e => Map(
                e,
                cats.GetValueOrDefault(e.CategoryId)?.Name ?? "",
                cats.GetValueOrDefault(e.CategoryId)?.Color ?? "",
                counts.GetValueOrDefault(e.Id).Approved, counts.GetValueOrDefault(e.Id).Waitlist)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    private async Task<TravelDto> ToDtoAsync(Travel e, CancellationToken ct)
    {
        var cat = await uow.TravelCategories.GetByIdAsync(e.CategoryId, ct);
        var counts = await uow.TravelApplications.CountByTravelsAsync([e.Id], ct);
        var actual = counts.GetValueOrDefault(e.Id);
        return Map(e, cat?.Name ?? "", cat?.Color ?? "", actual.Approved, actual.Waitlist);
    }

    private static TravelDto Map(Travel e, string categoryName, string categoryColor, int registeredCount, int reserveCount)
        => new(
            e.Id, e.Code, e.RouteId, e.Name, e.CategoryId, categoryName, categoryColor,
            e.Destination, e.Latitude, e.Longitude, e.Description, e.Conditions, e.InternalNote,
            e.StartDate, e.EndDate, e.RegistrationStartDate, e.RegistrationEndDate,
            e.Gender, e.MinAge, e.MaxAge,
            e.Capacity, registeredCount, reserveCount, e.ReserveCapacity,
            e.ParticipationPeriod, e.ParticipationLimit, e.ExemptFromParticipationLimit, e.CancellationDeadlineHours,
            ParseJson(e.RestrictionsJson), ParseJson(FileUrl.NormalizeImagesJson(e.ImagesJson)), ParseJson(e.PricingJson), ParseJson(e.PointsJson),
            ParseJson(e.CrewJson),
            e.BusCount, e.IsActive, e.SultangaziResidentOnly, e.DeparturePoint,
            e.CreatedAt, e.UpdatedAt, e.DeletedAt, e.DeletedBy,
            e.AttendanceTakenAt.HasValue);

    private static JsonElement ParseJson(string json)
        => JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json).RootElement.Clone();

    private static JsonElement? ParseNullable(string? json)
        => string.IsNullOrWhiteSpace(json) ? null : JsonDocument.Parse(json).RootElement.Clone();

    private static string MapAction(AuditAction a) => a switch
    {
        AuditAction.Create => "created",
        AuditAction.Update => "updated",
        AuditAction.SoftDelete or AuditAction.Delete => "deleted",
        AuditAction.Restore => "restored",
        AuditAction.StatusChange => "updated",
        _ => a.ToString().ToLowerInvariant(),
    };
}
