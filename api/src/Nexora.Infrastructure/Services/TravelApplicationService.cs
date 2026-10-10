using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;
using Hangfire;
using Nexora.Application.Configuration;
using Nexora.Application.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Travels;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services.Scheduled;

namespace Nexora.Infrastructure.Services;

public class TravelApplicationService(IUnitOfWork uow, ICurrentUser currentUser, IActivityLogger log, IExcelService excelService, IOptionsMonitor<ResidencySettings> residencySettings, ITravelSettingsService travelSettings, ITravelNotificationService notifications, IUserScopeService userScope, IAuditService audit, INotificationDispatcher dispatcher, Nexora.Application.Features.Notifications.INotificationService inAppNotifications, IConfiguration config, IServiceProvider serviceProvider, ISmsGovernanceService smsGovernance) : ITravelApplicationService
{
    private string SultangaziDistrictCode => residencySettings.CurrentValue.SultangaziDistrictCode;

    // TravelService.EnsureInScopeAsync ile ayni desen — basvurular gezi uzerinden kapsama baglaniyor.
    private async Task EnsureTravelInScopeAsync(Guid travelId, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedIds = await userScope.GetScopedRefIdsAsync(uid, "travels", ct);
        if (scopedIds is not null && !scopedIds.Contains(travelId))
            throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");
    }

    public async Task<PagedResult<TravelApplicationDto>> GetPagedAsync(TravelApplicationListParams p, CancellationToken ct)
    {
        var paged = await uow.TravelApplications.GetPagedAsync(p, ct);
        var scopedIds = currentUser.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, "travels", ct) : null;
        if (scopedIds is not null)
        {
            var filtered = paged.Items.Where(a => scopedIds.Contains(a.TravelId)).ToList();
            paged = new PagedResult<TravelApplication> { Items = filtered, Total = filtered.Count, Page = paged.Page, Limit = paged.Limit };
        }
        return await MapPageAsync(paged, ct);
    }

    public async Task<TravelApplicationSummaryDto> GetSummaryAsync(Guid? travelId, CancellationToken ct)
    {
        if (travelId.HasValue) await EnsureTravelInScopeAsync(travelId.Value, ct);

        var (total, approved, reviewing, rejected, waitlist) = await uow.TravelApplications.GetSummaryAsync(travelId, ct);
        return new TravelApplicationSummaryDto(total, approved, reviewing, rejected, waitlist);
    }

    public async Task<TravelApplicationDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.TravelApplications.GetWithPassengersAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "TRAVEL_APPLICATION_NOT_FOUND");
        await EnsureTravelInScopeAsync(app.TravelId, ct);
        return await MapDetailAsync(app, ct);
    }

    public async Task<TravelApplicationDto> CreateAsync(TravelApplicationFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.TravelId, req.ParticipantId });

        var travel = await uow.Travels.GetByIdAsync(req.TravelId, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        if (!travel.IsActive)
            throw new ConflictException("Bu gezi şu an başvuruya kapalıdır.", "TRAVEL_NOT_ACTIVE");

        var today = TurkeyTime.TodayDate();
        if (TurkeyTime.ToTurkey(travel.StartDate).Date < today)
            throw new ConflictException("Geçmiş geziye başvuru yapılamaz.", "TRAVEL_IN_PAST");
        var now = TurkeyTime.NowWallClock();
        if (!Nexora.Domain.Common.RegistrationWindow.HasStarted(now, travel.RegistrationStartDate))
            throw new ConflictException($"Başvurular {travel.RegistrationStartDate:dd.MM.yyyy HH:mm} tarihinde açılacaktır.", "REGISTRATION_NOT_STARTED");
        if (Nexora.Domain.Common.RegistrationWindow.HasEnded(now, travel.RegistrationEndDate))
            throw new ConflictException("Başvuru süresi sona ermiştir.", "REGISTRATION_ENDED");

        var participant = await uow.Participants.GetByIdAsync(req.ParticipantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (participant.Status != ParticipantStatus.Active)
            throw new ConflictException("Pasif veya engellenen katılımcı başvuru yapamaz.", "PARTICIPANT_NOT_ELIGIBLE");

        if (!req.OverrideEligibility)
        {
            EnsureResidencyRestriction(travel, participant);
            EnsureGenderRestriction(travel, participant);
            EnsureAgeRestriction(travel, participant);
        }
        EnsureGuardianConsent(travel, participant, req);
        await EnsureNoDuplicateApplicationAsync(req.ParticipantId, req.TravelId, ct);
        await EnsureNoDateConflictAsync(req.ParticipantId, travel, null, ct);
        await EnsureParticipationLimitAsync(travel, req.ParticipantId, participant.FullName, ct);
        await EnsureChildLimitAsync(travel, req, participant, Array.Empty<Guid>(), ct);

        var busId = ParseGuid(req.BusId);
        var seat = Normalize(req.SeatNumber);
        var gender = GenderStr(participant.Gender);

        var ownsCreateTransaction = !uow.HasActiveTransaction;
        if (ownsCreateTransaction) await uow.BeginTransactionAsync(ct);
        TravelApplication app;
        string createdCode = string.Empty;
        try
        {
            await uow.AcquireAdvisoryLockAsync(IdentityLockKey(participant.Tckn), ct);
            await uow.AcquireAdvisoryLockAsync(TravelLockKey(req.TravelId), ct);
            await EnsureNoDuplicateApplicationAsync(req.ParticipantId, req.TravelId, ct);
            await EnsureParticipationLimitAsync(travel, req.ParticipantId, participant.FullName, ct);

        var bus = busId.HasValue ? await uow.TravelBuses.GetByIdAsync(busId.Value, ct) : null;
        var capacityOnlyVehicle = bus?.IsCapacityOnly ?? false;

        if (req.Status == "approved" && busId.HasValue && seat is null && !capacityOnlyVehicle)
            throw new ConflictException("Onaylı başvuru için koltuk seçimi zorunludur.", "SEAT_REQUIRED");

        var code = $"GZB-{await uow.TravelApplications.NextCodeNumberAsync(ct):D6}";
        app = TravelApplication.Create(req.TravelId, req.ParticipantId, req.Status,
            req.DocumentStatus, req.PaymentStatus, busId, seat, req.Notes ?? "", code, currentUser.Name);
        app.SetEmergencyContact(req.EmergencyContactName, req.EmergencyContactPhone);

        if (busId.HasValue && capacityOnlyVehicle)
        {
            await EnsureVehicleCapacityAsync(req.TravelId, busId.Value, bus!, null, ct);
        }
        else if (busId.HasValue && seat is not null)
        {
            await EnsureSeatAvailableAsync(req.TravelId, bus!, seat, null, ct);
            // Kullanıcı bulgusu (2026-08-16): kardeş istisnası çalışmıyordu — bu noktada `app` henüz
            // veritabanına kaydedilmemiş (SaveChangesAsync aşağıda), bu yüzden aşağıdaki
            // EnsureGenderAdjacencyAsync eskiden `app.Id`'yi DB'den arayıp bulamıyor (null dönüyor),
            // dolayısıyla aynı soyadlı kardeş istisnası bu YENİ başvuru için asla devreye giremiyordu
            // (yalnızca var olan bir başvuruyu güncellerken çalışıyordu). Artık soyadı DB araması
            // yerine doğrudan katılımcıdan geçiriliyor.
            await EnsureGenderAdjacencyAsync(req.TravelId, busId.Value, seat, gender, app.Id, ct, LastNameOf(participant.FullName));
        }

        app.AddPassenger(TravelApplicationPassenger.Create(app.Id, req.ParticipantId, gender, busId, seat, true));
        await AddExtraPassengersAsync(app, travel, req, ct);

        if (req.Status is "approved" or "pending")
            await EnsureCapacityOnCreateAsync(travel, SeatDemandOf(app), ct);

        await uow.TravelApplications.AddAsync(app, ct);
        await uow.SaveChangesAsync(ct);
        await SyncTravelCountsAsync(req.TravelId, ct);
            if (ownsCreateTransaction) await uow.CommitAsync(ct);
            createdCode = app.Code;
        }
        catch
        {
            if (ownsCreateTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "TravelApplication",
            EntityId = app.Id,
            Module = "Travels",
            Description = $"Gezi başvurusu oluşturuldu: {createdCode} ({req.Status})",
        }, ct);

        return await GetByIdAsync(app.Id, ct);
    }

    public async Task<TravelApplicationDto> UpdateAsync(Guid id, TravelApplicationFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var app = await uow.TravelApplications.GetWithPassengersAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "TRAVEL_APPLICATION_NOT_FOUND");
        await EnsureTravelInScopeAsync(app.TravelId, ct);

        if (req.TravelId != app.TravelId)
            await EnsureTravelInScopeAsync(req.TravelId, ct);

        var travel = await uow.Travels.GetByIdAsync(req.TravelId, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        var previousStatus = app.Status;
        var statusChanged = !string.Equals(previousStatus, req.Status, StringComparison.Ordinal);

        if (statusChanged)
        {
            if (req.Status is not ("pending" or "reviewing" or "approved" or "rejected" or "waitlist"))
                throw new ConflictException("Geçersiz başvuru durumu.", "INVALID_STATUS");

            if (previousStatus == "rejected" && req.Status == "approved")
                throw new ConflictException("Reddedilmiş bir başvuru doğrudan onaylanamaz.", "INVALID_STATUS_TRANSITION");

            // SORUN 9 düzeltmesi (2026-08-07): bkz. SetStatusAsync'teki aynı düzeltme notu —
            // "approved" hiçbir admin akışından gönderilemiyor, doğru değer "complete".
            if (req.Status == "approved" && TravelRestrictionRules.DocumentRequired(travel.RestrictionsJson)
                && req.DocumentStatus != "complete")
                throw new ConflictException("Belge yüklenmeden başvuru onaylanamaz.", "DOCUMENTS_REQUIRED");
        }
        var participant = await uow.Participants.GetByIdAsync(req.ParticipantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (participant.Status != ParticipantStatus.Active)
            throw new ConflictException("Pasif veya engellenen katılımcı başvuru yapamaz.", "PARTICIPANT_NOT_ELIGIBLE");

        if (!req.OverrideEligibility)
        {
            EnsureResidencyRestriction(travel, participant);
            EnsureGenderRestriction(travel, participant);
            EnsureAgeRestriction(travel, participant);
        }
        await EnsureNoDateConflictAsync(req.ParticipantId, travel, id, ct);
        await EnsureChildLimitAsync(travel, req, participant, new[] { id }, ct);

        var busId = ParseGuid(req.BusId);
        var seat = Normalize(req.SeatNumber);
        var gender = GenderStr(participant.Gender);

        var ownsUpdateTransaction = !uow.HasActiveTransaction;
        if (ownsUpdateTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(TravelLockKey(req.TravelId), ct);

        var bus = busId.HasValue ? await uow.TravelBuses.GetByIdAsync(busId.Value, ct) : null;
        var capacityOnlyVehicle = bus?.IsCapacityOnly ?? false;

        if (req.Status == "approved" && busId.HasValue && seat is null && !capacityOnlyVehicle)
            throw new ConflictException("Onaylı başvuru için koltuk seçimi zorunludur.", "SEAT_REQUIRED");

        if (statusChanged && req.Status == "approved")
            await EnsureCapacityOnApproveAsync(app, ct);

        if (busId.HasValue && capacityOnlyVehicle)
        {
            await EnsureVehicleCapacityAsync(req.TravelId, busId.Value, bus!, id, ct);
        }
        else if (busId.HasValue && seat is not null)
        {
            await EnsureSeatAvailableAsync(req.TravelId, bus!, seat, id, ct);
            await EnsureGenderAdjacencyAsync(req.TravelId, busId.Value, seat, gender, id, ct);
        }

        app.Update(req.Status, req.DocumentStatus, req.PaymentStatus, busId, seat, req.Notes ?? "");
        app.SetEmergencyContact(req.EmergencyContactName, req.EmergencyContactPhone);

        var primary = app.Passengers.FirstOrDefault(x => x.IsPrimary);
        if (primary is null)
        {
            app.AddPassenger(TravelApplicationPassenger.Create(app.Id, req.ParticipantId, gender, busId, seat, true));
        }
        else
        {
            primary.SetGender(gender);
            primary.AssignSeat(busId, seat);
        }

        uow.TravelApplications.Update(app);
        await uow.SaveChangesAsync(ct);
        await SyncTravelCountsAsync(req.TravelId, ct);
            if (ownsUpdateTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsUpdateTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = statusChanged ? AuditAction.StatusChange : AuditAction.Update,
            EntityType = "TravelApplication",
            EntityId = app.Id,
            Module = "Travels",
            Description = statusChanged
                ? $"Gezi başvurusu durumu değiştirildi: {previousStatus} → {req.Status} ({app.Code})"
                : $"Gezi başvurusu güncellendi: {app.Code}",
            OldValues = JsonSerializer.Serialize(new { Status = previousStatus }),
            NewValues = JsonSerializer.Serialize(new { app.Status, app.DocumentStatus, app.PaymentStatus, app.SeatNumber }),
        }, ct);

        if (statusChanged && req.Status is "approved" or "rejected" or "waitlist" or "reviewing")
        {
            var notifyTravel = await uow.Travels.GetByIdAsync(app.TravelId, ct);
            await NotifyParticipantStatusAsync(app, notifyTravel, req.Status, ct);
        }

        return await GetByIdAsync(app.Id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.TravelApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "TRAVEL_APPLICATION_NOT_FOUND");
        await EnsureTravelInScopeAsync(app.TravelId, ct);

        var travel = await uow.Travels.GetByIdAsync(app.TravelId, ct);

        var wasApproved = app.Status == "approved";

        uow.TravelApplications.Delete(app);
        await uow.SaveChangesAsync(ct);
        await SyncTravelCountsAsync(app.TravelId, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "TravelApplication",
            EntityId = app.Id,
            Module = "Travels",
            Description = $"Gezi başvurusu silindi: {app.Code} ({app.Status})",
        }, ct);

        if (wasApproved)
            await PromoteWaitlistIfCapacityAsync(travel, app.BusId, app.SeatNumber, ct);
    }

    public async Task<TravelApplicationDto> SetStatusAsync(Guid id, string status, string? reason, CancellationToken ct)
    {
        var app = await uow.TravelApplications.GetWithPassengersAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "TRAVEL_APPLICATION_NOT_FOUND");
        await EnsureTravelInScopeAsync(app.TravelId, ct);

        if (status is not ("pending" or "reviewing" or "approved" or "rejected" or "waitlist"))
            throw new ConflictException("Geçersiz başvuru durumu.", "INVALID_STATUS");

        var previousStatus = app.Status;
        var travel = await uow.Travels.GetByIdAsync(app.TravelId, ct);

        if (travel is null && status == "approved")
            throw new ConflictException("Gezi bulunamadı veya silinmiş; başvuru onaylanamaz.", "TRAVEL_NOT_FOUND");

        // EVK-APR-005 / SED-APR-005 sınıfı bug: reddedilmiş bir başvuru doğrudan API çağrısıyla
        // onaya geçirilemez — Facility/SEDA/Events'te bu oturumda bulunup düzeltilen aynı desen.
        // K06: reddedilmiş başvuru yalnız doğrudan "approved" değil, sayılan/açık herhangi bir duruma
        // (pending/reviewing/waitlist) dolaylı olarak da geri açılamaz — pending üzerinden bypass engellenir.
        if (previousStatus == "rejected" && status is "approved" or "pending" or "reviewing" or "waitlist")
            throw new ConflictException("Reddedilmiş bir başvuru yeniden açılamaz. Vatandaşın yeniden başvurması gerekir.", "INVALID_STATUS_TRANSITION");

        var cascadeTargets = new List<TravelApplication>();

        // V07/Y06: onay/ret bu işlemde hak/durum değiştirecek TÜM gerçek kişileri (ana başvuru + veli
        // onayıyla birlikte onaylanan/ret edilen çocuklar) etkiler. Bu kişilerin kimlik kilitleri
        // KARARLI (artan) SIRAYLA ve travel kilidinden ÖNCE alınır — apply yollarıyla aynı sıra (kimlik→travel),
        // farklı kimliklerin ters sırada kilitlenmesinden doğacak deadlock önlenir. Kimlikler kilit öncesi çözülür.
        var identityLockKeys = new SortedSet<long>
        {
            IdentityLockKey(app.IsGuest ? app.GuestTckn : (await uow.Participants.GetByIdAsync(app.ParticipantId, ct))?.Tckn),
        };
        if (travel is not null && status is "approved" or "rejected")
        {
            foreach (var c in (await GuardianRequiredChildAppsAsync(app, travel, ct)).Where(c => c.Status != status))
                identityLockKeys.Add(IdentityLockKey(c.IsGuest ? c.GuestTckn : (await uow.Participants.GetByIdAsync(c.ParticipantId, ct))?.Tckn));
        }

        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            foreach (var key in identityLockKeys)
                await uow.AcquireAdvisoryLockAsync(key, ct);
            await uow.AcquireAdvisoryLockAsync(TravelLockKey(app.TravelId), ct);

            if (status is "approved" or "rejected")
            {
                var raw = await GuardianRequiredChildAppsAsync(app, travel, ct);
                cascadeTargets = raw.Where(c => c.Status != status).ToList();
            }

            if (status == "approved")
            {
                var toApprove = new List<TravelApplication> { app };
                toApprove.AddRange(cascadeTargets);

                foreach (var a in toApprove)
                {
                    var isChild = a.Id != app.Id;
                    // K06: sayılmayan durumdan onaya geçişte dinamik katılım limiti kilit içinde uygulanır.
                    // EnsureParticipationLimitAsync bu gezinin başvurularını sayımdan hariç tutar (excludeTravelId),
                    // dolayısıyla başvurunun kendi rezervasyonu ikinci kez sayılmaz.
                    if (travel is not null && !a.IsGuest && a.ParticipantId != Guid.Empty)
                    {
                        var limitName = (await uow.Participants.GetByIdAsync(a.ParticipantId, ct))?.FullName ?? "";
                        await EnsureParticipationLimitAsync(travel, a.ParticipantId, limitName, ct);
                    }
                    else if (travel is not null && a.IsGuest && !string.IsNullOrWhiteSpace(a.GuestTckn))
                        await EnsureGuestParticipationLimitAsync(travel, a.GuestTckn!, a.GuestFullName ?? "", ct);
                    // SORUN 8 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı):
                    // Bu kontrol önceden aracın gerçekten koltuklu mu yoksa kontenjan bazlı/araçsız
                    // mı olduğuna hiç bakmadan her onayda SeatNumber boşluğunu zorunlu kılıyordu.
                    // Araçsız (a.BusId == null) veya kontenjan bazlı (IsCapacityOnly) başvurularda
                    // SeatNumber doğası gereği hep null'dır — bu yüzden her onay girişimi
                    // SEAT_REQUIRED ile başarısız oluyordu. CreateAsync/UpdateAsync'teki
                    // capacityOnlyVehicle deseniyle tutarlı hale getirildi.
                    var seatRequiredBus = a.BusId.HasValue ? await uow.TravelBuses.GetByIdAsync(a.BusId.Value, ct) : null;
                    var seatRequiredForThis = a.BusId.HasValue && !(seatRequiredBus?.IsCapacityOnly ?? false);
                    if (seatRequiredForThis && string.IsNullOrWhiteSpace(a.SeatNumber))
                        throw new ConflictException(isChild
                            ? "Refakat gerektiren çocuğun koltuğu seçilmeden veli onaylanamaz. Önce çocuğun koltuğunu tamamlayın."
                            : "Onaylı başvuru için koltuk seçimi zorunludur.", "SEAT_REQUIRED");
                    // SORUN 9 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı):
                    // Bu kontrol "approved" literal'ini bekliyordu ama frontend'in DocumentStatus
                    // tipi yalnızca pending/complete/missing üretebiliyor — "approved" hiçbir admin
                    // akışından asla gönderilmiyordu, bu yüzden documentRequired=true olan HER
                    // gezide evrak durumu ne olursa olsun onay her zaman DOCUMENTS_REQUIRED ile
                    // başarısız oluyordu. Doğru/gönderilen değer olan "complete" ile karşılaştırılıyor.
                    if (travel is not null && TravelRestrictionRules.DocumentRequired(travel.RestrictionsJson) && a.DocumentStatus != "complete")
                        throw new ConflictException(isChild
                            ? "Refakat gerektiren çocuğun belgesi eksik olduğu için veli onaylanamaz."
                            : "Belge yüklenmeden başvuru onaylanamaz.", "DOCUMENTS_REQUIRED");
                }

                if (travel is not null && travel.Capacity > 0)
                {
                    var approvedCount = await uow.TravelApplications.CountByTravelAndStatusAsync(app.TravelId, "approved", ct);
                    var demand = toApprove.Where(a => a.Status != "approved").Sum(SeatDemandOf);
                    if (approvedCount + demand > travel.Capacity)
                        throw new ConflictException("Gezi kontenjanı dolu. Onaylamak için kontenjan artırın veya yedek listeye alın.", "CAPACITY_FULL");
                }

                foreach (var a in toApprove) { a.SetStatus("approved"); uow.TravelApplications.Update(a); }
            }
            else
            {
                app.SetStatus(status, reason);
                uow.TravelApplications.Update(app);
                foreach (var c in cascadeTargets) { c.SetStatus(status, reason); uow.TravelApplications.Update(c); }
            }

            await uow.SaveChangesAsync(ct);
            await SyncTravelCountsAsync(app.TravelId, ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = status == "approved" ? AuditAction.Approve : status == "rejected" ? AuditAction.Reject : AuditAction.StatusChange,
            EntityType = "TravelApplication",
            EntityId = app.Id,
            Module = "Travels",
            Description = $"Gezi başvurusu durumu değiştirildi: {previousStatus} → {status} ({app.Code})",
            OldValues = JsonSerializer.Serialize(new { Status = previousStatus }),
            NewValues = JsonSerializer.Serialize(new { Status = status, app.RejectionReason }),
        }, ct);

        await NotifyParticipantStatusAsync(app, travel, status, ct);
        if (previousStatus == "approved" && status is "rejected" or "waitlist")
            await PromoteWaitlistIfCapacityAsync(travel, app.BusId, app.SeatNumber, ct);

        foreach (var child in cascadeTargets)
        {
            await audit.LogAsync(new AuditEntry
            {
                Action = status == "approved" ? AuditAction.Approve : AuditAction.Reject,
                EntityType = "TravelApplication",
                EntityId = child.Id,
                Module = "Travels",
                Description = $"Veli işlemiyle refakat gerektiren çocuğun durumu değişti → {status} ({child.Code})",
            }, ct);
            await NotifyParticipantStatusAsync(child, travel, status, ct);
            if (status == "rejected")
                await PromoteWaitlistIfCapacityAsync(travel, child.BusId, child.SeatNumber, ct);
        }

        return await GetByIdAsync(app.Id, ct);
    }

    private async Task NotifyParticipantStatusAsync(TravelApplication app, Travel? travel, string status, CancellationToken ct)
    {
        if (travel is null) return;
        var participant = await uow.Participants.GetByIdAsync(app.ParticipantId, ct);
        var ctx = new TravelNotificationContext(travel.Name, travel.StartDate, travel.Destination, travel.DeparturePoint);
        await notifications.SendStatusAsync(app.ParticipantId, participant?.Phone, participant?.FullName ?? "", ctx, status, null, ct, app.RejectionReason);
    }

    public async Task PromoteWaitlistAfterFreeAsync(Guid travelId, Guid? freedBusId, string? freedSeat, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(travelId, ct);
        await PromoteWaitlistIfCapacityAsync(travel, freedBusId, freedSeat, ct);
        await SyncTravelCountsAsync(travelId, ct);
    }

    private async Task PromoteWaitlistIfCapacityAsync(Travel? travel, Guid? freedBusId, string? freedSeat, CancellationToken ct)
    {
        if (travel is null || travel.Capacity <= 0) return;

        var requireApproval = (await travelSettings.GetAsync(ct)).General.RequireApproval;
        if (requireApproval) return;

        PromoteOutcome outcome;
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(TravelLockKey(travel.Id), ct);
            outcome = await PromoteWaitlistCoreAsync(travel, freedBusId, freedSeat, ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        // RZ01/RZ03: bildirim ve yeniden-deneme planlaması yalnız BU metot transaction'ı sahiplenip COMMIT
        // ettiyse yapılır. Dış transaction'a katıldıysak (defansif — mevcut çağıranlar commit sonrası çağırıyor)
        // aksiyonlar dış commit garantisi olmadan tetiklenmez; sahibi commit'ten sonra üstlenir.
        if (!ownsTransaction) return;
        if (outcome.Notice is not null) await SendPromoteNoticeAsync(travel, outcome.Notice, ct);
        // Z03/RZ01: aday kimlik kilidi geçici meşgul → SADECE o aday ve boşalan koltuk için, COMMIT sonrası
        // hedefli + idempotent yeniden deneme planlanır.
        if (outcome.BusyCandidateId is Guid busyId)
            ScheduleWaitlistPromotionRetry(travel.Id, busyId, freedBusId, freedSeat, 1);
    }

    public async Task RetryWaitlistPromotionAsync(Guid travelId, Guid candidateId, Guid? freedBusId, string? freedSeat, int attempt, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(travelId, ct);
        if (travel is null) return;

        // RY02 sınır-2: Capacity/RequireApproval erken-return'leri BURADAN KALDIRILDI — bunlar yalnız YENİ terfi
        // uygunluğudur ve zaten terfi edilmiş adayın eksik bildiriminin tamamlanmasını engellememeli. Uygunluk
        // (kapasite + onay ayarı) artık PromoteSpecificCandidateAsync içinde YALNIZ yeni terfi dalında uygulanır;
        // bildirim-tamamlama dalı ayar değişiminden bağımsızdır.
        PromoteOutcome outcome;
        await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(TravelLockKey(travelId), ct);
            // RZ02/RZ04: SADECE durdurulan adayı ve boşalan koltuğu hedefle. Kapasite/sıra/koltuk/kimlik/limit
            // yeniden doğrulanır; aday artık waitlist değilse veya koltuk alındıysa no-op (çift terfi/koltuk olmaz).
            outcome = await PromoteSpecificCandidateAsync(travel, candidateId, freedBusId, freedSeat, ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        // RZ03: bildirim COMMIT'ten sonra.
        if (outcome.Notice is not null) await SendPromoteNoticeAsync(travel, outcome.Notice, ct);

        var maxAttempts = config.GetValue("Travels:WaitlistPromotionRetryMaxAttempts", 5);
        if (outcome.BusyCandidateId is Guid stillBusy && attempt < maxAttempts)
            ScheduleWaitlistPromotionRetry(travelId, stillBusy, freedBusId, freedSeat, attempt + 1);
    }

    private void ScheduleWaitlistPromotionRetry(Guid travelId, Guid candidateId, Guid? freedBusId, string? freedSeat, int attempt)
    {
        var jobs = serviceProvider.GetService<IBackgroundJobClient>();
        if (jobs is null) return;
        var delaySeconds = config.GetValue("Travels:WaitlistPromotionRetrySeconds", 15);
        jobs.Schedule<ITravelWaitlistPromotionRetryJob>(
            job => job.RetryAsync(travelId, candidateId, freedBusId, freedSeat, attempt, CancellationToken.None),
            TimeSpan.FromSeconds(delaySeconds));
    }

    // RZ03: terfi bildirimi çekirdekte GÖNDERİLMEZ, döndürülür — çağıran dış commit'ten SONRA gönderir
    // (rollback olursa hiçbir bildirim gitmez). TESLİMAT SINIRI (dürüst): bildirim teslimi AT-LEAST-ONCE'tır —
    // terfi commit olup bildirim başarısız olursa retry tekrar gönderir, ancak `NotificationService.CreateAsync`
    // her çağrıda YENİ uygulama-içi bildirim ürettiğinden (kalıcı benzersizlik anahtarı yok) nadiren UYGULAMA-İÇİ
    // bildirim de ÇİFT oluşabilir (yalnız SMS değil). SMS ayrıca mevcut sistem politikasında best-effort'tur
    // (SendStatusAsync hatayı yutar, sağlayıcı idempotency vermez). "Tekrarsız bildirim" garanti EDİLMEZ;
    // tekrarsızlık istenirse terfi olayına ait kalıcı anahtar + benzersizlik kontrolü gerekir (kabul edilen
    // politika gereği burada eklenmedi). Terfinin tekrar-güvenliği (idempotent) bildirimin tekrar-güvenliğinden ayrıdır.
    private sealed record TravelPromoteNotice(Guid ParticipantId, string? Phone, string FullName, string Status);
    // Notice = terfi yapıldı (commit sonrası bildirilecek). BusyCandidateId = aday kimlik kilidi geçici meşgul,
    // durduruldu (Z03/RZ04: SADECE bu aday için, dış commit sonrası hedefli yeniden deneme planlanır).
    private sealed record PromoteOutcome(TravelPromoteNotice? Notice, Guid? BusyCandidateId)
    {
        public static readonly PromoteOutcome None = new(null, null);
        public static PromoteOutcome Busy(Guid candidateId) => new(null, candidateId);
        public static PromoteOutcome Promoted(TravelPromoteNotice notice) => new(notice, null);
    }

    // Bir yedeği boşalan koltuğa (veya koltuksuz gezide pending'e) terfi eder ve bildirim bilgisini döndürür
    // (GÖNDERMEZ). Normal ve yeniden-deneme yolları AYNI sonucu üretsin diye tek kaynak (RZ02).
    private async Task<TravelPromoteNotice> ApplyPromotionAsync(Travel travel, TravelApplication next, Guid? freedBusId, string? freedSeat, CancellationToken ct)
    {
        if (freedBusId.HasValue && !string.IsNullOrWhiteSpace(freedSeat))
        {
            next.AssignSeat(freedBusId, freedSeat);
            next.SetStatus("approved");
            var primary = next.Passengers.FirstOrDefault(x => x.IsPrimary);
            primary?.AssignSeat(freedBusId, freedSeat);
        }
        else
        {
            next.SetStatus("pending");
        }
        uow.TravelApplications.Update(next);
        await uow.SaveChangesAsync(ct);
        await SyncTravelCountsAsync(travel.Id, ct);

        var participant = await uow.Participants.GetByIdAsync(next.ParticipantId, ct);
        var promotedStatus = next.Status == "approved" ? "promoted_approved" : "promoted";
        return new TravelPromoteNotice(next.ParticipantId, participant?.Phone, participant?.FullName ?? "", promotedStatus);
    }

    private async Task SendPromoteNoticeAsync(Travel travel, TravelPromoteNotice notice, CancellationToken ct)
    {
        var ctx = new TravelNotificationContext(travel.Name, travel.StartDate, travel.Destination, travel.DeparturePoint);
        await notifications.SendStatusAsync(notice.ParticipantId, notice.Phone, notice.FullName, ctx, notice.Status, null, ct);
    }

    private async Task<PromoteOutcome> PromoteWaitlistCoreAsync(Travel travel, Guid? freedBusId, string? freedSeat, CancellationToken ct)
    {
        var approved = await uow.TravelApplications.CountByTravelAndStatusAsync(travel.Id, "approved", ct);
        var pending = await uow.TravelApplications.CountByTravelAndStatusAsync(travel.Id, "pending", ct);
        if (approved + pending >= travel.Capacity) return PromoteOutcome.None;

        var freeSeats = travel.Capacity - (approved + pending);

        // V07: yedek kuyruğu sırayla (en eski önce) taranır. Sıradaki aday katılım limitini doldurmuşsa
        // (KALICI uygunsuzluk) o aday ATLANIR ve sıradaki uygun adaya geçilir — önceden yalnızca en eski
        // aday denenip limit doluysa hiç kimse terfi etmiyor, boş koltuk kalıyordu. Koltuk talebi boş
        // koltuktan fazla olan İLK UYGUN adayda durulur (FIFO adaleti: sığmayan büyük grubun önüne geçilmez).
        async Task<bool> ParticipationLimitReachedAsync(TravelApplication a)
        {
            try
            {
                if (!a.IsGuest && a.ParticipantId != Guid.Empty)
                {
                    var candidateName = (await uow.Participants.GetByIdAsync(a.ParticipantId, ct))?.FullName ?? "";
                    await EnsureParticipationLimitAsync(travel, a.ParticipantId, candidateName, ct);
                }
                else if (a.IsGuest && !string.IsNullOrWhiteSpace(a.GuestTckn))
                {
                    await EnsureGuestParticipationLimitAsync(travel, a.GuestTckn!, a.GuestFullName ?? "", ct);
                }
                return false;
            }
            catch (ConflictException ex) when (ex.ErrorCode == "PARTICIPATION_LIMIT_REACHED")
            {
                return true;
            }
        }

        var waitlist = await uow.TravelApplications.GetWaitlistOrderedAsync(travel.Id, ct);
        foreach (var oldest in waitlist)
        {
            var next = await uow.TravelApplications.GetWithPassengersAsync(oldest.Id, ct) ?? oldest;

            // Z03: "kalıcı uygunsuzluk" (katılım limiti dolu) ile "geçici kilit meşguliyeti" AYRI ele alınır.
            // 1) Limit dolu aday KALICI uygunsuz → atlanır, sıradaki uygun adaya geçilir (kilitsiz ön eleme).
            if (await ParticipationLimitReachedAsync(next)) continue;

            // 2) Uygun aday: kimlik kilidini BLOKLAMADAN dene (terfi travel kilidini tuttuğundan bloklamak
            //    apply'ın kimlik→travel sırasıyla deadlock üretir). Kilit MEŞGULSE (o kişi başka kısa işlemde)
            //    FIFO'yu korumak için DUR — arkadaki adayı ÖNE GEÇİRME. Boş yer bir sonraki tetikte
            //    (iptal/ret/durum değişimi) yeniden planlanır; kimlik kilidi kısa ömürlüdür. Bu BİLİNÇLİ bir
            //    iş kuralıdır: ilk uygun adayın sırası korunur, meşgul diye atlanmaz.
            var candidateTckn = next.IsGuest
                ? next.GuestTckn
                : (next.ParticipantId != Guid.Empty ? (await uow.Participants.GetByIdAsync(next.ParticipantId, ct))?.Tckn : null);
            if (!await uow.TryAcquireAdvisoryLockAsync(IdentityLockKey(candidateTckn), ct))
                return PromoteOutcome.Busy(next.Id);

            // 3) Kilit altında limiti KESİNLEŞTİR (iki kontrol arası nadir değişim); dolduysa atla.
            if (await ParticipationLimitReachedAsync(next)) continue;

            if (SeatDemandOf(next) > freeSeats) return PromoteOutcome.None;

            var notice = await ApplyPromotionAsync(travel, next, freedBusId, freedSeat, ct);
            return PromoteOutcome.Promoted(notice);
        }
        return PromoteOutcome.None;
    }

    // RZ02/RZ04: yeniden deneme SADECE durdurulan tek adaya (candidateId) ve boşalan koltuğa hedeflenir —
    // "başka bir yedeği de alma" (RZ04) ve "koltuk yerine pending üretme" (RZ02) sorunlarını kapatır.
    // Aday artık waitlist değilse / kapasite dolduysa / boşalan koltuk başkasınca alındıysa no-op (idempotent).
    private async Task<PromoteOutcome> PromoteSpecificCandidateAsync(Travel travel, Guid candidateId, Guid? freedBusId, string? freedSeat, CancellationToken ct)
    {
        var next = await uow.TravelApplications.GetWithPassengersAsync(candidateId, ct);
        if (next is null || next.TravelId != travel.Id) return PromoteOutcome.None;

        // RY02: aday ZATEN terfi edilmişse (approved/pending), önceki deneme terfiyi COMMIT edip bildirimi
        // tamamlayamamış olabilir (process çökmesi / bildirim hatası). Bu durumda YENİ terfi yapılmaz — yalnız
        // eksik kalan bildirim tekrar denenmek üzere notice döndürülür (idempotent: promosyon tekrar edilmez,
        // başka aday alınmaz; yalnız aynı terfinin bildirimi tamamlanır). Terfi durumu ile bildirim teslimi ayrı.
        if (next.Status is "approved" or "pending")
        {
            var promotedParticipant = await uow.Participants.GetByIdAsync(next.ParticipantId, ct);
            return PromoteOutcome.Promoted(new TravelPromoteNotice(
                next.ParticipantId, promotedParticipant?.Phone, promotedParticipant?.FullName ?? "",
                next.Status == "approved" ? "promoted_approved" : "promoted"));
        }
        if (next.Status != "waitlist") return PromoteOutcome.None;

        // YENİ terfi uygunluğu (yalnız bu dalda; bildirim-tamamlama dalını yukarıda geçtik):
        // kapasite<=0 veya onay-gerekli ise otomatik terfi yapılmaz (normal PromoteWaitlistIfCapacityAsync ile aynı).
        if (travel.Capacity <= 0) return PromoteOutcome.None;
        if ((await travelSettings.GetAsync(ct)).General.RequireApproval) return PromoteOutcome.None;

        var approved = await uow.TravelApplications.CountByTravelAndStatusAsync(travel.Id, "approved", ct);
        var pending = await uow.TravelApplications.CountByTravelAndStatusAsync(travel.Id, "pending", ct);
        if (approved + pending >= travel.Capacity) return PromoteOutcome.None;
        var freeSeats = travel.Capacity - (approved + pending);
        if (SeatDemandOf(next) > freeSeats) return PromoteOutcome.None;

        // Boşalan koltuk (varsa) hâlâ boş/atanabilir mi? Başka işlem doldurduysa ya da koltuk artık
        // geçersizse (blocked/şablon) bu terfi no-op — koltuk çift atanmaz. (EnsureSeatAvailableAsync
        // imzası koltuk şablon/blocked doğrulaması için TravelBus alır.)
        if (freedBusId.HasValue && !string.IsNullOrWhiteSpace(freedSeat))
        {
            var freedBus = await uow.TravelBuses.GetByIdAsync(freedBusId.Value, ct);
            if (freedBus is null) return PromoteOutcome.None;
            try { await EnsureSeatAvailableAsync(travel.Id, freedBus, freedSeat!, null, ct); }
            catch (ConflictException) { return PromoteOutcome.None; }
        }

        async Task<bool> LimitReachedAsync()
        {
            try
            {
                if (!next.IsGuest && next.ParticipantId != Guid.Empty)
                {
                    var candidateName = (await uow.Participants.GetByIdAsync(next.ParticipantId, ct))?.FullName ?? "";
                    await EnsureParticipationLimitAsync(travel, next.ParticipantId, candidateName, ct);
                }
                else if (next.IsGuest && !string.IsNullOrWhiteSpace(next.GuestTckn))
                {
                    await EnsureGuestParticipationLimitAsync(travel, next.GuestTckn!, next.GuestFullName ?? "", ct);
                }
                return false;
            }
            catch (ConflictException ex) when (ex.ErrorCode == "PARTICIPATION_LIMIT_REACHED") { return true; }
        }

        // Katılım limiti ÖN ELEME (kilitsiz) — kalıcı uygunsuz adayda erken çık.
        if (await LimitReachedAsync()) return PromoteOutcome.None;

        // Kimlik kilidi hâlâ meşgulse tekrar durdur (bir sonraki denemede yeniden planlanır).
        var tckn = next.IsGuest
            ? next.GuestTckn
            : (next.ParticipantId != Guid.Empty ? (await uow.Participants.GetByIdAsync(next.ParticipantId, ct))?.Tckn : null);
        if (!await uow.TryAcquireAdvisoryLockAsync(IdentityLockKey(tckn), ct))
            return PromoteOutcome.Busy(candidateId);

        // RY01: KESİN limit kontrolü kimlik kilidinden SONRA — ön sayım ile kilit arasında başka işlem
        // commit etmiş olabilir; "kontrol ve yazım aynı kilit altında" garantisi (normal PromoteWaitlistCore
        // ile aynı). Limit bu arada dolduysa mutasyon yapmadan no-op döner.
        if (await LimitReachedAsync()) return PromoteOutcome.None;

        var notice = await ApplyPromotionAsync(travel, next, freedBusId, freedSeat, ct);
        return PromoteOutcome.Promoted(notice);
    }

    public async Task<(byte[] Content, string FileName)> ExportAsync(TravelApplicationListParams p, CancellationToken ct)
    {
        if (p.TravelId.HasValue) await EnsureTravelInScopeAsync(p.TravelId.Value, ct);

        var scopedTravelIds = currentUser.Id is Guid exportUid
            ? await userScope.GetScopedRefIdsAsync(exportUid, "travels", ct)
            : null;

        var apps = (await uow.TravelApplications.GetForExportAsync(p, ct)).ToList();
        if (scopedTravelIds is not null)
            apps = apps.Where(a => scopedTravelIds.Contains(a.TravelId)).ToList();

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Export,
            EntityType = "TravelApplication",
            Module = "Travels",
            Description = $"Gezi başvuru listesi dışa aktarıldı ({apps.Count} kayıt, kişisel veri içerir)",
        }, ct);

        var allPartIds = apps.SelectMany(a => a.Passengers.Select(ps => ps.ParticipantId))
            .Concat(apps.Select(a => a.ParticipantId)).Distinct().ToList();
        var travelIds = apps.Select(a => a.TravelId).Distinct().ToList();
        var allBusIds = apps.SelectMany(a => a.Passengers.Where(ps => ps.BusId.HasValue).Select(ps => ps.BusId!.Value))
            .Concat(apps.Where(a => a.BusId.HasValue).Select(a => a.BusId!.Value))
            .Distinct().ToList();

        var parts = allPartIds.Count == 0 ? new Dictionary<Guid, Participant>()
            : (await uow.Participants.FindAsync(pt => allPartIds.Contains(pt.Id), ct)).ToDictionary(pt => pt.Id);
        var travels = travelIds.Count == 0 ? new Dictionary<Guid, Travel>()
            : (await uow.Travels.FindAsync(t => travelIds.Contains(t.Id), ct)).ToDictionary(t => t.Id);
        var buses = allBusIds.Count == 0 ? new Dictionary<Guid, TravelBus>()
            : (await uow.TravelBuses.FindAsync(b => allBusIds.Contains(b.Id), ct)).ToDictionary(b => b.Id);

        var dtos = apps.Select(a =>
        {
            var passengerDtos = a.Passengers
                .OrderByDescending(ps => ps.IsPrimary)
                .Select(ps =>
                {
                    var pp = parts.GetValueOrDefault(ps.ParticipantId);
                    var busName = ps.BusId.HasValue ? buses.GetValueOrDefault(ps.BusId.Value)?.Name : null;
                    return new TravelApplicationPassengerDto(ps.Id, ps.ParticipantId, pp?.FullName ?? "", pp?.Tckn ?? "", ps.Gender, ps.BusId, busName, ps.SeatNumber, ps.IsPrimary, ps.Status);
                }).ToList();
            return Map(a, parts, travels, buses, passengerDtos);
        }).ToList();

        var travel = p.TravelId.HasValue ? travels.GetValueOrDefault(p.TravelId.Value) : travels.Values.FirstOrDefault();
        var travelName = travel?.Name ?? dtos.FirstOrDefault()?.TravelName ?? "Gezi";
        var safeName = string.Concat(travelName.Where(c => !Path.GetInvalidFileNameChars().Contains(c))).Trim();
        var datePart = travel?.StartDate is { } sd ? $" - {sd:dd.MM.yyyy}" : "";

        var bytes = excelService.BuildTravelApplicationExport(dtos, travelName);
        return (bytes, $"{safeName}{datePart}.xlsx");
    }

    private async Task AddExtraPassengersAsync(TravelApplication app, Travel travel, TravelApplicationFormRequest req, CancellationToken ct)
    {
        if (req.Passengers is null || req.Passengers.Count == 0) return;

        var seenParticipants = new HashSet<Guid> { req.ParticipantId };
        var claimedSeats = new HashSet<string>();
        var primaryBusId = ParseGuid(req.BusId);
        var primarySeat = Normalize(req.SeatNumber);
        if (primaryBusId.HasValue && primarySeat is not null)
            claimedSeats.Add($"{primaryBusId.Value}|{primarySeat}");

        foreach (var input in req.Passengers)
        {
            if (input.ParticipantId == req.ParticipantId) continue;
            if (!seenParticipants.Add(input.ParticipantId))
                throw new ConflictException("Aynı kişi başvuruya birden fazla kez eklenemez.", "DUPLICATE_PASSENGER");

            var participant = await uow.Participants.GetByIdAsync(input.ParticipantId, ct)
                ?? throw new NotFoundException("Yolcu olarak eklenen kişi bulunamadı.", "PASSENGER_NOT_FOUND");

            if (participant.Status != ParticipantStatus.Active)
                throw new ConflictException($"{participant.FullName} pasif veya engellenmiş olduğu için geziye eklenemez.", "PASSENGER_NOT_ELIGIBLE");

            if (!req.OverrideEligibility)
            {
                EnsureResidencyRestriction(travel, participant);
                EnsureGenderRestriction(travel, participant);
                EnsureAgeRestriction(travel, participant);
            }

            var seat = Normalize(input.SeatNumber);
            var busId = ParseGuid(input.BusId);
            var gender = GenderStr(participant.Gender);
            if (busId.HasValue && seat is not null)
            {
                if (!claimedSeats.Add($"{busId.Value}|{seat}"))
                    throw new ConflictException($"{seat} numaralı koltuk bu başvuruda birden fazla yolcuya seçilemez.", "SEAT_ALREADY_TAKEN");

                var extraBus = await uow.TravelBuses.GetByIdAsync(busId.Value, ct)
                    ?? throw new NotFoundException("Seçilen araç bulunamadı.", "BUS_NOT_FOUND");
                await EnsureSeatAvailableAsync(app.TravelId, extraBus, seat, app.Id, ct);
                await EnsureGenderAdjacencyAsync(app.TravelId, busId.Value, seat, gender, app.Id, ct, LastNameOf(participant.FullName));
            }
            app.AddPassenger(TravelApplicationPassenger.Create(app.Id, input.ParticipantId, gender, busId, seat, false));
        }
    }

    private void EnsureResidencyRestriction(Travel travel, Participant participant)
    {
        var mode = TravelRestrictionRules.ReadResidencyModeRaw(travel.RestrictionsJson);
        var violation = EligibilityRules.CheckResidency(mode, participant, null, SultangaziDistrictCode);
        if (violation is not null)
            throw new ConflictException(violation.Message, violation.ErrorCode);
    }

    private static void EnsureGenderRestriction(Travel travel, Participant participant)
    {
        if (travel.Gender is not ("male" or "female")) return;
        var participantGender = participant.Gender == Gender.Female ? "female" : "male";
        if (!participantGender.Equals(travel.Gender, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException(
                travel.Gender == "female" ? "Bu gezi yalnızca kadın katılımcılara açıktır." : "Bu gezi yalnızca erkek katılımcılara açıktır.",
                "GENDER_NOT_ELIGIBLE");
    }

    private static void EnsureAgeRestriction(Travel travel, Participant participant)
    {
        if (travel.MinAge <= 0 && travel.MaxAge <= 0) return;
        var today = TurkeyTime.TodayDate();
        var age = today.Year - participant.BirthDate.Year;
        if (participant.BirthDate.Date > today.AddYears(-age)) age--;
        if (age < 0) age = 0;

        // Kullanıcı bulgusu (2026-08-09): bkz. TravelRestrictionRules.IsEligibleAsAccompaniedChild
        // üzerindeki not. Bu katılımcı gezinin normal yaş aralığına (MinAge/MaxAge) uymasa bile,
        // gezinin "refakatli çocuk" istisnasına (allowChildren + childMinAge/childMaxAge/
        // childGenderMode) uyuyorsa reddedilmemeli — citizen tarafı zaten bu istisnayla kabul
        // etmiş bir başvuruyu admin panelde (örn. sadece evrak durumunu kaydederken) reddetmek
        // gerçek, canlı veride doğrulanmış bir hataydı.
        if (Nexora.Domain.Common.TravelRestrictionRules.IsEligibleAsAccompaniedChild(
                travel.RestrictionsJson, age, GenderStr(participant.Gender)))
            return;

        if (travel.MinAge > 0 && age < travel.MinAge)
            throw new ConflictException($"Bu gezi {travel.MinAge} yaş ve üzeri için açıktır.", "AGE_NOT_ELIGIBLE");
        if (travel.MaxAge > 0 && age > travel.MaxAge)
            throw new ConflictException($"Bu gezi en fazla {travel.MaxAge} yaşındakiler için açıktır.", "AGE_NOT_ELIGIBLE");
    }

    private async Task EnsureNoDuplicateApplicationAsync(Guid participantId, Guid travelId, CancellationToken ct)
    {
        var actives = await uow.TravelApplications.GetActiveByParticipantAsync(participantId, ct);
        if (actives.Any(a => a.TravelId == travelId))
            throw new ConflictException("Bu katılımcının bu geziye zaten aktif bir başvurusu bulunmaktadır.", "DUPLICATE_APPLICATION");
    }

    private async Task EnsureChildLimitAsync(Travel travel, TravelApplicationFormRequest req, Participant main, IReadOnlyCollection<Guid> excludeApplicationIds, CancellationToken ct)
    {
        var candidateIds = new List<Guid> { req.ParticipantId };
        if (req.Passengers is not null)
            candidateIds.AddRange(req.Passengers.Select(p => p.ParticipantId));

        var minorIds = new List<Guid>();
        foreach (var pid in candidateIds.Distinct())
        {
            var candidate = pid == req.ParticipantId ? main : await uow.Participants.GetByIdAsync(pid, ct);
            if (candidate is not null && Nexora.Infrastructure.Services.Travels.TravelChildLimitGuard.IsMinor(candidate))
                minorIds.Add(pid);
        }
        if (minorIds.Count == 0) return;

        var guardianId = await Nexora.Infrastructure.Services.Travels.TravelChildLimitGuard.ResolveGuardianIdAsync(uow, main, ct);
        await Nexora.Infrastructure.Services.Travels.TravelChildLimitGuard.EnsureAsync(uow, travel, guardianId, minorIds, excludeApplicationIds, ct);
    }

    private static void EnsureGuardianConsent(Travel travel, Participant participant, TravelApplicationFormRequest req)
    {
        if (!TravelRestrictionRules.RequiresGuardianConsent(travel.RestrictionsJson)) return;
        if (!participant.IsMinor) return;
        throw new ConflictException($"{participant.FullName} 18 yaşından küçük; başvuru veli hesabından yapılmalıdır.", "GUARDIAN_CONSENT_REQUIRED");
    }

    private async Task EnsureParticipationLimitAsync(Travel travel, Guid participantId, string participantName, CancellationToken ct)
    {
        if (Nexora.Domain.Common.TravelParticipationLimitRules.IsExempt(travel.ParticipationPeriod, travel.ExemptFromParticipationLimit)) return;

        var period = travel.ParticipationPeriod;
        var limit = travel.ParticipationLimit;
        if (period == "none" || limit <= 0)
        {
            var settings = await travelSettings.GetAsync(ct);
            if (Nexora.Domain.Common.TravelParticipationLimitRules.IsExemptAsVehicleFree(travel.BusCount, settings.Participation.ApplyToVehicleFreeTravels)) return;
            period = settings.Participation.DefaultPeriod;
            limit = settings.Participation.DefaultLimitCount;
        }
        if (period == "none" || limit <= 0) return;

        var (start, end) = TravelRestrictionRules.PeriodWindow(period, travel.StartDate);
        if (start == DateTime.MinValue) return;

        var count = await uow.TravelApplications.CountActiveByParticipantInTravelWindowAsync(participantId, start, end, travel.Id, ct);
        if (count >= limit)
            throw new ConflictException($"{participantName} için bu dönemdeki gezi katılım sınırına ulaşıldı.", "PARTICIPATION_LIMIT_REACHED");
    }

    // V07: misafir yolcu (TCKN) için dinamik katılım limiti — kayıtlı yolcu kuralıyla aynı; onay/terfide de uygulanır.
    private async Task EnsureGuestParticipationLimitAsync(Travel travel, string guestTckn, string guestName, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(guestTckn)) return;
        if (Nexora.Domain.Common.TravelParticipationLimitRules.IsExempt(travel.ParticipationPeriod, travel.ExemptFromParticipationLimit)) return;

        var period = travel.ParticipationPeriod;
        var limit = travel.ParticipationLimit;
        if (period == "none" || limit <= 0)
        {
            var settings = await travelSettings.GetAsync(ct);
            if (Nexora.Domain.Common.TravelParticipationLimitRules.IsExemptAsVehicleFree(travel.BusCount, settings.Participation.ApplyToVehicleFreeTravels)) return;
            period = settings.Participation.DefaultPeriod;
            limit = settings.Participation.DefaultLimitCount;
        }
        if (period == "none" || limit <= 0) return;

        var (start, end) = TravelRestrictionRules.PeriodWindow(period, travel.StartDate);
        if (start == DateTime.MinValue) return;

        var count = await uow.TravelApplications.CountActiveByGuestTcknInTravelWindowAsync(guestTckn.Trim(), start, end, travel.Id, ct);
        if (count >= limit)
            throw new ConflictException($"{guestName} için bu dönemdeki gezi katılım sınırına ulaşıldı.", "PARTICIPATION_LIMIT_REACHED");
    }

    private async Task EnsureNoDateConflictAsync(Guid participantId, Travel travel, Guid? excludeApplicationId, CancellationToken ct)
    {
        var actives = await uow.TravelApplications.GetActiveByParticipantAsync(participantId, ct);
        var otherTravelIds = actives
            .Where(a => !excludeApplicationId.HasValue || a.Id != excludeApplicationId.Value)
            .Where(a => a.TravelId != travel.Id)
            .Select(a => a.TravelId)
            .Distinct()
            .ToList();
        if (otherTravelIds.Count == 0) return;

        var others = await uow.Travels.FindAsync(t => otherTravelIds.Contains(t.Id), ct);
        foreach (var other in others)
        {
            if (travel.StartDate.Date <= other.EndDate.Date && other.StartDate.Date <= travel.EndDate.Date)
                throw new ConflictException("Bu katılımcının aynı tarihlerde aktif başka bir gezi başvurusu var.", "PARTICIPANT_DATE_CONFLICT");
        }
    }

    // Düzeltme (2026-09-27, uçtan uca gezi testi): ParticipantTravelService.EnsureSeatAvailableAsync
    // ile aynı bug — koltuğun şablonda gerçekten var olduğu ve "blocked" işaretli olmadığı hiç
    // kontrol edilmiyordu (bkz. o metottaki yorum). Admin panelinden manuel koltuk atamasında da
    // aynı doğrulama uygulanıyor.
    private async Task EnsureSeatAvailableAsync(Guid travelId, Domain.Entities.Travels.TravelBus bus, string seat, Guid? excludeApplicationId, CancellationToken ct)
    {
        var labelToId = BusSeatLayout.LabelToId(bus.TemplateId);
        if (!labelToId.ContainsKey(seat))
            throw new ConflictException("Geçersiz koltuk numarası. Lütfen koltuk haritasından bir koltuk seçin.", "SEAT_INVALID");

        if (labelToId.TryGetValue(seat, out var seatId))
        {
            var locked = BusSeatMath.LockedSeats(bus.SeatStatesJson);
            if (locked.ContainsKey(seatId))
                throw new ConflictException("Bu koltuk rezervasyona kapalı, lütfen başka koltuk seçin.", "SEAT_BLOCKED");
        }

        var passengers = await uow.TravelApplications.GetSeatedPassengersAsync(travelId, bus.Id, ct);
        var taken = passengers.Any(p => p.SeatNumber == seat
            && (!excludeApplicationId.HasValue || p.ApplicationId != excludeApplicationId.Value));
        if (taken)
            throw new ConflictException("Bu koltuk az önce alındı, lütfen başka koltuk seçin.", "SEAT_TAKEN");

    }

    private async Task EnsureVehicleCapacityAsync(Guid travelId, Guid busId, Domain.Entities.Travels.TravelBus bus, Guid? excludeApplicationId, CancellationToken ct)
    {
        var passengers = await uow.TravelApplications.GetActivePassengersByBusAsync(travelId, busId, ct);
        var count = passengers.Count(p => !excludeApplicationId.HasValue || p.ApplicationId != excludeApplicationId.Value);
        if (count >= bus.Capacity)
            throw new ConflictException($"{bus.Name} için kontenjan dolu (kapasite: {bus.Capacity}).", "VEHICLE_CAPACITY_FULL");
    }

    /// <summary>
    /// Kullanıcı isteği (2026-08-07, senaryo 3): kadın yolcunun yanına farklı cinsiyetten biri
    /// oturamaz kuralının TEK istisnası — aynı soyadına sahip bir erkek (aile bireyi) yanına
    /// oturabilir. Admin panelinden manuel koltuk atamasında da katılımcı akışıyla aynı istisna
    /// uygulanır (bkz. ParticipantTravelService.EnsureGenderAdjacencyAsync).
    ///
    /// Kullanıcı bulgusu (2026-08-16): "önce kız çocuğa bilet aldıktan sonra 2. başvuru ile erkek
    /// çocuğa bilet almak istediğimizde kardeşinin yanına oturamıyor". Kök neden: yeni bir başvuru
    /// OLUŞTURULURKEN bu metot `excludeApplicationId` olarak henüz kaydedilmemiş (SaveChangesAsync
    /// öncesi) `app.Id`'yi alıyordu — `uow.TravelApplications.GetByIdAsync(excludeApplicationId)`
    /// veritabanında bu ID'yi bulamadığı için `currentLastName` her zaman null kalıyor, dolayısıyla
    /// kardeş istisnası YENİ başvurularda asla devreye giremiyordu (yalnızca var olan bir başvuruyu
    /// güncellerken, örn. koltuk değiştirirken çalışıyordu). Artık çağıran taraf `knownLastName`
    /// parametresiyle katılımcının/misafirin soyadını doğrudan geçirebiliyor; verilmişse DB araması
    /// atlanıyor.
    /// </summary>
    private async Task EnsureGenderAdjacencyAsync(Guid travelId, Guid busId, string seat, string gender, Guid? excludeApplicationId, CancellationToken ct, string? knownLastName = null)
    {
        if (gender is not ("male" or "female")) return;

        var bus = await uow.TravelBuses.GetByIdAsync(busId, ct);
        if (bus is null) return;

        var adjacent = BusSeatLayout.AdjacentLabels(bus.TemplateId, seat);
        if (adjacent.Count == 0) return;

        var passengers = await uow.TravelApplications.GetSeatedPassengersAsync(travelId, busId, ct);
        var neighborRows = passengers
            .Where(p => p.SeatNumber is not null && adjacent.Contains(p.SeatNumber)
                && !(excludeApplicationId.HasValue && p.ApplicationId == excludeApplicationId.Value))
            .ToList();
        if (neighborRows.Count == 0) return;

        var currentLastName = knownLastName;
        if (currentLastName is null && excludeApplicationId.HasValue)
        {
            var currentApp = await uow.TravelApplications.GetByIdAsync(excludeApplicationId.Value, ct);
            if (currentApp is not null)
            {
                currentLastName = currentApp.IsGuest
                    ? LastNameOf(currentApp.GuestFullName)
                    : LastNameOf((await uow.Participants.GetByIdAsync(currentApp.ParticipantId, ct))?.FullName);
            }
        }

        var neighborParticipantIds = neighborRows.Select(p => p.ParticipantId).Distinct().ToList();
        var neighborParticipants = (await uow.Participants.FindAsync(pt => neighborParticipantIds.Contains(pt.Id), ct))
            .ToDictionary(pt => pt.Id);

        foreach (var p in neighborRows)
        {
            if (p.Gender is not ("male" or "female") || p.Gender == gender) continue;

            neighborParticipants.TryGetValue(p.ParticipantId, out var neighbor);
            if (currentLastName is not null && neighbor is not null
                && string.Compare(LastNameOf(neighbor.FullName), currentLastName, TurkishCulture, System.Globalization.CompareOptions.IgnoreCase) == 0)
                continue;

            throw new ConflictException("Yan koltuğa farklı cinsiyetten yolcu atanamaz (farklı başvuru). Lütfen başka koltuk seçin.", "SEAT_GENDER_RULE");
        }
    }

    private static readonly System.Globalization.CultureInfo TurkishCulture = new("tr-TR");

    private static string? LastNameOf(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return null;
        var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length == 0 ? null : parts[^1];
    }

    private static long TravelLockKey(Guid travelId) => BitConverter.ToInt64(travelId.ToByteArray(), 0);

    // V07: kimlik kilidi TCKN-tabanlı — aynı kişi hem kayıtlı yolcu (Guid) hem misafir (TCKN) yoluyla
    // eşzamanlı başvurabilir; Guid ve TCKN türetmeleri FARKLI anahtar üretince iki yol serileşmiyor,
    // katılım limiti "say-sonra-yaz" yarışıyla aşılabiliyordu. Katılım sayacı zaten TCKN ile birleşik
    // sayıyor; kilit de aynı TCKN'de birleşmeli. ParticipantTravelService.IdentityLockKey ile AYNI türetme.
    private static long IdentityLockKey(string? tckn) => BitConverter.ToInt64(
        System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("travel-person:" + (tckn ?? "").Trim())), 0);

    private async Task EnsureCapacityOnApproveAsync(TravelApplication app, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(app.TravelId, ct);
        if (travel is null || travel.Capacity <= 0) return;
        if (app.Status == "approved") return;

        // AYNI KRİTİK BUG DÜZELTMESİ (2026-08-05, kullanıcı bulgusu — Etkinlik modülüyle aynı
        // desen): eskiden diğer BEKLEYEN (pending) başvurular da sanki koltuk almış gibi
        // kontenjana dahil ediliyordu. Örnek: kapasite=1, 3 kişi pending (her biri 1 koltuk
        // talep ediyor), birini onaylamaya çalışınca approved=0, pending=(3-1)=2,
        // SeatDemand=1 → 0+2+1=3 > 1 → CAPACITY_FULL, İLK onay bile reddediliyordu.
        // Doğrusu: yalnızca GERÇEKTEN onaylanmış (approved) koltuklar + bu başvurunun kendi
        // koltuk talebi kontenjanı işgal eder; diğer pending başvurular onaylanana kadar yer
        // tutmaz (bekleme listesinde birden fazla kişi olması sorun değil).
        var approved = await uow.TravelApplications.CountByTravelAndStatusAsync(app.TravelId, "approved", ct);

        if (approved + SeatDemandOf(app) > travel.Capacity)
            throw new ConflictException("Gezi kontenjanı dolu. Onaylamak için kontenjan artırın veya yedek listeye alın.", "CAPACITY_FULL");
    }

    private static int SeatDemandOf(TravelApplication app)
        => Math.Max(app.Passengers.Count, 1);

    private static int AgeOf(DateTime birthDate)
    {
        var today = Nexora.Domain.Common.TurkeyTime.TodayDate();
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age;
    }

    private bool QualifiesAlone(Travel travel, Participant p)
    {
        if (Nexora.Domain.Common.FacilityEligibilityRules.CheckGender(travel.Gender, p.Gender) is not null) return false;
        var age = AgeOf(p.BirthDate);
        if (travel.MinAge > 0 && age < travel.MinAge) return false;
        if (travel.MaxAge > 0 && age > travel.MaxAge) return false;
        var mode = Nexora.Domain.Common.TravelRestrictionRules.ReadResidencyModeRaw(travel.RestrictionsJson);
        if (Nexora.Domain.Common.EligibilityRules.CheckResidency(mode, p, null, SultangaziDistrictCode) is not null) return false;
        return true;
    }

    private async Task<List<TravelApplication>> GuardianRequiredChildAppsAsync(TravelApplication app, Travel? travel, CancellationToken ct)
    {
        if (travel is null) return [];
        var children = await uow.Participants.GetChildrenAsync(app.ParticipantId, ct);
        if (children.Count == 0) return [];
        var byId = children.ToDictionary(c => c.Id);
        var apps = await uow.TravelApplications.GetActiveByParticipantsAndTravelAsync(children.Select(c => c.Id).ToList(), app.TravelId, ct);
        return apps
            .Where(a => a.Id != app.Id && byId.TryGetValue(a.ParticipantId, out var p) && !QualifiesAlone(travel, p))
            .ToList();
    }

    private async Task EnsureCapacityOnCreateAsync(Travel travel, int seatDemand, CancellationToken ct)
    {
        if (travel.Capacity <= 0) return;

        var approved = await uow.TravelApplications.CountByTravelAndStatusAsync(travel.Id, "approved", ct);
        var pending = await uow.TravelApplications.CountByTravelAndStatusAsync(travel.Id, "pending", ct);

        if (approved + pending + seatDemand > travel.Capacity)
            throw new ConflictException("Gezi kontenjanı dolu. Kontenjan artırın veya başvuruyu yedek listeye alın.", "CAPACITY_FULL");
    }

    public async Task SyncCountsAsync(Guid travelId, CancellationToken ct) => await SyncTravelCountsAsync(travelId, ct);

    /// <summary>
    /// Kullanıcı isteği (2026-08-07): admin bir geziye toplu TC kimlik numarası yapıştırarak
    /// (koltuk seçimi olmadan, kontenjan bazlı) yolcu ekleyebilmeli. Her satır bağımsız işlenir —
    /// biri hata verirse diğerleri etkilenmez (toplu işlemin doğası gereği).
    /// Sistemde kayıtlı TC → doğrudan onaylı başvuru oluşturulur (kontenjan/tarih çakışması gibi
    /// mevcut kurallar aynen uygulanır). Kayıtlı olmayan TC + telefon verilmişse → üyelik/uygulama
    /// daveti SMS'i gönderilir. Kayıtlı olmayan TC + telefon yoksa → "iletişim bilgisi eksik"
    /// olarak işaretlenir (NVI tek başına TC ile sorgulanamadığı için otomatik davet gönderilemez).
    /// </summary>
    public async Task<TravelBulkTcknResult> BulkAddByTcknAsync(TravelBulkTcknRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(BulkAddByTcknAsync), new { req.TravelId, Count = req.Entries?.Count ?? 0 });

        await EnsureTravelInScopeAsync(req.TravelId, ct);
        var travel = await uow.Travels.GetByIdAsync(req.TravelId, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        // Kullanıcı bulgusu (2026-08-07): Toplu T.C. ile yolcu ekleme, tekil başvuru akışının
        // (CreateAsync/ReserveAsync) aksine geçmiş tarihli bir seferin StartDate'ini hiç kontrol
        // etmiyordu — süresi geçmiş bir sefere bile toplu yolcu eklenebiliyordu. Aynı kural
        // buraya da uygulandı.
        if (TurkeyTime.ToTurkey(travel.StartDate).Date < TurkeyTime.TodayDate())
            throw new ConflictException("Geçmiş geziye başvuru yapılamaz.", "TRAVEL_IN_PAST");

        var busId = ParseGuid(req.BusId);
        var bus = busId.HasValue ? await uow.TravelBuses.GetByIdAsync(busId.Value, ct) : null;

        var citizenPortalUrl = (config["TravelSettings:CitizenPortalUrl"] ?? "").TrimEnd('/');
        var inviteMessage = $"Bakırköy Belediyesi \"{travel.Name}\" gezisine kaydınız için üye olmanız gerekiyor. Uygulamayı indirip kayıt olun."
            + (citizenPortalUrl.Length > 0 ? $" {citizenPortalUrl}" : "");
        var generalSettings = (await travelSettings.GetAsync(ct)).General;
        // İstek açıkça seçim taşıyorsa adminin seçimi geçerlidir; eski istemciler alanı
        // göndermiyorsa Genel Ayarlar'daki otomatik davet tercihi kullanılır.
        var sendInviteSms = req.SendInviteSms ?? generalSettings.AutoInviteSmsEnabled;
        var inviteDelay = Math.Clamp(generalSettings.InviteSmsDelayMinutes, 0, 1440);

        var items = new List<TravelBulkTcknResultItem>();
        var seenInBatch = new HashSet<string>();

        foreach (var entry in req.Entries ?? [])
        {
            var tckn = (entry.Tckn ?? "").Trim();
            if (!Nexora.Application.Common.TcKimlikValidator.IsValid(tckn))
            {
                items.Add(new TravelBulkTcknResultItem(tckn, "invalid", null, "Geçersiz T.C. kimlik numarası"));
                continue;
            }
            if (!seenInBatch.Add(tckn))
            {
                items.Add(new TravelBulkTcknResultItem(tckn, "duplicate", null, "Listede tekrar ediyor"));
                continue;
            }

            var participant = await uow.Participants.GetByTcknAsync(tckn, ct);
            if (participant is null)
            {
                var phone = (entry.Phone ?? "").Trim();
                var displayName = string.IsNullOrWhiteSpace(entry.FullName) ? null : entry.FullName!.Trim();
                if (string.IsNullOrWhiteSpace(phone) || phone.Count(char.IsDigit) < 10)
                {
                    items.Add(new TravelBulkTcknResultItem(tckn, "no_contact", displayName, "Üye değil — telefon verilmediği için davet gönderilemedi"));
                    continue;
                }
                if (!sendInviteSms)
                {
                    items.Add(new TravelBulkTcknResultItem(tckn, "invite_skipped", displayName, "Üye değil — SMS gönderimi seçilmedi"));
                    continue;
                }
                try
                {
                    var jobs = serviceProvider.GetService<IBackgroundJobClient>();
                    if (jobs is not null && inviteDelay > 0)
                        jobs.Schedule<ITravelInviteSmsJob>(
                            job => job.SendAsync(phone, inviteMessage, CancellationToken.None),
                            TimeSpan.FromMinutes(inviteDelay));
                    else
                        await dispatcher.SendSmsAsync(phone, inviteMessage, ct);
                    items.Add(new TravelBulkTcknResultItem(tckn, "invite_sent", displayName,
                        inviteDelay > 0 && jobs is not null
                            ? $"Üye değil — davet SMS'i {inviteDelay} dakika sonra gönderilmek üzere planlandı"
                            : "Üye değil — üyelik/uygulama daveti SMS ile gönderildi"));
                }
                catch
                {
                    items.Add(new TravelBulkTcknResultItem(tckn, "failed", displayName, "Üye değil — davet SMS'i gönderilemedi"));
                }
                continue;
            }

            if (participant.Status != ParticipantStatus.Active)
            {
                items.Add(new TravelBulkTcknResultItem(tckn, "failed", participant.FullName, "Katılımcı pasif/engelli — eklenemedi"));
                continue;
            }

            var previousApplications = await uow.TravelApplications.FindAsync(
                a => a.ParticipantId == participant.Id && a.TravelId != req.TravelId && a.Status != "rejected", ct);
            var previousTravelIds = previousApplications.Select(a => a.TravelId).Distinct().ToList();
            var previousTravels = previousTravelIds.Count == 0
                ? new Dictionary<Guid, Travel>()
                : (await uow.Travels.FindAsync(t => previousTravelIds.Contains(t.Id), ct)).ToDictionary(t => t.Id);
            var history = previousApplications
                .Where(a => previousTravels.ContainsKey(a.TravelId))
                .Select(a => {
                    var prior = previousTravels[a.TravelId];
                    return new TravelParticipationHistoryItem(prior.Name, prior.StartDate, prior.EndDate, a.Status);
                })
                .OrderByDescending(x => x.StartDate)
                .ToList();

            // Hata #7 düzeltmesi (2026-08-26): CreateAsync'teki tekil başvuru akışı transaction +
            // advisory lock ile korunurken, toplu TC ekleme hiçbir kilit açmadan check-then-insert
            // yapıyordu — paralel isteklerde kontenjan aşılabiliyordu. Her satır artık CreateAsync
            // ile aynı desende (IdentityLockKey + TravelLockKey, transaction içinde) işleniyor.
            var ownsBulkTransaction = !uow.HasActiveTransaction;
            if (ownsBulkTransaction) await uow.BeginTransactionAsync(ct);
            try
            {
                await uow.AcquireAdvisoryLockAsync(IdentityLockKey(participant.Tckn), ct);
                await uow.AcquireAdvisoryLockAsync(TravelLockKey(req.TravelId), ct);

                EnsureResidencyRestriction(travel, participant);
                EnsureGenderRestriction(travel, participant);
                EnsureAgeRestriction(travel, participant);
                await EnsureNoDuplicateApplicationAsync(participant.Id, req.TravelId, ct);
                await EnsureNoDateConflictAsync(participant.Id, travel, null, ct);
                await EnsureParticipationLimitAsync(travel, participant.Id, participant.FullName, ct);

                var gender = GenderStr(participant.Gender);
                var capacityOnlyVehicle = bus?.IsCapacityOnly ?? true;
                // Kullanıcı isteği (2026-08-07): koltuklu bir araç seçiliyse ve satırda bir koltuk
                // numarası verilmişse (Excel/manuel toplu listede), o koltuğa atanır — önceden
                // toplu eklemede koltuk seçimi hiç desteklenmiyordu, tüm yolcular koltuksuz
                // (kontenjan bazlı) ekleniyordu.
                string? seat = null;
                if (busId.HasValue && !capacityOnlyVehicle)
                {
                    seat = string.IsNullOrWhiteSpace(entry.SeatNumber) ? null : entry.SeatNumber!.Trim().ToUpperInvariant();
                    if (seat is not null)
                    {
                        await EnsureSeatAvailableAsync(req.TravelId, bus!, seat, null, ct);
                        await EnsureGenderAdjacencyAsync(req.TravelId, busId.Value, seat, gender, null, ct);
                    }
                    else
                    {
                        await EnsureVehicleCapacityAsync(req.TravelId, busId.Value, bus!, null, ct);
                    }
                }

                var code = $"GZB-{await uow.TravelApplications.NextCodeNumberAsync(ct):D6}";
                var app = TravelApplication.Create(
                    req.TravelId, participant.Id, "approved", "none", "unpaid",
                    busId, seat, "Toplu TC girişiyle eklendi", code, currentUser.Name);
                app.AddPassenger(TravelApplicationPassenger.Create(app.Id, participant.Id, gender, busId, seat, true));

                await EnsureCapacityOnCreateAsync(travel, 1, ct);

                await uow.TravelApplications.AddAsync(app, ct);
                await uow.SaveChangesAsync(ct);
                await SyncTravelCountsAsync(req.TravelId, ct);
                if (ownsBulkTransaction) await uow.CommitAsync(ct);

                items.Add(new TravelBulkTcknResultItem(tckn, "added", participant.FullName, null, history));
            }
            catch (ConflictException ex)
            {
                if (ownsBulkTransaction) await uow.RollbackAsync(ct);
                items.Add(new TravelBulkTcknResultItem(tckn, "failed", participant.FullName, ex.Message, history));
            }
            catch (ForbiddenException ex)
            {
                if (ownsBulkTransaction) await uow.RollbackAsync(ct);
                items.Add(new TravelBulkTcknResultItem(tckn, "failed", participant.FullName, ex.Message, history));
            }
            catch
            {
                if (ownsBulkTransaction) await uow.RollbackAsync(ct);
                throw;
            }
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "TravelApplication",
            EntityId = req.TravelId,
            Module = "Travels",
            Description = $"Toplu TC girişiyle yolcu eklendi: {items.Count(i => i.Outcome == "added")} eklendi, {items.Count(i => i.Outcome == "invite_sent")} davet gönderildi ({travel.Name}).",
        }, ct);

        return new TravelBulkTcknResult(
            items.Count,
            items.Count(i => i.Outcome == "added"),
            items.Count(i => i.Outcome == "invite_sent"),
            items.Count(i => i.Outcome is "duplicate" or "invalid" or "failed" or "no_contact" or "invite_skipped"),
            items);
    }

    /// <summary>
    /// Kullanıcı isteği (2026-08-07): birleşik gezi mesaj şablonu sistemi — manuel/toplu mesaj
    /// gönderme ekranı. Bir sefere ait yolculara (opsiyonel durum filtresiyle) ya seçilen
    /// şablonu (her yolcuya kişiselleştirilmiş: {{ad}} {{soyad}} vb.) ya da tamamen özel bir
    /// metni (yine placeholder'lar işlenir) gönderir. Genel BroadcastModal'dan (15+ modülde
    /// paylaşılan, şablonsuz/kişiselleştirmesiz serbest metin) farklı olarak burada her alıcıya
    /// KENDİ adıyla ayrı ayrı render edilmiş bir mesaj gider.
    ///
    /// Dedup: templateEvent == "departure_reminder" ise, TravelDepartureReminderJob'ın aynı
    /// hatırlatmayı tekrar göndermemesi için Travel.AttendanceReminderSentAt de işaretlenir.
    /// </summary>
    public async Task<TravelManualMessageResultDto> SendManualMessageAsync(TravelManualMessageRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(SendManualMessageAsync), new { req.TravelId, req.TemplateEvent });
        await EnsureTravelInScopeAsync(req.TravelId, ct);

        if (!req.Sms && !req.Notify)
            throw new ConflictException("En az bir kanal seçin (SMS veya bildirim).", "NO_CHANNEL");

        var travel = await uow.Travels.GetByIdAsync(req.TravelId, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        var settings = await travelSettings.GetAsync(ct);
        var template = (settings.NotificationTemplates ?? []).FirstOrDefault(t => t.Event == req.TemplateEvent);

        var smsBodyTemplate = req.CustomText ?? template?.SmsBody ?? "";
        var notifyBodyTemplate = req.CustomText ?? template?.NotifyBody ?? "";
        var smsEnabled = req.Sms && (req.CustomText is not null || (template?.SmsEnabled ?? false)) && !string.IsNullOrWhiteSpace(smsBodyTemplate);
        var notifyEnabled = req.Notify && (req.CustomText is not null || (template?.NotifyEnabled ?? false)) && !string.IsNullOrWhiteSpace(notifyBodyTemplate);

        if (!smsEnabled && !notifyEnabled)
            throw new ConflictException("Gönderilecek şablon veya metin boş.", "EMPTY_MESSAGE");

        var applications = await uow.TravelApplications.FindAsync(a => a.TravelId == req.TravelId, ct);
        if (req.StatusFilter is { Count: > 0 })
            applications = applications.Where(a => req.StatusFilter.Contains(a.Status)).ToList();
        if (smsEnabled) await smsGovernance.EnsureCanSendAsync("Travel", req.TemplateEvent, applications.Count, req.SmsOtp, ct);

        var partIds = applications.Where(a => !a.IsGuest).Select(a => a.ParticipantId).Distinct().ToList();
        var parts = await LoadParticipantsAsync(partIds, ct);

        var ctx = new TravelNotificationContext(travel.Name, travel.StartDate, travel.Destination, travel.DeparturePoint);
        var statusInfo = req.TemplateEvent switch
        {
            "departure_reminder" => "Hatırlatma",
            "postponed" => "Erteleme",
            "emergency" => "Acil Durum",
            "manual" => "Bilgilendirme",
            _ => "Bilgilendirme",
        };

        var recipients = 0;
        var smsSent = 0;
        var notifsSent = 0;
        foreach (var app in applications)
        {
            var name = app.IsGuest ? app.GuestFullName ?? "" : parts.GetValueOrDefault(app.ParticipantId)?.FullName ?? "";
            var phone = app.IsGuest ? app.GuestPhone : parts.GetValueOrDefault(app.ParticipantId)?.Phone;
            var notifyId = app.ParticipantId;
            recipients++;

            if (notifyEnabled)
            {
                var body = TravelMessageRenderer.Render(notifyBodyTemplate, name, ctx, null);
                await inAppNotifications.CreateAsync(notifyId, statusInfo, body, "application",
                    "travel", travel.Id.ToString(), travel.Name, null, statusInfo, ct);
                notifsSent++;
            }

            if (smsEnabled && !string.IsNullOrWhiteSpace(phone))
            {
                var body = TravelMessageRenderer.Render(smsBodyTemplate, name, ctx, null);
                try { if (await dispatcher.SendSmsAsync(phone!, body, ct)) smsSent++; }
                catch { }
            }
        }

        // departure_reminder şablonu manuel gönderildiyse, otomatik job'ın aynı hatırlatmayı
        // bir daha göndermemesi için işaretle (yukarıdaki dedup açıklamasına bkz).
        if (req.TemplateEvent == "departure_reminder" && recipients > 0 && travel.AttendanceReminderSentAt is null)
        {
            travel.MarkAttendanceReminderSent();
            uow.Travels.Update(travel);
            await uow.SaveChangesAsync(ct);
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Travel",
            EntityId = req.TravelId,
            Module = "Travels",
            Description = $"Manuel mesaj gönderildi: {req.TemplateEvent} ({travel.Name}, {recipients} alıcı, SMS: {smsSent}, bildirim: {notifsSent}).",
        }, ct);

        return new TravelManualMessageResultDto(recipients, smsSent, notifsSent);
    }


    public async Task<List<string>> GetNeighborhoodOptionsAsync(Guid? travelId, CancellationToken ct)
        => await uow.TravelApplications.GetDistinctNeighborhoodsAsync(travelId, ct);

    private async Task SyncTravelCountsAsync(Guid travelId, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(travelId, ct);
        if (travel is null) return;
        var approved = await uow.TravelApplications.CountByTravelAndStatusAsync(travelId, "approved", ct);
        var waitlist = await uow.TravelApplications.CountByTravelAndStatusAsync(travelId, "waitlist", ct);
        travel.SetCounts(approved, waitlist);
        uow.Travels.Update(travel);
        await uow.SaveChangesAsync(ct);
    }

    private static bool ParseDocumentRequired(string restrictionsJson)
    {
        if (string.IsNullOrWhiteSpace(restrictionsJson)) return false;
        try
        {
            using var doc = JsonDocument.Parse(restrictionsJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("documentRequired", out var p)
                && p.ValueKind == JsonValueKind.True)
                return true;
        }
        catch { }
        return false;
    }

    private static Guid? ParseGuid(string? value)
        => Guid.TryParse(value, out var g) ? g : null;

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string GenderStr(Gender g) => g == Gender.Female ? "female" : "male";

    private async Task<PagedResult<TravelApplicationDto>> MapPageAsync(PagedResult<TravelApplication> paged, CancellationToken ct)
    {
        var partIds = paged.Items.Select(a => a.ParticipantId).Distinct().ToList();
        var travelIds = paged.Items.Select(a => a.TravelId).Distinct().ToList();
        var busIds = paged.Items.Where(a => a.BusId.HasValue).Select(a => a.BusId!.Value).Distinct().ToList();

        var parts = await LoadParticipantsAsync(partIds, ct);
        var travels = travelIds.Count == 0 ? new Dictionary<Guid, Travel>()
            : (await uow.Travels.FindAsync(t => travelIds.Contains(t.Id), ct)).ToDictionary(t => t.Id);
        var buses = busIds.Count == 0 ? new Dictionary<Guid, TravelBus>()
            : (await uow.TravelBuses.FindAsync(b => busIds.Contains(b.Id), ct)).ToDictionary(b => b.Id);

        return new PagedResult<TravelApplicationDto>
        {
            Items = paged.Items.Select(a => Map(a, parts, travels, buses, [])).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    private async Task<TravelApplicationDto> MapDetailAsync(TravelApplication a, CancellationToken ct)
    {
        var passengerPartIds = a.Passengers.Select(p => p.ParticipantId).ToList();
        var partIds = passengerPartIds.Append(a.ParticipantId).Distinct().ToList();
        var parts = await LoadParticipantsAsync(partIds, ct);
        var travel = await uow.Travels.GetByIdAsync(a.TravelId, ct);

        var allBusIds = a.Passengers.Where(ps => ps.BusId.HasValue).Select(ps => ps.BusId!.Value)
            .Concat(a.BusId.HasValue ? [a.BusId.Value] : Array.Empty<Guid>())
            .Distinct().ToList();
        var buses = allBusIds.Count == 0 ? new Dictionary<Guid, TravelBus>()
            : (await uow.TravelBuses.FindAsync(b => allBusIds.Contains(b.Id), ct)).ToDictionary(b => b.Id);

        var passengerDtos = a.Passengers
            .OrderByDescending(p => p.IsPrimary)
            .Select(p =>
            {
                var pp = parts.GetValueOrDefault(p.ParticipantId);
                var busName = p.BusId.HasValue ? buses.GetValueOrDefault(p.BusId.Value)?.Name : null;
                return new TravelApplicationPassengerDto(p.Id, p.ParticipantId, pp?.FullName ?? "", pp?.Tckn ?? "", p.Gender, p.BusId, busName, p.SeatNumber, p.IsPrimary, p.Status);
            })
            .ToList();

        var travels = travel is null ? new Dictionary<Guid, Travel>() : new() { [travel.Id] = travel };
        return Map(a, parts, travels, buses, passengerDtos);
    }

    private async Task<Dictionary<Guid, Participant>> LoadParticipantsAsync(List<Guid> ids, CancellationToken ct)
        => ids.Count == 0
            ? []
            : (await uow.Participants.FindAsync(p => ids.Contains(p.Id), ct)).ToDictionary(p => p.Id);

    private static TravelApplicationDto Map(
        TravelApplication a,
        Dictionary<Guid, Participant> parts,
        Dictionary<Guid, Travel> travels,
        Dictionary<Guid, TravelBus> buses,
        List<TravelApplicationPassengerDto> passengers)
    {
        var p = parts.GetValueOrDefault(a.ParticipantId);
        var travel = travels.GetValueOrDefault(a.TravelId);
        var travelName = travel?.Name ?? "";
        var busName = a.BusId.HasValue ? buses.GetValueOrDefault(a.BusId.Value)?.Name : null;

        var displayName = a.IsGuest
            ? $"{(string.IsNullOrWhiteSpace(a.GuestFullName) ? "Misafir" : a.GuestFullName)} (Misafir)"
            : p?.FullName ?? "";
        var displayTckn = a.IsGuest ? a.GuestTckn ?? "" : p?.Tckn ?? "";
        var displayPhone = a.IsGuest ? a.GuestPhone ?? p?.Phone ?? "" : p?.Phone ?? "";
        var displayEmail = a.IsGuest ? a.GuestEmail ?? p?.Email ?? "" : p?.Email ?? "";
        var displayGender = a.IsGuest
            ? a.GuestGender ?? (p is null ? "mixed" : GenderStr(p.Gender))
            : p is null ? "mixed" : GenderStr(p.Gender);
        var displayBirthDate = a.IsGuest ? a.GuestBirthDate ?? p?.BirthDate : p?.BirthDate;

        return new TravelApplicationDto(
            a.Id, a.TravelId, travelName,
            a.ParticipantId, displayName, displayTckn, displayPhone, displayEmail,
            displayGender, displayBirthDate, p?.Neighborhood, p?.Address, a.ApplicationDate,
            travel?.StartDate, travel?.EndDate,
            a.Status, a.DocumentStatus, a.PaymentStatus,
            a.BusId, busName, a.SeatNumber,
            a.Notes,
            a.EmergencyContactName, a.EmergencyContactPhone,
            passengers,
            a.IsGuest, a.GuestFullName, a.GuestTckn, a.GuestPhone, a.GuestEmail, a.GuestBirthDate, a.GuestGender,
            p?.FullName, p?.Tckn, a.RejectionReason);
    }
}
