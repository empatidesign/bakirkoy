using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Nexora.Infrastructure.Storage;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Configuration;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.ParticipantAuth.Dtos;
using Nexora.Application.Features.ParticipantTravels;
using Nexora.Application.Features.ParticipantTravels.Dtos;
using Nexora.Application.Features.Travels;
using Nexora.Domain.Entities.Notifications;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Travels;
using Nexora.Domain.Enums;
using Nexora.Domain.Common;

namespace Nexora.Infrastructure.Services;

public partial class ParticipantTravelService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IAuditService audit,
    INviService nvi,
    IActivityLogger log,
    IConfiguration config,
    IOptionsMonitor<ParticipantSettings> participantSettings,
    ITravelSettingsService travelSettings,
    ITravelNotificationService notifications,
    ITravelApplicationService travelApplications) : IParticipantTravelService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
    private string SultangaziDistrictCode => config.GetValue("Residency:SultangaziDistrictCode", Nexora.Domain.Common.ResidencyPolicy.DefaultSultangaziDistrictCode)!;

    public async Task<PagedResult<CitizenTravelDto>> DiscoverAsync(CitizenTravelDiscoverParams p, CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        var listParams = new Nexora.Application.Features.Travels.Dtos.TravelListParams
        {
            Page = p.PageResolved.ToString(),
            Limit = p.LimitResolved.ToString(),
            Search = p.Search,
            CategoryId = p.CategoryId,
            IsActive = true,
            StartDate = today,
            Sort = "startdate",
            Order = "asc",
        };

        var paged = await uow.Travels.GetPagedAsync(listParams, null, ct);
        var future = paged.Items;

        var participant = currentUser.Id.HasValue
            ? await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct)
            : null;

        var children = participant is not null
            ? await uow.Participants.GetChildrenAsync(participant.Id, ct)
            : [];

        var cats = await LoadCategoriesAsync(future.Select(t => t.CategoryId), ct);
        var requiresSeat = await RequiresSeatMapAsync(future.Select(t => t.Id).ToList(), ct);
        var appliedTravelIds = await AppliedTravelIdsAsync(participant?.Id, future.Select(t => t.Id).ToList(), ct);

        var items = future.Select(t => ToCard(
            t,
            cats.GetValueOrDefault(t.CategoryId),
            requiresSeat.Contains(t.Id),
            participant,
            appliedTravelIds.Contains(t.Id),
            children)).ToList();

        if (participant is not null && Age(participant.BirthDate) < 18)
            items = items.Where(i => i.Eligible).ToList();

        items = [.. items.OrderBy(i => i.AlreadyApplied ? 1 : 0).ThenBy(i => i.DepartureDate)];

        return new PagedResult<CitizenTravelDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<CitizenTravelDetailDto> GetDetailAsync(Guid travelId, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(travelId, ct);
        if (travel is null || !travel.IsActive)
            throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        var participant = currentUser.Id.HasValue
            ? await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct)
            : null;

        var cat = await uow.TravelCategories.GetByIdAsync(travel.CategoryId, ct);
        var buses = await BuildSeatMapsAsync(travel, ct);
        var requiresSeat = buses.Any(b => b.VehicleType != "capacity");
        var appliedTravelIds = await AppliedTravelIdsAsync(participant?.Id, [travel.Id], ct);

        var card = ToCard(travel, cat, requiresSeat, participant, appliedTravelIds.Contains(travel.Id));
        var applicants = await BuildApplicantsAsync(travel, participant, ct);
        var waitlistCount = await uow.TravelApplications.CountByTravelAndStatusAsync(travel.Id, "waitlist", ct);

        return new CitizenTravelDetailDto(
            card.Id, card.Code, card.Name, card.CategoryName, card.CategoryColor, card.Destination, card.Latitude, card.Longitude,
            card.DepartureDate, card.ReturnDate, card.IsSingleDay, card.Gender, card.MinAge, card.MaxAge,
            card.Capacity, card.RegisteredCount, travel.ReserveCapacity, waitlistCount, card.RequiresSeat, card.ImageUrl, card.DescriptionPreview,
            card.Eligible, card.AlreadyApplied,
            travel.Description, travel.Conditions, applicants, buses,
            card.GuideName, card.DriverName,
            card.RegistrationStartDate, card.RegistrationEndDate, card.ApplicationOpen,
            ExtractPhotoUrls(travel.ImagesJson),
            Nexora.Domain.Common.TravelRestrictionRules.MaxGroupSize(travel.RestrictionsJson),
            Nexora.Domain.Common.TravelRestrictionRules.AllowChildren(travel.RestrictionsJson),
            Nexora.Domain.Common.TravelRestrictionRules.MaxChildren(travel.RestrictionsJson),
            Nexora.Domain.Common.TravelRestrictionRules.ChildMinAge(travel.RestrictionsJson),
            Nexora.Domain.Common.TravelRestrictionRules.ChildMaxAge(travel.RestrictionsJson),
            Nexora.Domain.Common.TravelRestrictionRules.ChildGenderMode(travel.RestrictionsJson));
    }

    public async Task<List<CitizenTravelBusSeatMapDto>> GetSeatMapAsync(Guid travelId, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(travelId, ct);
        if (travel is null || !travel.IsActive)
            throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        return await BuildSeatMapsAsync(travel, ct);
    }

    /// <summary>
    /// Gezi rezervasyonuna eklenecek misafir için kimlik önizlemesi. /auth/citizen/nvi-lookup'tan
    /// farklı olarak burada "zaten kayıtlı hesap var" kontrolü YAPILMAZ — misafirin sistemde
    /// zaten bir vatandaş hesabı olması tamamen normaldir (aile dışından biri ama Nexora'ya
    /// kayıtlı olabilir), bu bir kayıt akışı değil, sadece isim/cinsiyet doğrulaması.
    /// </summary>
    public async Task<CitizenNviLookupResultDto> GuestLookupAsync(CitizenTravelGuestLookupRequest req, CancellationToken ct)
    {
        if (!Nexora.Application.Common.TcKimlikValidator.IsValid(req.Tckn))
            throw new ConflictException("Geçerli bir T.C. kimlik numarası giriniz.", "INVALID_TCKN");

        var res = await nvi.GetPersonAndChildrenAsync(req.Tckn.Trim(), req.BirthDate, 18, ct);
        if (!res.Success || res.Person is null)
            throw new NotFoundException("Bu kimlik bilgileriyle kayıt bulunamadı. Bilgileri kontrol edin.", "NVI_NOT_FOUND");

        var person = res.Person;
        var personName = $"{person.FirstName} {person.LastName}".Trim();
        var mask = participantSettings.CurrentValue.MaskCitizenIdentity;

        return new CitizenNviLookupResultDto(
            mask ? Nexora.Application.Common.IdentityMask.MaskTckn(person.Tckn) : person.Tckn,
            mask ? Nexora.Application.Common.IdentityMask.MaskName(personName) : personName,
            person.BirthDate,
            person.Gender.ToString(),
            person.Address,
            false,
            []);
    }

    private sealed record ResolvedGuest(string FullName, string Tckn, DateTime BirthDate, string Phone, string Email, string Gender, string? Address);
    private sealed record ResolvedPassenger(Participant? Participant, ResolvedGuest? Guest, string Gender, string? Seat)
    {
        public string FullName => Participant?.FullName ?? Guest?.FullName ?? "";
    }

    public async Task<CitizenTravelApplicationDto> ReserveAsync(Guid travelId, CitizenTravelReserveRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(ReserveAsync), new { travelId, count = req.Passengers?.Count ?? 0 });

        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var requested = req.Passengers ?? [];
        if (requested.Count == 0)
            throw new ConflictException("Rezervasyon için en az bir kişi seçmelisiniz.", "RESERVATION_EMPTY");
        if (requested.Count(p => p.Guest is not null) > 1)
            throw new ConflictException("Bir rezervasyona en fazla bir misafir eklenebilir.", "GUEST_LIMIT");

        var travel = await uow.Travels.GetByIdAsync(travelId, ct);
        if (travel is null || !travel.IsActive)
            throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        var maxGroupSize = Nexora.Domain.Common.TravelRestrictionRules.MaxGroupSize(travel.RestrictionsJson);
        if (requested.Count > maxGroupSize)
            throw new ConflictException($"Bu geziye tek rezervasyonda en fazla {maxGroupSize} kişi (siz dahil, misafir + varsa çocuk kontenjanı) ekleyebilirsiniz.", "GROUP_LIMIT");

        if (TurkeyTime.ToTurkey(travel.StartDate).Date < TurkeyTime.TodayDate())
            throw new ConflictException("Geçmiş geziye başvurulamaz.", "TRAVEL_IN_PAST");

        var now = TurkeyTime.NowWallClock();
        if (!Nexora.Domain.Common.RegistrationWindow.HasStarted(now, travel.RegistrationStartDate))
            throw new ConflictException($"Başvurular {travel.RegistrationStartDate:dd.MM.yyyy HH:mm} tarihinde açılacaktır.", "REGISTRATION_NOT_STARTED");
        if (Nexora.Domain.Common.RegistrationWindow.HasEnded(now, travel.RegistrationEndDate))
            throw new ConflictException("Başvuru süresi sona ermiştir.", "REGISTRATION_ENDED");

        var children = await uow.Participants.GetChildrenAsync(actorId, ct);
        var accountParticipantIds = new HashSet<Guid>(children.Select(c => c.Id)) { actorId };

        var actorParticipant = await uow.Participants.GetByIdAsync(actorId, ct);
        var actorInReservation = requested.Any(p => p.Guest is null && (p.ParticipantId ?? actorId) == actorId);
        var actorHasActiveApplication = await HasActiveApplicationAsync(actorId, travelId, ct);
        var actorEligible = actorParticipant is not null && IsEligible(travel, actorParticipant);
        var actorAccompanies = (actorInReservation || actorHasActiveApplication) && actorEligible;

        var buses = await uow.TravelBuses.GetByTravelAsync(travelId, ct);
        var hasVehicles = buses.Count > 0;

        TravelBus? bus = null;
        if (hasVehicles)
        {
            bus = req.BusId.HasValue
                ? buses.FirstOrDefault(b => b.Id == req.BusId.Value)
                : buses.Count == 1 ? buses[0] : null;
            if (bus is null)
                throw new ConflictException("Lütfen bir araç seçin.", "BUS_REQUIRED");
        }

        var capacityOnlyVehicle = bus?.IsCapacityOnly ?? false;
        var requiresSeat = hasVehicles && !capacityOnlyVehicle;

        var items = new List<ResolvedPassenger>();
        var seenParticipantIds = new HashSet<Guid>();
        var seenIdentities = new HashSet<string>(StringComparer.Ordinal);
        foreach (var p in requested)
        {
            if (p.Guest is not null)
            {
                var g = await ResolveGuestAsync(p.Guest, ct);
                if (!seenIdentities.Add(g.Tckn.Trim()))
                    throw new ConflictException("Aynı kişi rezervasyona iki kez eklenemez.", "ALREADY_APPLIED");
                if (!IsGuestEligible(travel, g))
                    throw new ConflictException($"{g.FullName} bu gezi için yaş/cinsiyet şartını sağlamıyor.", "NOT_ELIGIBLE");
                // basvuruhitetmeyenkurallar.md (B-kovası, Gezi #14d) canlı testte kanıtlandı: misafir
                // yolu, katılımcı yolunun kullandığı güncel ReadResidencyMode/ResidencyPolicy sistemini
                // (sultangazi_only / outside_only / anyone) HİÇ okumuyordu — sadece eski/kısıtlı
                // "sultangaziResidentOnly" boolean bayrağını kontrol ediyordu. Sonuç: bir gezi
                // residencyMode="outside_only" (yalnızca Sultangazi DIŞI) olarak ayarlansa bile,
                // misafir yolundan Sultangazi sakini biri sorunsuzca eklenebiliyordu (canlı testte
                // hem outside_only hem sultangazi_only için doğrulandı — ikisi de misafir yolunda
                // tamamen görmezden geliniyordu). Düzeltme: misafir yolu artık katılımcı yoluyla
                // AYNI residencyMode okumasını kullanıyor (adres bazlı, misafirin district kodu NVI'dan
                // gelmediği için aynı string-eşleşme mantığı ile).
                var guestResidencyMode = Nexora.Domain.Common.TravelRestrictionRules.ReadResidencyModeRaw(travel.RestrictionsJson);
                var guestIsResident = !string.IsNullOrWhiteSpace(g.Address)
                    && g.Address.Contains("sultangazi", StringComparison.OrdinalIgnoreCase);
                var guestIsForeign = Nexora.Domain.Common.EligibilityRules.IsForeign(g.Tckn);
                var guestViolation = Nexora.Domain.Common.EligibilityRules.CheckResidencyRaw(guestResidencyMode, guestIsResident, guestIsForeign);
                if (guestViolation is not null)
                    throw new ConflictException($"{g.FullName}: {guestViolation.Message}", guestViolation.ErrorCode);
                if (await HasActiveGuestApplicationAsync(g.Tckn, travelId, ct))
                    throw new ConflictException($"{g.FullName} bu geziye zaten başvurmuş.", "ALREADY_APPLIED");
                await EnsureNoActiveGuestOverlapAsync(g.Tckn, travelId, travel.StartDate, g.FullName, ct);
                await EnforceGuestParticipationLimitAsync(travel, g.Tckn, g.FullName, ct);
                items.Add(new ResolvedPassenger(null, g, g.Gender, NormalizeSeat(p.SeatNumber)));
            }
            else
            {
                var pid = p.ParticipantId ?? actorId;
                if (pid != actorId && !accountParticipantIds.Contains(pid))
                    throw new ForbiddenException("Bu kişi adına başvuru yapma yetkiniz yok.", "APPLICANT_FORBIDDEN");
                if (!seenParticipantIds.Add(pid))
                    throw new ConflictException("Aynı kişiyi rezervasyona iki kez ekleyemezsiniz.", "DUPLICATE_PASSENGER");

                var participant = await uow.Participants.GetByIdAsync(pid, ct)
                    ?? throw new NotFoundException("Başvuru yapılacak kişi bulunamadı.", "PARTICIPANT_NOT_FOUND");
                if (participant.Status != ParticipantStatus.Active)
                    throw new ConflictException($"{participant.FullName} hesabı aktif olmadığı için başvuru yapılamaz.", "ACCOUNT_NOT_ACTIVE");
                if (!IsEligible(travel, participant))
                {
                    // UAT 2026-09-24: ikamet/uyruk reddi tesis ve etkinlikle birebir aynı kod ve
                    // mesajla döner (önceden "yaş/cinsiyet şartını sağlamıyor" + NOT_ELIGIBLE ile
                    // yanıltıcıydı). İkamet/uyruk kuralı refakat istisnasına tabi değildir.
                    var residencyViolation = Nexora.Domain.Common.EligibilityRules.CheckResidency(
                        Nexora.Domain.Common.TravelRestrictionRules.ReadResidencyModeRaw(travel.RestrictionsJson),
                        participant, null, SultangaziDistrictCode);
                    if (residencyViolation is not null)
                        throw new ConflictException($"{participant.FullName}: {residencyViolation.Message}", residencyViolation.ErrorCode);
                    var accompaniable = pid != actorId && IsAccompaniableMinor(travel, participant) && actorAccompanies;
                    if (!accompaniable)
                    {
                        var genderViolation = Nexora.Domain.Common.FacilityEligibilityRules.CheckGender(travel.Gender, participant.Gender);
                        if (genderViolation is not null)
                            throw new ConflictException($"{participant.FullName}: {genderViolation.Message}", genderViolation.ErrorCode);

                        var age = Age(participant.BirthDate);
                        if ((travel.MinAge > 0 && age < travel.MinAge) || (travel.MaxAge > 0 && age > travel.MaxAge))
                        {
                            var ageMsg = travel.MaxAge > 0 && travel.MinAge > 0
                                ? $"{participant.FullName} bu gezi için yaş aralığı ({travel.MinAge}-{travel.MaxAge} yaş) dışındadır."
                                : travel.MinAge > 0
                                ? $"{participant.FullName} bu gezi için yaş şartını (en az {travel.MinAge} yaş) sağlamıyor."
                                : $"{participant.FullName} bu gezi için yaş şartını (en fazla {travel.MaxAge} yaş) sağlamıyor.";
                            throw new ConflictException(ageMsg, "AGE_NOT_ELIGIBLE");
                        }

                        throw new ConflictException($"{participant.FullName} bu gezi için yaş/cinsiyet şartını sağlamıyor. Reşit olmayan çocuklar yalnızca uygun bir ebeveyniyle birlikte katılabilir.", "NOT_ELIGIBLE");
                    }
                }
                if (!string.IsNullOrWhiteSpace(participant.Tckn) && !seenIdentities.Add(participant.Tckn.Trim()))
                    throw new ConflictException("Aynı kişi rezervasyona iki kez eklenemez.", "ALREADY_APPLIED");
                if (await HasActiveApplicationAsync(pid, travelId, ct))
                    throw new ConflictException($"{participant.FullName} bu geziye zaten başvurmuş.", "ALREADY_APPLIED");
                await EnsureNoPreviousParticipationAsync(pid, travelId, participant.FullName, ct);
                await EnsureNoRecentNoShowAsync(pid, participant.FullName, ct);
                await EnsureNoActiveOverlapAsync(pid, travelId, travel.StartDate, participant.FullName, ct);
                await EnforceParticipationLimitAsync(travel, pid, participant.FullName, ct);
                EnforceTravelRestrictions(travel, participant, pid == actorId);

                items.Add(new ResolvedPassenger(participant, null, GenderStr(participant.Gender), NormalizeSeat(p.SeatNumber)));
            }
        }

        // Kullanıcı bulgusu (2026-08-11): çocuk sınırı artık tek rezervasyonla değil, velinin bu
        // geziye getirdiği TOPLAM çocuk sayısıyla (tüm başvuruları dahil) karşılaştırılır — çocuklar
        // ayrı ayrı rezervasyonlarla ekleyerek maxChildren aşılabiliyordu. Ortak guard admin
        // (TravelApplicationService) ile aynı kuralı uygular.
        var minorIds = items
            .Where(it => it.Participant is not null && Age(it.Participant.BirthDate) < 18)
            .Select(it => it.Participant!.Id)
            .ToList();
        await Nexora.Infrastructure.Services.Travels.TravelChildLimitGuard.EnsureAsync(
            uow, travel, actorId, minorIds, Array.Empty<Guid>(), ct);

        // COM-CAP-002 sınıfı bug: kapasite/yedek hesaplaması (ResolveWaitlistModeAsync) ve koltuk
        // müsaitliği kontrolü (EnsureSeatAvailableAsync), başvuru kaydının eklenmesiyle aynı
        // transaction'da değildi ve lock yoktu — iki eş zamanlı rezervasyon aynı koltuğa İKİSİ DE
        // "approved" olarak kabul edilebiliyordu (canlı testte doğrulandı: aynı otobüs+koltuk
        // numarasıyla iki farklı vatandaş aynı anda onaylandı). Facility/SEDA/Library/Events'teki
        // aynı desen: Postgres transaction-scoped advisory lock (gezi id anahtarlı) ile kapasite/
        // koltuk hesaplama ve kayıt eklemeyi tek bir serileştirilmiş blok haline getiriyoruz.
        var created = new List<(TravelApplication App, ResolvedPassenger Item)>();
        string newStatus;
        await uow.BeginTransactionAsync(ct);
        try
        {
            // K03: kilit gerçek YOLCU kimliğine göre alınır (actorId değil) — farklı veliler/aktörler aynı
            // çocuk/misafir adına eşzamanlı başvururken katılım limiti/çift-kayıt korunur. Deadlock önlemek
            // için kimlik kilitleri kararlı (artan) sırada, sonra ortak kaynak (gezi) kilidi alınır.
            var identityLockKeys = new SortedSet<long>();
            foreach (var it in items)
            {
                // V07: kimlik kilidi TCKN-tabanlı — aynı kişi hem kayıtlı yolcu hem misafir yoluyla
                // eşzamanlı başvurabilir; ikisi de AYNI TCKN kilidine düşer, çift-kayıt/limit yarışı serileşir.
                if (it.Participant is not null) identityLockKeys.Add(IdentityLockKey(it.Participant.Tckn));
                if (it.Guest is not null) identityLockKeys.Add(IdentityLockKey(it.Guest.Tckn));
            }
            foreach (var key in identityLockKeys)
                await uow.AcquireAdvisoryLockAsync(key, ct);
            await uow.AcquireAdvisoryLockAsync(TravelLockKey(travelId), ct);

            foreach (var it in items)
            {
                if (it.Participant is not null)
                {
                    if (await HasActiveApplicationAsync(it.Participant.Id, travelId, ct))
                        throw new ConflictException($"{it.Participant.FullName} bu geziye zaten başvurmuş.", "ALREADY_APPLIED");
                    await EnforceParticipationLimitAsync(travel, it.Participant.Id, it.Participant.FullName, ct);
                }
                if (it.Guest is not null)
                {
                    if (await HasActiveGuestApplicationAsync(it.Guest.Tckn, travelId, ct))
                        throw new ConflictException($"{it.Guest.FullName} bu geziye zaten başvurmuş.", "ALREADY_APPLIED");
                    await EnforceGuestParticipationLimitAsync(travel, it.Guest.Tckn, it.Guest.FullName, ct);
                }
            }

            var waitlistMode = await ResolveWaitlistModeAsync(travel, items.Count, ct);
            // Bulgu (2026-10-03, canlı QA denetimi — nihai prod-öncesi tur): Route/Travel'da
            // "Evrak gerekli" (documentRequired) açık olsa bile, bu bayrak başvuru anındaki
            // newStatus hesaplamasında HİÇ dikkate alınmıyordu — sadece global
            // TravelSettings.General.RequireApproval'a bakılıyordu. Canlı ayar RequireApproval=
            // false olduğundan, documentRequired=true bir geziye yapılan başvuru DocumentStatus
            // hâlâ "pending" iken doğrudan Status="approved" ile oluşuyordu. Admin tarafındaki
            // "onaya evrak tamamlanmadan geçilemez" kilidi (TravelApplicationService.UpdateAsync,
            // DOCUMENTS_REQUIRED) yalnızca bir DURUM DEĞİŞİKLİĞİNDE tetiklendiği için, başvuru
            // zaten baştan "approved" geldiğinden bu kilit hiçbir zaman devreye girmiyordu —
            // "Evrak gerekli" admin ayarı tamamen etkisizdi, evrak toplanmadan onay fiilen
            // otomatikti. Düzeltme: documentRequired=true ise başvuru asla doğrudan approved
            // olarak başlamaz, admin incelemesi (pending) bekler; admin sonradan onaylamaya
            // çalıştığında mevcut DOCUMENTS_REQUIRED kontrolü artık gerçekten devreye girer.
            var requireApproval = (await travelSettings.GetAsync(ct)).General.RequireApproval
                || Nexora.Domain.Common.TravelRestrictionRules.DocumentRequired(travel.RestrictionsJson);
            newStatus = waitlistMode ? "waitlist" : (requireApproval ? "pending" : "approved");

            if (requiresSeat && !waitlistMode)
            {
                var usedSeats = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                // Kullanıcı isteği (2026-08-07, senaryo 2): misafir (guest) artık herhangi bir boş
                // koltuğu seçemez — yalnızca rezervasyondaki bir yetişkin yolcunun HEMEN YANINDAKİ
                // koltuğa oturabilir (refakatçiyle aynı mantık, ama misafir gerçek/NVI doğrulamalı
                // bir kişi olduğu için kendi TravelApplication kaydı var). Önce yolcu-olmayan
                // (guest) kişilerin koltuklarını ata, sonra guest'in koltuğunun bunlardan birine
                // bitişik olduğunu doğrula.
                var primaryPassengers = items.Where(i => i.Guest is null).ToList();
                foreach (var it in primaryPassengers)
                {
                    if (it.Seat is null)
                        throw new ConflictException("Bu gezi için her kişiye koltuk seçilmelidir.", "SEAT_REQUIRED");
                    if (!usedSeats.Add(it.Seat))
                        throw new ConflictException("Aynı koltuğu birden fazla kişiye veremezsiniz.", "SEAT_DUPLICATE");
                    await EnsureSeatAvailableAsync(travel.Id, bus!, it.Seat, ct);
                    await EnsureGenderAdjacencyAsync(travel.Id, bus!, it.Seat, it.Gender, it.FullName, accountParticipantIds, ct);
                }
                foreach (var it in items.Where(i => i.Guest is not null))
                {
                    if (it.Seat is null)
                        throw new ConflictException("Bu gezi için her kişiye koltuk seçilmelidir.", "SEAT_REQUIRED");
                    if (!usedSeats.Add(it.Seat))
                        throw new ConflictException("Aynı koltuğu birden fazla kişiye veremezsiniz.", "SEAT_DUPLICATE");
                    if (primaryPassengers.Count > 0)
                    {
                        var allowedAdjacent = primaryPassengers
                            .SelectMany(pp => BusSeatLayout.AdjacentLabels(bus!.TemplateId, pp.Seat!))
                            .ToHashSet(StringComparer.OrdinalIgnoreCase);
                        if (!allowedAdjacent.Contains(it.Seat))
                            throw new ConflictException(
                                "Misafir yalnızca yanınızdaki boş koltuğa oturabilir. Lütfen kendi koltuğunuzun hemen yanındaki bir koltuk seçin.",
                                "GUEST_SEAT_MUST_BE_ADJACENT");
                    }
                    await EnsureSeatAvailableAsync(travel.Id, bus!, it.Seat, ct);
                    await EnsureGenderAdjacencyAsync(travel.Id, bus!, it.Seat, it.Gender, it.FullName, accountParticipantIds, ct);
                }

            }
            else if (capacityOnlyVehicle && !waitlistMode)
            {
                var already = await uow.TravelApplications.GetActivePassengersByBusAsync(travel.Id, bus!.Id, ct);
                var remaining = bus.Capacity - already.Count;
                if (items.Count > remaining)
                    throw new ConflictException($"{bus.Name} için kalan kontenjan yetersiz (kalan: {Math.Max(0, remaining)}).", "VEHICLE_CAPACITY_FULL");
            }

            // Not: her yolcu için nextval() AYRI çağrılır (baseCodeNumber+index yerine). Tek bir
            // nextval() çağrısıyla "N ardışık değer" varsaymak yanlıştı — sequence yalnızca TEK bir
            // değerin atomik/benzersiz olmasını garanti eder, ardışıklığı değil. Eş zamanlı çoklu-
            // yolcu (misafir/çocuk dahil) rezervasyonlarda araya giren başka bir nextval() çağrısı
            // aynı değerleri "çalabiliyordu" ve IX_TravelApplications_Code unique constraint ihlali
            // ile TÜM rezervasyon (kapasitedeki çocuk/misafir dahil) başarısız oluyordu — canlı
            // eş zamanlı testte 3/3 koşuda tekrarlandı, düzeltme sonrası doğrulanmalı.
            var docStatus = Nexora.Domain.Common.TravelRestrictionRules.DocumentRequired(travel.RestrictionsJson) ? "pending" : "none";
            for (var index = 0; index < items.Count; index++)
            {
                var it = items[index];
                var codeNumber = await uow.TravelApplications.NextCodeNumberAsync(ct);
                var code = $"GZB-{codeNumber:D6}";
                var seatBusId = waitlistMode ? null : bus?.Id;
                var seatNumber = waitlistMode ? null : it.Seat;
                TravelApplication application;
                if (it.Guest is not null)
                {
                    application = TravelApplication.CreateGuest(
                        travel.Id, actorId,
                        it.Guest.FullName, it.Guest.Tckn, it.Guest.BirthDate, it.Guest.Phone, it.Guest.Email, it.Guest.Gender,
                        seatBusId, seatNumber, code, currentUser.Name);
                    application.SetDocumentStatus(docStatus);
                    if (newStatus != "pending") application.SetStatus(newStatus);
                    application.AddPassenger(TravelApplicationPassenger.Create(application.Id, actorId, it.Gender, seatBusId, seatNumber, true));
                }
                else
                {
                    application = TravelApplication.Create(
                        travel.Id, it.Participant!.Id, newStatus, docStatus, "pending",
                        seatBusId, seatNumber, "", code, currentUser.Name);
                    application.AddPassenger(TravelApplicationPassenger.Create(application.Id, it.Participant!.Id, it.Gender, seatBusId, seatNumber, true));
                }
                await uow.TravelApplications.AddAsync(application, ct);
                created.Add((application, it));
            }

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        await travelApplications.SyncCountsAsync(travel.Id, ct);

        // Kullanıcı isteği (2026-08-07): birleşik gezi mesaj şablonu sistemi — bu bildirimler
        // artık TravelSettings şablonlarından okunuyor (önceden burada hardcoded 3 metin vardı,
        // admin bunları değiştiremiyordu ve "application_received" olayı gerçek bir mesaj
        // olarak diğer modüllerle tutarlı değildi).
        var notifyEvent = newStatus == "waitlist" ? "waitlist" : newStatus == "approved" ? "approved" : "application_received";
        var notifCtx = new TravelNotificationContext(travel.Name, travel.StartDate, travel.Destination, travel.DeparturePoint);
        foreach (var (app, it) in created)
        {
            var notifyId = it.Guest is not null ? actorId : it.Participant!.Id;
            var who = it.Guest is not null ? it.Guest.FullName : it.Participant!.FullName;
            var phone = it.Guest is not null ? it.Guest.Phone : it.Participant!.Phone;
            await notifications.SendStatusAsync(notifyId, phone, who, notifCtx, notifyEvent, null, ct);
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            Result = LogResult.Success,
            EntityType = "TravelApplication",
            EntityId = created[0].App.Id,
            Module = "ParticipantTravels",
            Description = $"Vatandaş gezi rezervasyonu yaptı: {travel.Name} ({created.Count} kişi)",
            ActorUserId = actorId,
            ActorUserName = currentUser.Name,
            AdditionalDataJson = JsonSerializer.Serialize(new { count = created.Count }),
        }, ct);

        var cat = await uow.TravelCategories.GetByIdAsync(travel.CategoryId, ct);
        var primary = created[0];
        return BuildApplicationDto(primary.App, travel, cat, primary.Item.Participant, bus?.Name, bus?.PlateNumber, actorId);
    }

    private static string? NormalizeSeat(string? seat) => string.IsNullOrWhiteSpace(seat) ? null : seat.Trim();

    private async Task<ResolvedGuest> ResolveGuestAsync(CitizenTravelReserveGuest g, CancellationToken ct)
    {
        if (!TcKimlikValidator.IsValid(g.Tckn))
            throw new ConflictException("Misafirin T.C. kimlik numarası geçersiz.", "GUEST_TCKN_INVALID");
        if (g.BirthDate is null)
            throw new ConflictException("Misafirin doğum tarihi zorunludur.", "GUEST_BIRTHDATE_REQUIRED");
        if (string.IsNullOrWhiteSpace(g.Phone) || g.Phone.Count(char.IsDigit) < 10)
            throw new ConflictException("Misafirin telefon numarası geçersiz.", "GUEST_PHONE_INVALID");
        if (string.IsNullOrWhiteSpace(g.Email) || !g.Email.Contains('@'))
            throw new ConflictException("Misafirin e-posta adresi geçersiz.", "GUEST_EMAIL_INVALID");

        var res = await nvi.GetPersonAndChildrenAsync(g.Tckn.Trim(), g.BirthDate.Value, 18, ct);
        if (!res.Success || res.Person is null)
            throw new ConflictException("Misafirin kimlik bilgileri doğrulanamadı. Lütfen T.C. kimlik numarası ve doğum tarihini kontrol edin.", "GUEST_NVI_NOT_FOUND");

        var person = res.Person;
        var fullName = $"{person.FirstName} {person.LastName}".Trim();
        var gender = person.Gender.ToCode();
        return new ResolvedGuest(fullName, person.Tckn.Trim(), person.BirthDate, g.Phone.Trim(), g.Email.Trim(), gender, person.Address);
    }

    private static bool IsGuestEligible(Travel travel, ResolvedGuest g)
    {
        if (travel.Gender != "mixed" && travel.Gender != g.Gender) return false;
        var age = Age(g.BirthDate);
        if (travel.MinAge > 0 && age < travel.MinAge) return false;
        if (travel.MaxAge > 0 && age > travel.MaxAge) return false;
        return true;
    }

    private async Task EnforceParticipationLimitAsync(Travel travel, Guid participantId, string participantName, CancellationToken ct)
    {
        if (await LimitReachedAsync(travel, participantId, ct))
            throw new ConflictException($"{participantName} için bu dönemdeki gezi katılım sınırına ulaşıldı.", "PARTICIPATION_LIMIT_REACHED");
    }

    private async Task EnforceGuestParticipationLimitAsync(Travel travel, string tckn, string guestName, CancellationToken ct)
    {
        if (await GuestLimitReachedAsync(travel, tckn, ct))
            throw new ConflictException($"{guestName} için bu dönemdeki gezi katılım sınırına ulaşıldı.", "PARTICIPATION_LIMIT_REACHED");
    }

    private void EnforceTravelRestrictions(Travel travel, Participant participant, bool isSelfApplicant)
    {
        var residencyMode = Nexora.Domain.Common.TravelRestrictionRules.ReadResidencyModeRaw(travel.RestrictionsJson);
        var violation = Nexora.Domain.Common.EligibilityRules.CheckResidency(residencyMode, participant, null, SultangaziDistrictCode);
        if (violation is not null)
            throw new ConflictException($"{participant.FullName}: {violation.Message}", violation.ErrorCode);

        if (ReadRestrictionFlag(travel.RestrictionsJson, "requiresGuardianConsent")
            && Age(participant.BirthDate) < 18 && isSelfApplicant)
            throw new ConflictException($"{participant.FullName} 18 yaşından küçük; başvuru veli hesabından yapılmalıdır.", "GUARDIAN_CONSENT_REQUIRED");
    }

    // Not: eski RequiresSultangaziResidency/IsSultangaziResident yardımcıları buradan kaldırıldı —
    // artık hem katılımcı hem misafir yolu ReadResidencyMode/guestResidencyMode üzerinden aynı
    // güncel ikamet politikasını kullanıyor (basvuruhitetmeyenkurallar.md B-kovası #14d düzeltmesi).

    private static bool ReadRestrictionFlag(string restrictionsJson, string field)
    {
        if (string.IsNullOrWhiteSpace(restrictionsJson) || restrictionsJson == "{}") return false;
        try
        {
            using var doc = JsonDocument.Parse(restrictionsJson);
            if (!doc.RootElement.TryGetProperty(field, out var el)) return false;
            return el.ValueKind == JsonValueKind.True
                || (el.ValueKind == JsonValueKind.String && bool.TryParse(el.GetString(), out var b) && b);
        }
        catch { return false; }
    }


    private static long TravelLockKey(Guid travelId) => BitConverter.ToInt64(travelId.ToByteArray(), 0);

    // V07: TCKN-tabanlı TEK kimlik kilidi — kayıtlı yolcu ve misafir aynı kişi ise (aynı TCKN) AYNI
    // anahtara düşer; kayıtlı+misafir yollarındaki çift-kayıt/katılım-limiti yarışı serileşir. Katılım
    // sayacı da zaten TCKN ile birleşik sayıyor. TravelApplicationService.IdentityLockKey ile AYNI türetme.
    private static long IdentityLockKey(string? tckn) => BitConverter.ToInt64(
        System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("travel-person:" + (tckn ?? "").Trim())), 0);

    private async Task<bool> ResolveWaitlistModeAsync(Travel travel, int count, CancellationToken ct)
    {
        if (travel.Capacity <= 0) return false;

        var approved = await uow.TravelApplications.CountByTravelAndStatusAsync(travel.Id, "approved", ct);
        var pending = await uow.TravelApplications.CountByTravelAndStatusAsync(travel.Id, "pending", ct);
        if (approved + pending + count <= travel.Capacity) return false;

        // basvuruhitetmeyenkurallar.md (A-kovası, Gezi #13) canlı testte kanıtlandı: global
        // "Yedek Liste" (ReserveListEnabled) master-switch'i admin panelinde sunuluyor ("Kontenjan
        // dolduğunda başvurular yedek sıraya alınır") ama hiçbir yerde okunmuyordu — yedek liste
        // davranışı SADECE her seferin kendi ReserveCapacity>0 alanına bağlıydı. Global switch KAPALI
        // olsa bile (ReserveListEnabled=false), ReserveCapacity>0 olan bir sefer yine de yedek listeye
        // alıyordu. Düzeltme: global switch artık gerçek bir kapı görevi görüyor.
        if (!(await travelSettings.GetAsync(ct)).General.ReserveListEnabled)
            throw new ConflictException("Gezi kontenjanı dolu.", "CAPACITY_FULL");

        if (travel.ReserveCapacity <= 0)
            throw new ConflictException("Gezi kontenjanı dolu.", "CAPACITY_FULL");

        var waitlisted = await uow.TravelApplications.CountByTravelAndStatusAsync(travel.Id, "waitlist", ct);
        if (waitlisted + count > travel.ReserveCapacity)
            throw new ConflictException("Gezi kontenjanı ve yedek listesi dolu.", "CAPACITY_FULL");

        return true;
    }

    public async Task<PagedResult<CitizenTravelApplicationDto>> GetApplicationsAsync(CitizenTravelApplicationListParams p, CancellationToken ct)
    {
        var participantId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participantIds = new List<Guid> { participantId };
        if (string.Equals(p.Scope, "family", StringComparison.OrdinalIgnoreCase))
        {
            var children = await uow.Participants.GetChildrenAsync(participantId, ct);
            participantIds.AddRange(children.Select(c => c.Id));
        }

        participantIds = participantIds.Distinct().ToList();

        var paged = await uow.TravelApplications.GetByParticipantsAsync(participantIds, p.Status, p.Period, p.PageResolved, p.LimitResolved, ct, p.Search);
        var items = await MapManyAsync(paged.Items, participantId, ct);

        return new PagedResult<CitizenTravelApplicationDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task CancelApplicationAsync(Guid applicationId, CancellationToken ct)
    {
        var participantId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var application = await uow.TravelApplications.GetWithPassengersAsync(applicationId, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "TRAVEL_APPLICATION_NOT_FOUND");

        var allowedIds = new List<Guid> { participantId };
        var children = await uow.Participants.GetChildrenAsync(participantId, ct);
        allowedIds.AddRange(children.Select(c => c.Id));

        if (!allowedIds.Contains(application.ParticipantId))
            throw new ForbiddenException("Bu başvuruya erişim yetkiniz yok.", "APPLICATION_FORBIDDEN");

        if (application.Status == "rejected")
            throw new ConflictException("Reddedilmiş başvuru iptal edilemez.", "APPLICATION_NOT_CANCELABLE");

        // Bulgu (2026-10-04, canlı QA denetimi — nihai prod-öncesi tur, backend worker
        // "jaguar" tarafından bulundu): zaten iptal edilmiş bir başvuruyu TEKRAR iptal
        // etme çağrısı için hiçbir erken-çıkış yoktu — ikinci çağrı tüm iptal/bildirim/
        // waitlist-terfi mantığını TEKRAR çalıştırıyordu (fonksiyonel olarak zararsız —
        // PromoteWaitlistCoreAsync canlı DB sayımıyla kapasiteyi yeniden doğruluyor —
        // ama vatandaşa 2. bir iptal bildirimi/push gidiyordu ve audit log'a aynı olay
        // 2. kez yazılıyordu). Artık idempotent: zaten iptal edilmiş bir başvuruya
        // tekrar çağrılınca sessizce no-op olarak başarılı döner (yeniden deneme/çift
        // tıklama güvenli, hata göstermez).
        if (application.Status == "cancelled")
            return;

        var travel = await uow.Travels.GetByIdAsync(application.TravelId, ct);
        if (travel is not null)
        {
            var deadline = travel.StartDate.AddHours(-travel.CancellationDeadlineHours);
            if (DateTime.UtcNow > deadline) // UAT 2026-09-24: StartDate UTC; duvar saati iptal süresini 3 saat erken kapatıyordu
            {
                var hours = travel.CancellationDeadlineHours;
                var msg = hours > 0
                    ? $"Bu gezi için son iptal süresi doldu. İptal, kalkıştan en az {hours} saat önce yapılabilir."
                    : "Başlamış veya geçmiş bir gezi için kayıt iptal edilemez.";
                throw new ConflictException(msg, "CANCEL_WINDOW_PASSED");
            }
        }

        var appsToCancel = new List<TravelApplication> { application };
        var cascaded = 0;
        if (!application.IsGuest)
        {
            var guests = await uow.TravelApplications.FindAsync(
                g => g.IsGuest && g.TravelId == application.TravelId
                    && g.BroughtByParticipantId == application.ParticipantId
                    && g.Status != "rejected" && g.Status != "cancelled", ct);
            foreach (var g in guests)
            {
                var guestWithPassengers = await uow.TravelApplications.GetWithPassengersAsync(g.Id, ct);
                if (guestWithPassengers is null) continue;
                appsToCancel.Add(guestWithPassengers);
                cascaded++;
            }
        }

        var freedSeats = appsToCancel
            .Where(a => a.Status == "approved" && a.BusId.HasValue && !string.IsNullOrWhiteSpace(a.SeatNumber))
            .Select(a => (a.BusId, a.SeatNumber))
            .ToList();

        foreach (var app in appsToCancel)
        {
            foreach (var passenger in app.Passengers)
                passenger.Cancel();
            // C6 düzeltmesi (2026-09-21, Event modülüyle aynı bulgu): soft-delete yerine
            // Status="cancelled" set ediliyor, böylece global query filter (!IsDeleted)
            // kaydı "Başvurularım" listesinden tamamen silmez, geçmişte görünür kalır.
            app.SetStatus("cancelled");
            uow.TravelApplications.Update(app);
        }
        await uow.SaveChangesAsync(ct);

        if (freedSeats.Count > 0)
            foreach (var (busId, seat) in freedSeats)
                await travelApplications.PromoteWaitlistAfterFreeAsync(application.TravelId, busId, seat, ct);
        else
            await travelApplications.PromoteWaitlistAfterFreeAsync(application.TravelId, null, null, ct);

        // Kullanıcı isteği (2026-08-07): birleşik gezi mesaj şablonu sistemi — iptal bildirimi
        // (önceden bu akışta hiç bildirim gönderilmiyordu, admin/vatandaş iptal olduğunu
        // fark etmezdi).
        if (travel is not null)
        {
            var cancelCtx = new TravelNotificationContext(travel.Name, travel.StartDate, travel.Destination, travel.DeparturePoint);
            foreach (var app in appsToCancel)
            {
                var cancelParticipant = await uow.Participants.GetByIdAsync(app.ParticipantId, ct);
                var cancelName = app.IsGuest ? app.GuestFullName ?? "" : cancelParticipant?.FullName ?? "";
                var cancelPhone = app.IsGuest ? app.GuestPhone : cancelParticipant?.Phone;
                var cancelNotifyId = app.IsGuest ? participantId : app.ParticipantId;
                await notifications.SendStatusAsync(cancelNotifyId, cancelPhone, cancelName, cancelCtx, "cancelled", null, ct);
            }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Cancel,
            Result = LogResult.Success,
            EntityType = "TravelApplication",
            EntityId = application.Id,
            Module = "ParticipantTravels",
            Description = cascaded > 0
                ? $"Vatandaş gezi başvurusunu iptal etti (yanındaki {cascaded} misafir de iptal edildi)"
                : "Vatandaş gezi başvurusunu iptal etti",
            ActorUserId = participantId,
            ActorUserName = currentUser.Name,
        }, ct);
    }

    private async Task<List<CitizenTravelBusSeatMapDto>> BuildSeatMapsAsync(Travel travel, CancellationToken ct)
    {
        var assignments = await uow.TravelBuses.GetAssignmentsByTravelAsync(travel.Id, ct);
        if (assignments.Count == 0) return [];

        var accountIds = new HashSet<Guid>();
        var accountLastNames = new List<string>();
        if (currentUser.Id is Guid accountUid)
        {
            accountIds.Add(accountUid);
            var self = await uow.Participants.GetByIdAsync(accountUid, ct);
            if (LastNameOf(self?.FullName) is string selfLast) accountLastNames.Add(selfLast);
            foreach (var c in await uow.Participants.GetChildrenAsync(accountUid, ct))
            {
                accountIds.Add(c.Id);
                if (LastNameOf(c.FullName) is string childLast) accountLastNames.Add(childLast);
            }
        }

        var result = new List<CitizenTravelBusSeatMapDto>();
        foreach (var a in assignments)
        {
            var bus = await uow.TravelBuses.GetByIdAsync(a.BusId, ct);
            if (bus is null) continue;

            if (bus.IsCapacityOnly)
            {
                var activePassengers = await uow.TravelApplications.GetActivePassengersByBusAsync(travel.Id, a.BusId, ct);
                var capOccupants = activePassengers
                    .Select(p => new CitizenTravelSeatOccupantDto(p.SeatNumber ?? "", p.Gender))
                    .ToList();
                result.Add(new CitizenTravelBusSeatMapDto(
                    bus.Id, bus.Name, bus.PlateNumber, bus.TemplateId, bus.Capacity,
                    ToElement(new JsonObject()), [], capOccupants, [], bus.VehicleType, activePassengers.Count));
                continue;
            }

            var map = ParseSeatMap(a.SeatStatesJson ?? bus.SeatStatesJson);
            var locks = BusSeatMath.LockedSeats(bus.SeatStatesJson);
            foreach (var (seatId, status) in locks) SetStatus(map, seatId, status);

            var labelToId = BusSeatLayout.LabelToId(bus.TemplateId);
            var seated = await uow.TravelApplications.GetSeatedPassengersAsync(travel.Id, a.BusId, ct);
            var occupants = new List<CitizenTravelSeatOccupantDto>();
            var occupantGenderByLabel = new Dictionary<string, string>();
            var occupantNameByLabel = new Dictionary<string, string>();
            var seatedParticipantIds = seated.Select(p => p.ParticipantId).Distinct().ToList();
            var seatedLastNames = (await uow.Participants.FindAsync(pt => seatedParticipantIds.Contains(pt.Id), ct))
                .ToDictionary(pt => pt.Id, pt => LastNameOf(pt.FullName));
            foreach (var passenger in seated)
            {
                if (passenger.SeatNumber is null) continue;
                if (labelToId.TryGetValue(passenger.SeatNumber, out var seatId) && !locks.ContainsKey(seatId))
                    SetStatus(map, seatId, "occupied");
                seatedLastNames.TryGetValue(passenger.ParticipantId, out var passengerLast);
                var sameFamily = passengerLast is not null
                    && accountLastNames.Any(ln => string.Compare(ln, passengerLast, TurkishCulture, System.Globalization.CompareOptions.IgnoreCase) == 0);
                occupants.Add(new CitizenTravelSeatOccupantDto(
                    passenger.SeatNumber, passenger.Gender,
                    IsOwnAccount: accountIds.Contains(passenger.ParticipantId),
                    IsSameFamily: sameFamily));
                occupantGenderByLabel[passenger.SeatNumber] = passenger.Gender;
            }
            var seats = BuildSeatList(bus.TemplateId, map, occupantGenderByLabel, occupantNameByLabel);

            result.Add(new CitizenTravelBusSeatMapDto(
                bus.Id, bus.Name, bus.PlateNumber, bus.TemplateId, bus.Capacity,
                ToElement(map), [.. locks.Keys], occupants, seats, bus.VehicleType, seated.Count));
        }

        return [.. result.OrderBy(r => r.Name)];
    }

    // Düzeltme (2026-09-27, uçtan uca gezi testi): bu metot önceden SADECE "koltuk başka biri
    // tarafından dolu mu" kontrolü yapıyordu — koltuğun (a) otobüsün şablonunda GERÇEKTEN var
    // olup olmadığını, (b) admin tarafından "blocked" (rezervasyon için ayrılmış) / "driver" /
    // "guide" / "hidden" olarak işaretlenip işaretlenmediğini hiç kontrol etmiyordu. Canlı testte
    // kanıtlandı: "9999" (şablonda hiç yok) ve "blocked" bir koltuk her ikisi de sorunsuz approved
    // olarak kabul ediliyordu. Artık BusSeatLayout ile şablon geçerliliği, BusSeatMath.LockedSeats
    // ile blocked/driver/guide/hidden durumu da kontrol ediliyor.
    private async Task EnsureSeatAvailableAsync(Guid travelId, TravelBus bus, string seat, CancellationToken ct)
    {
        var validLabels = BusSeatLayout.LabelToId(bus.TemplateId).Keys;
        if (!validLabels.Contains(seat))
            throw new ConflictException("Geçersiz koltuk numarası. Lütfen koltuk haritasından bir koltuk seçin.", "SEAT_INVALID");

        var labelToId = BusSeatLayout.LabelToId(bus.TemplateId);
        if (labelToId.TryGetValue(seat, out var seatId))
        {
            var locked = BusSeatMath.LockedSeats(bus.SeatStatesJson);
            if (locked.ContainsKey(seatId))
                throw new ConflictException("Bu koltuk rezervasyona kapalı, lütfen başka koltuk seçin.", "SEAT_BLOCKED");
        }

        var seated = await uow.TravelApplications.GetSeatedPassengersAsync(travelId, bus.Id, ct);
        if (seated.Any(p => string.Equals(p.SeatNumber, seat, StringComparison.OrdinalIgnoreCase)))
            throw new ConflictException("Bu koltuk az önce alındı, lütfen başka koltuk seçin.", "SEAT_TAKEN");
    }

    /// <summary>
    /// Kullanıcı isteği (2026-08-07, senaryo 3): kadın yolcunun yanına farklı cinsiyetten biri
    /// oturamaz kuralının TEK istisnası — aynı soyadına sahip bir erkek (aile bireyi, ör. eş,
    /// baba, kardeş, evlat) yanına oturabilir. Bu istisna yalnızca kadın-erkek yan yana durumunda
    /// çalışır; iki farklı soyadlı erkek-kadın hâlâ engellenir.
    /// </summary>
    private async Task EnsureGenderAdjacencyAsync(Guid travelId, TravelBus bus, string seat, string gender, string? lastName, HashSet<Guid> accountParticipantIds, CancellationToken ct)
    {
        if (gender is not ("male" or "female")) return;

        var adjacent = BusSeatLayout.AdjacentLabels(bus.TemplateId, seat);
        if (adjacent.Count == 0) return;

        var passengers = await uow.TravelApplications.GetSeatedPassengersAsync(travelId, bus.Id, ct);
        var neighborIds = passengers
            .Where(p => p.SeatNumber is not null && adjacent.Contains(p.SeatNumber) && !accountParticipantIds.Contains(p.ParticipantId))
            .ToList();
        if (neighborIds.Count == 0) return;

        var neighborParticipantIds = neighborIds.Select(p => p.ParticipantId).Distinct().ToList();
        var neighborParticipants = (await uow.Participants.FindAsync(pt => neighborParticipantIds.Contains(pt.Id), ct))
            .ToDictionary(pt => pt.Id);

        foreach (var p in neighborIds)
        {
            if (p.Gender is not ("male" or "female") || p.Gender == gender) continue;

            neighborParticipants.TryGetValue(p.ParticipantId, out var neighbor);
            var sameFamily = neighbor is not null && SameLastName(lastName, neighbor.FullName);
            if (sameFamily) continue;

            throw new ConflictException("Yan koltuğa farklı cinsiyetten yolcu atanamaz. Lütfen başka koltuk seçin.", "SEAT_GENDER_RULE");
        }
    }

    /// <summary>Türkçe ad-soyad kuralı gereği son kelime soyad kabul edilir. Türkçe kültürle
    /// karşılaştırılır (İ/i büyük-küçük harf dönüşümü invariant/ordinal kültürde İngilizce I/i
    /// kurallarına göre çalışıp "İLERİ" ile "İleri"yi eşleştiremiyor — canlı testte kanıtlandı).</summary>
    private static readonly System.Globalization.CultureInfo TurkishCulture = new("tr-TR");

    private static bool SameLastName(string? a, string? b)
    {
        var la = LastNameOf(a);
        var lb = LastNameOf(b);
        return !string.IsNullOrWhiteSpace(la) && !string.IsNullOrWhiteSpace(lb)
            && string.Compare(la, lb, TurkishCulture, System.Globalization.CompareOptions.IgnoreCase) == 0;
    }

    private static string? LastNameOf(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return null;
        var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length == 0 ? null : parts[^1];
    }

    // Geçmiş yılda (örn. 2025) yapılmış hiçbir faaliyet/başvuru aktif yılı (2026) engellemez.
    private async Task<bool> HasActiveApplicationAsync(Guid participantId, Guid travelId, CancellationToken ct)
    {
        var currentYear = TurkeyTime.NowWallClock().Year;
        var participant = await uow.Participants.GetByIdAsync(participantId, ct);
        var tckn = participant?.Tckn;
        return (await uow.TravelApplications.FindAsync(
            a => a.TravelId == travelId && a.Status != "rejected" && a.Status != "cancelled" && a.ApplicationDate.Year == currentYear
                && ((!a.IsGuest && a.ParticipantId == participantId)
                    || (a.IsGuest && tckn != null && a.GuestTckn == tckn)), ct)).Any();
    }

    private async Task<bool> HasActiveGuestApplicationAsync(string tckn, Guid travelId, CancellationToken ct)
    {
        var currentYear = TurkeyTime.NowWallClock().Year;
        var participant = await uow.Participants.GetByTcknAsync(tckn, ct);
        var participantId = participant?.Id;
        return (await uow.TravelApplications.FindAsync(
            a => a.TravelId == travelId && a.Status != "rejected" && a.Status != "cancelled" && a.ApplicationDate.Year == currentYear
                && ((a.IsGuest && a.GuestTckn == tckn)
                    || (!a.IsGuest && participantId != null && a.ParticipantId == participantId)), ct)).Any();
    }

    private async Task EnsureNoPreviousParticipationAsync(Guid participantId, Guid travelId, string name, CancellationToken ct)
    {
        var currentYear = TurkeyTime.NowWallClock().Year;
        var attended = await uow.TravelAttendances.FindAsync(
            a => a.TravelId == travelId && a.ParticipantId == participantId && a.Status == "attended" && a.MarkedAt.Year == currentYear, ct);
        if (attended.Any())
            throw new ConflictException($"{name} bu geziye daha önce katılmış ve tekrar başvuramaz.", "PREVIOUSLY_ATTENDED");
    }

    /// <summary>
    /// Ayarlarda "no-show sonraki geziyi engelle" açıksa: katılımcının en yakın
    /// geçmiş (kalkışı bugünden önce olan) sefer için yoklama kaydı "absent" ise,
    /// yeni bir gezi başvurusu reddedilir. Katılımcının hiç geçmiş seferi yoksa
    /// veya son seferine katıldıysa (attended) engel yoktur.
    /// Geçmiş yıldaki (2025) devamsızlık aktif yılı (2026) engellemez.
    /// </summary>
    private async Task EnsureNoRecentNoShowAsync(Guid participantId, string name, CancellationToken ct)
    {
        var settings = await travelSettings.GetAsync(ct);
        if (!settings.General.NoShowBlocksNextTravel) return;

        var now = TurkeyTime.NowWallClock();
        var latest = await uow.TravelAttendances.GetMostRecentPastByParticipantAsync(participantId, now, ct);
        if (latest is not null && latest.Status == "absent" && latest.MarkedAt.Year == now.Year)
            throw new ConflictException(
                $"{name} önceki gezisine katılmadığı (devamsız işaretlendiği) için bir sonraki geziye başvuramaz.",
                "PREVIOUS_NO_SHOW");
    }

    private async Task EnsureNoActiveOverlapAsync(Guid participantId, Guid travelId, DateTime travelStart, string name, CancellationToken ct)
        => await EnsureNoOverlapAsync(
            await uow.TravelApplications.GetActiveByParticipantAsync(participantId, ct),
            travelId, travelStart, name, ct);

    private async Task EnsureNoActiveGuestOverlapAsync(string tckn, Guid travelId, DateTime travelStart, string name, CancellationToken ct)
        => await EnsureNoOverlapAsync(
            await uow.TravelApplications.GetActiveByGuestTcknAsync(tckn, ct),
            travelId, travelStart, name, ct);

    private async Task EnsureNoOverlapAsync(List<TravelApplication> activeApps, Guid travelId, DateTime travelStart, string name, CancellationToken ct)
    {
        var conflictTravelIds = activeApps.Where(a => a.TravelId != travelId).Select(a => a.TravelId).Distinct().ToList();
        if (conflictTravelIds.Count == 0) return;

        var conflictTravels = await uow.Travels.FindAsync(t => conflictTravelIds.Contains(t.Id), ct);
        var overlappingTravel = conflictTravels.FirstOrDefault(t => t.StartDate.Date == travelStart.Date);
        if (overlappingTravel is not null)
            throw new ConflictException(
                $"{name} bu tarihte zaten \"{overlappingTravel.Name}\" gezisine başvurmuş. Aynı anda yalnızca bir geziye başvurulabilir.",
                "TRAVEL_OVERLAP");
    }

    private async Task<HashSet<Guid>> AppliedTravelIdsAsync(Guid? participantId, List<Guid> travelIds, CancellationToken ct)
    {
        if (participantId is null || travelIds.Count == 0) return [];

        var apps = await uow.TravelApplications.FindAsync(
            a => travelIds.Contains(a.TravelId) && a.ParticipantId == participantId.Value && a.Status != "rejected" && a.Status != "cancelled", ct);
        return apps.Select(a => a.TravelId).ToHashSet();
    }

    private async Task<HashSet<Guid>> RequiresSeatMapAsync(List<Guid> travelIds, CancellationToken ct)
    {
        var result = new HashSet<Guid>();
        foreach (var id in travelIds)
        {
            var assignments = await uow.TravelBuses.GetAssignmentsByTravelAsync(id, ct);
            if (assignments.Count == 0) continue;
            foreach (var a in assignments)
            {
                var bus = await uow.TravelBuses.GetByIdAsync(a.BusId, ct);
                if (bus is not null && !bus.IsCapacityOnly) { result.Add(id); break; }
            }
        }
        return result;
    }

    private async Task<Dictionary<Guid, TravelCategory>> LoadCategoriesAsync(IEnumerable<Guid> categoryIds, CancellationToken ct)
    {
        var ids = categoryIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        return (await uow.TravelCategories.FindAsync(c => ids.Contains(c.Id), ct)).ToDictionary(c => c.Id);
    }

    private CitizenTravelDto ToCard(Travel t, TravelCategory? cat, bool requiresSeat, Participant? participant, bool alreadyApplied, IReadOnlyList<Participant>? children = null)
    {
        var appOpen = Nexora.Domain.Common.RegistrationWindow.IsOpen(TurkeyTime.NowWallClock(), t.RegistrationStartDate, t.RegistrationEndDate);
        var eligibleForSelf = participant is not null && IsEligible(t, participant);
        var allowChildren = Nexora.Domain.Common.TravelRestrictionRules.AllowChildren(t.RestrictionsJson);
        var eligibleForChildren = allowChildren && children is { Count: > 0 } && children.Any(c => IsEligible(t, c) || (eligibleForSelf && IsAccompaniableMinor(t, c)));
        return new(
            t.Id, t.Code, t.Name,
            cat?.Name ?? "", cat?.Color ?? "",
            t.Destination, t.Latitude, t.Longitude,
            t.StartDate, t.EndDate, t.StartDate.Date == t.EndDate.Date, t.Gender, t.MinAge, t.MaxAge,
            t.Capacity, t.RegisteredCount, t.ReserveCapacity, t.ReserveCount, requiresSeat,
            ExtractImageUrl(t.ImagesJson),
            ExtractPhotoUrls(t.ImagesJson),
            BuildPreview(t.Description),
            eligibleForSelf || eligibleForChildren,
            alreadyApplied,
            ExtractGuideName(t.CrewJson),
            ExtractDriverName(t.CrewJson),
            t.RegistrationStartDate, t.RegistrationEndDate, appOpen);
    }

    private async Task<List<CitizenTravelApplicationDto>> MapManyAsync(List<TravelApplication> apps, Guid currentParticipantId, CancellationToken ct)
    {
        if (apps.Count == 0) return [];

        var travelIds = apps.Select(a => a.TravelId).Distinct().ToList();
        var travels = (await uow.Travels.FindIncludingDeletedAsync(t => travelIds.Contains(t.Id), ct)).ToDictionary(t => t.Id);
        var catIds = travels.Values.Select(t => t.CategoryId).Distinct().ToList();
        var cats = catIds.Count == 0
            ? new Dictionary<Guid, TravelCategory>()
            : (await uow.TravelCategories.FindAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id);
        var partIds = apps.Select(a => a.ParticipantId).Distinct().ToList();
        var parts = (await uow.Participants.FindAsync(p => partIds.Contains(p.Id), ct)).ToDictionary(p => p.Id);
        var busIds = apps.Where(a => a.BusId.HasValue).Select(a => a.BusId!.Value).Distinct().ToList();
        var buses = busIds.Count == 0
            ? new Dictionary<Guid, TravelBus>()
            : (await uow.TravelBuses.FindAsync(b => busIds.Contains(b.Id), ct)).ToDictionary(b => b.Id);

        return apps.Select(a =>
        {
            var travel = travels.GetValueOrDefault(a.TravelId);
            var cat = travel is not null ? cats.GetValueOrDefault(travel.CategoryId) : null;
            var part = parts.GetValueOrDefault(a.ParticipantId);
            var bus = a.BusId.HasValue ? buses.GetValueOrDefault(a.BusId.Value) : null;
            return BuildApplicationDto(a, travel, cat, part, bus?.Name, bus?.PlateNumber, currentParticipantId);
        }).ToList();
    }

    private static CitizenTravelApplicationDto BuildApplicationDto(
        TravelApplication a, Travel? travel, TravelCategory? cat, Participant? part, string? busName, string? plateNumber, Guid currentParticipantId)
    {
        var personName = a.IsGuest
            ? $"{a.GuestFullName ?? "Misafir"} (Misafir)"
            : part?.FullName ?? "";
        var isSelf = !a.IsGuest && a.ParticipantId == currentParticipantId;
        return new(
            a.Id, a.Code, a.TravelId, travel?.Name ?? "",
            cat?.Name ?? "", cat?.Color ?? "",
            travel?.Destination ?? "", travel?.Latitude, travel?.Longitude,
            travel?.StartDate ?? a.ApplicationDate, travel?.EndDate ?? a.ApplicationDate,
            travel?.Destination ?? "—",
            a.Status, a.ParticipantId, personName,
            isSelf,
            a.BusId, busName, plateNumber, a.SeatNumber, a.ApplicationDate,
            travel?.CancellationDeadlineHours ?? 0,
            travel is not null ? ExtractGuideName(travel.CrewJson) : null,
            travel?.IsDeleted ?? false,
            a.RejectionReason);
    }

    private static string? ExtractDriverName(string crewJson)
    {
        if (string.IsNullOrWhiteSpace(crewJson) || crewJson == "{}") return null;
        try
        {
            var doc = JsonDocument.Parse(crewJson);
            if (doc.RootElement.TryGetProperty("driver", out var driver) &&
                driver.TryGetProperty("name", out var nameEl) &&
                nameEl.ValueKind == JsonValueKind.String)
                return nameEl.GetString();
        }
        catch { }
        return null;
    }

    private static string? ExtractGuideName(string crewJson)
    {
        if (string.IsNullOrWhiteSpace(crewJson) || crewJson == "{}") return null;
        try
        {
            var doc = JsonDocument.Parse(crewJson);
            if (doc.RootElement.TryGetProperty("responsible", out var responsible) &&
                responsible.TryGetProperty("name", out var nameEl) &&
                nameEl.ValueKind == JsonValueKind.String)
                return nameEl.GetString();
        }
        catch { }
        return null;
    }

    private bool IsEligible(Travel travel, Participant participant)
    {
        if (Nexora.Domain.Common.FacilityEligibilityRules.CheckGender(travel.Gender, participant.Gender) is not null)
            return false;

        var age = Age(participant.BirthDate);
        if (travel.MinAge > 0 && age < travel.MinAge) return false;
        if (travel.MaxAge > 0 && age > travel.MaxAge) return false;

        var residencyMode = Nexora.Domain.Common.TravelRestrictionRules.ReadResidencyModeRaw(travel.RestrictionsJson);
        if (Nexora.Domain.Common.EligibilityRules.CheckResidency(residencyMode, participant, null, SultangaziDistrictCode) is not null) return false;

        return true;
    }

    /// <summary>
    /// Kullanıcı isteği (2026-08-07, senaryo 4): otobüslü gezilerde çocuk getirme artık ayrı bir
    /// admin ayarı (allowChildren) ile kontrol ediliyor — kapalıysa hiçbir çocuk (veli hesabından
    /// bile) rezervasyona eklenemez. Açıksa, gezinin kendi childMinAge/childMaxAge/childGenderMode
    /// ayarlarına uyan çocuklar eklenebilir (travel.MaxAge genel yetişkin üst sınırı, çocuklar için
    /// ayrı bir yaş penceresi tanımlanabilir — örn. gezi maxAge=65 olsa da çocuklar için 6-12 yaş
    /// aralığı istenebilir).
    /// </summary>
    private bool IsAccompaniableMinor(Travel travel, Participant participant)
    {
        if (Age(participant.BirthDate) >= 18) return false;
        if (!Nexora.Domain.Common.TravelRestrictionRules.AllowChildren(travel.RestrictionsJson)) return false;

        var age = Age(participant.BirthDate);
        var childMinAge = Nexora.Domain.Common.TravelRestrictionRules.ChildMinAge(travel.RestrictionsJson);
        var childMaxAge = Nexora.Domain.Common.TravelRestrictionRules.ChildMaxAge(travel.RestrictionsJson);
        if (age < childMinAge || age > childMaxAge) return false;

        var childGenderMode = Nexora.Domain.Common.TravelRestrictionRules.ChildGenderMode(travel.RestrictionsJson);
        var childGender = GenderStr(participant.Gender);
        if (childGenderMode is "male" or "female" && childGenderMode != childGender) return false;

        var residencyMode = Nexora.Domain.Common.TravelRestrictionRules.ReadResidencyModeRaw(travel.RestrictionsJson);
        if (Nexora.Domain.Common.EligibilityRules.CheckResidency(residencyMode, participant, null, SultangaziDistrictCode) is not null) return false;

        return true;
    }

    /// <summary>Kullanıcıya gösterilecek çocuk uygunsuzluk nedeni (yaş/cinsiyet/kapalı ayar).</summary>
    private static string? ChildIneligibleReason(Travel travel, Participant child)
    {
        if (!Nexora.Domain.Common.TravelRestrictionRules.AllowChildren(travel.RestrictionsJson))
            return "Bu geziye çocuk katılımı kapalı";

        var age = Age(child.BirthDate);
        var childMinAge = Nexora.Domain.Common.TravelRestrictionRules.ChildMinAge(travel.RestrictionsJson);
        var childMaxAge = Nexora.Domain.Common.TravelRestrictionRules.ChildMaxAge(travel.RestrictionsJson);
        if (age < childMinAge || age > childMaxAge)
            return $"Çocuk yaşı {childMinAge}-{childMaxAge} aralığında olmalı";

        var childGenderMode = Nexora.Domain.Common.TravelRestrictionRules.ChildGenderMode(travel.RestrictionsJson);
        if (childGenderMode is "male" or "female" && childGenderMode != GenderStr(child.Gender))
            return childGenderMode == "male" ? "Yalnızca erkek çocuk kabul edilir" : "Yalnızca kız çocuk kabul edilir";

        return null;
    }

    private string? IneligibleReason(Travel travel, Participant participant)
    {
        if (Nexora.Domain.Common.FacilityEligibilityRules.CheckGender(travel.Gender, participant.Gender) is not null)
            return travel.Gender == "male" ? "Yalnızca erkek katılımcılar" : "Yalnızca kadın katılımcılar";

        var age = Age(participant.BirthDate);
        if (travel.MinAge > 0 && age < travel.MinAge) return $"En az {travel.MinAge} yaş şartı";
        if (travel.MaxAge > 0 && age > travel.MaxAge) return $"En fazla {travel.MaxAge} yaş şartı";

        var residencyMode = Nexora.Domain.Common.TravelRestrictionRules.ReadResidencyModeRaw(travel.RestrictionsJson);
        var violation = Nexora.Domain.Common.EligibilityRules.CheckResidency(residencyMode, participant, null, SultangaziDistrictCode);
        if (violation is not null) return violation.Message;

        return null;
    }

    private async Task<bool> LimitReachedAsync(Travel travel, Guid participantId, CancellationToken ct)
    {
        var (enforced, start, end, limit) = await ResolveParticipationWindowAsync(travel, ct);
        if (!enforced) return false;

        var count = await uow.TravelApplications.CountActiveByParticipantInTravelWindowAsync(participantId, start, end, travel.Id, ct);
        return count >= limit;
    }

    private async Task<bool> GuestLimitReachedAsync(Travel travel, string tckn, CancellationToken ct)
    {
        var (enforced, start, end, limit) = await ResolveParticipationWindowAsync(travel, ct);
        if (!enforced) return false;

        var count = await uow.TravelApplications.CountActiveByGuestTcknInTravelWindowAsync(tckn, start, end, travel.Id, ct);
        return count >= limit;
    }

    private async Task<(bool Enforced, DateTime Start, DateTime End, int Limit)> ResolveParticipationWindowAsync(Travel travel, CancellationToken ct)
    {
        if (Nexora.Domain.Common.TravelParticipationLimitRules.IsExempt(travel.ParticipationPeriod, travel.ExemptFromParticipationLimit))
            return (false, default, default, 0);

        var period = travel.ParticipationPeriod;
        var limit = travel.ParticipationLimit;
        if (period == "none" || limit <= 0)
        {
            var settings = await travelSettings.GetAsync(ct);
            if (Nexora.Domain.Common.TravelParticipationLimitRules.IsExemptAsVehicleFree(travel.BusCount, settings.Participation.ApplyToVehicleFreeTravels))
                return (false, default, default, 0);
            period = settings.Participation.DefaultPeriod;
            limit = settings.Participation.DefaultLimitCount;
        }
        if (period == "none" || limit <= 0) return (false, default, default, 0);

        var (start, end) = Nexora.Domain.Common.TravelRestrictionRules.PeriodWindow(period, travel.StartDate);
        if (start == DateTime.MinValue) return (false, default, default, 0);

        return (true, start, end, limit);
    }

    private async Task<List<CitizenTravelApplicantDto>> BuildApplicantsAsync(Travel travel, Participant? self, CancellationToken ct)
    {
        if (self is null) return [];

        var people = new List<(Participant Person, bool IsSelf)> { (self, true) };
        var children = await uow.Participants.GetChildrenAsync(self.Id, ct);
        people.AddRange(children.Select(c => (c, false)));

        var ids = people.Select(x => x.Person.Id).ToList();
        var activeApps = await uow.TravelApplications.GetActiveByParticipantsAndTravelAsync(ids, travel.Id, ct);
        var appliedIds = activeApps.Select(a => a.ParticipantId).ToHashSet();

        var result = new List<CitizenTravelApplicantDto>();
        var noShowBlocksNext = (await travelSettings.GetAsync(ct)).General.NoShowBlocksNextTravel;
        foreach (var x in people)
        {
            var eligible = IsEligible(travel, x.Person);
            var isMinor = !x.IsSelf && Age(x.Person.BirthDate) < 18;
            var requiresGuardian = !eligible && !x.IsSelf && IsAccompaniableMinor(travel, x.Person) && IsEligible(travel, self);
            var reason = eligible ? null
                : requiresGuardian ? "Yalnızca sizinle (yetişkin) birlikte katılabilir"
                : isMinor ? (ChildIneligibleReason(travel, x.Person) ?? IneligibleReason(travel, x.Person))
                : IneligibleReason(travel, x.Person);
            if ((eligible || requiresGuardian) && !appliedIds.Contains(x.Person.Id) && await LimitReachedAsync(travel, x.Person.Id, ct))
            {
                eligible = false;
                requiresGuardian = false;
                reason = "Bu dönem gezi katılım sınırınız dolu";
            }
            if ((eligible || requiresGuardian) && !appliedIds.Contains(x.Person.Id) && noShowBlocksNext)
            {
                var latest = await uow.TravelAttendances.GetMostRecentPastByParticipantAsync(x.Person.Id, TurkeyTime.NowWallClock(), ct);
                if (latest is not null && latest.Status == "absent")
                {
                    eligible = false;
                    requiresGuardian = false;
                    reason = "Önceki geziye katılmadığı için bu sefere başvuramaz";
                }
            }
            result.Add(new CitizenTravelApplicantDto(
                x.Person.Id, x.Person.FullName, x.IsSelf, Age(x.Person.BirthDate),
                x.Person.Gender == Gender.Male ? "male" : "female",
                eligible, reason,
                appliedIds.Contains(x.Person.Id), requiresGuardian));
        }
        return result;
    }

    private static int Age(DateTime birth)
    {
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    private static string GenderStr(Gender g) => g == Gender.Female ? "female" : "male";

    private static JsonObject ParseSeatMap(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new JsonObject();
        try { return JsonNode.Parse(json)?.AsObject() ?? new JsonObject(); }
        catch { return new JsonObject(); }
    }

    private static void SetStatus(JsonObject map, string seatId, string status)
    {
        if (map[seatId] is JsonObject o) o["status"] = status;
        else map[seatId] = new JsonObject { ["status"] = status };
    }

    private static List<CitizenTravelSeatDto> BuildSeatList(string? templateId, JsonObject map, Dictionary<string, string> occupantGenderByLabel, Dictionary<string, string>? occupantNameByLabel = null)
    {
        var seats = new List<CitizenTravelSeatDto>();
        foreach (var (seatId, label) in BusSeatLayout.IdToLabel(templateId))
        {
            var status = ReadSeatStatus(map, seatId);
            if (status == "hidden") continue;
            string? occupantGender = null;
            string? occupantName = null;
            if (status == "occupied" && occupantGenderByLabel.TryGetValue(label, out var gender))
                occupantGender = gender is "male" or "female" ? gender : null;
            if (status == "occupied" && (occupantNameByLabel?.TryGetValue(label, out var name) ?? false))
                occupantName = name;
            seats.Add(new CitizenTravelSeatDto(label, status, occupantGender, occupantName));
        }
        return seats;
    }

    private static string ReadSeatStatus(JsonObject map, string seatId)
    {
        if (map[seatId] is JsonObject o && o["status"] is JsonValue v && v.TryGetValue(out string? status) && !string.IsNullOrWhiteSpace(status))
            return status.ToLowerInvariant();
        return "free";
    }

    private static JsonElement ToElement(JsonObject map)
        => JsonDocument.Parse(map.ToJsonString()).RootElement.Clone();

    private static string? ExtractImageUrl(string imagesJson)
    {
        if (string.IsNullOrWhiteSpace(imagesJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(imagesJson);
            var root = doc.RootElement;
            foreach (var group in new[] { "web", "mobile" })
            {
                if (!root.TryGetProperty(group, out var groupEl) || groupEl.ValueKind != JsonValueKind.Object)
                    continue;
                foreach (var variant in new[] { "cover", "card", "thumb" })
                {
                    if (groupEl.TryGetProperty(variant, out var variantEl)
                        && variantEl.ValueKind == JsonValueKind.Object
                        && variantEl.TryGetProperty("url", out var urlEl)
                        && urlEl.ValueKind == JsonValueKind.String)
                    {
                        var url = urlEl.GetString();
                        if (!string.IsNullOrWhiteSpace(url)) return FileUrl.Normalize(url);
                    }
                }
            }
        }
        catch
        {
            return null;
        }
        return null;
    }

    private static List<string>? ExtractPhotoUrls(string imagesJson)
    {
        if (string.IsNullOrWhiteSpace(imagesJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(imagesJson);
            if (!doc.RootElement.TryGetProperty("photos", out var photosEl) || photosEl.ValueKind != JsonValueKind.Array)
                return null;
            var urls = new List<string>();
            foreach (var p in photosEl.EnumerateArray())
            {
                if (p.TryGetProperty("url", out var urlEl) && urlEl.ValueKind == JsonValueKind.String)
                {
                    var url = urlEl.GetString();
                    var normalized = FileUrl.Normalize(url);
                    if (!string.IsNullOrWhiteSpace(normalized)) urls.Add(normalized);
                }
            }
            return urls.Count > 0 ? urls : null;
        }
        catch { return null; }
    }

    private static string BuildPreview(string description)
    {
        if (string.IsNullOrWhiteSpace(description)) return "";
        var text = HtmlTagRegex().Replace(description, " ");
        text = WhitespaceRegex().Replace(System.Net.WebUtility.HtmlDecode(text), " ").Trim();
        return text.Length <= 160 ? text : text[..160].TrimEnd() + "…";
    }

    [GeneratedRegex("<.*?>", RegexOptions.Singleline)]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
