using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Nexora.Application.Common;
using Nexora.Application.Configuration;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.ParticipantAuth;
using Nexora.Application.Features.Participants;
using Nexora.Application.Features.Participants.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Loyalty.Requests;
using Nexora.Infrastructure.Security;
using Nexora.Infrastructure.Services.Email;

namespace Nexora.Infrastructure.Services;

public class ParticipantManagementService(
    IUnitOfWork uow,
    INviService nvi,
    IConfiguration configuration,
    IOptionsMonitor<ParticipantSettings> participantSettings,
    IAuditService audit,
    IParticipantAuthService participantAuth,
    IOtpService otpService,
    INotificationDispatcher dispatcher,
    ICurrentUser currentUser,
    IUserScopeService userScope,
    ILoyaltyService loyalty,
    IParticipantEventHistoryService eventHistory,
    IActivityLogger log) : IParticipantService
{
    public async Task<PagedResult<ParticipantDto>> GetPagedAsync(ParticipantListParams p, CancellationToken ct)
    {
        var scopedIds = await ResolveScopedParticipantIdsAsync(ct);
        var paged = await uow.Participants.GetPagedAsync(p, scopedIds, ct);
        var ids = paged.Items.Select(x => x.Id).ToList();
        var childCounts = await uow.Participants.CountChildrenForAsync(ids, ct);
        var guardianCounts = await uow.Participants.CountGuardiansForAsync(ids, ct);
        var activityCounts = await uow.Participants.CountActivitiesForAsync(
            paged.Items.ToDictionary(x => x.Id, x => x.Tckn), ct);
        // Kullanıcı bulgusu (2026-08-09): "Etkinlik" sütunu her zaman 0 gösteriyordu — MapDto'da
        // bu alana sabit 0 geçiliyordu. Diğer sayaçlarla (childCounts, activityCounts) aynı toplu-
        // sorgu deseniyle gerçek etkinlik başvuru sayısı hesaplanıyor.
        var eventCounts = await uow.EventApplications.CountForParticipantsAsync(ids, ct);
        var mask = MaskEnabled();

        return new PagedResult<ParticipantDto>
        {
            Items = paged.Items.Select(x => MapDto(x, childCounts.GetValueOrDefault(x.Id), guardianCounts.GetValueOrDefault(x.Id), mask, activityCounts.GetValueOrDefault(x.Id), eventCounts.GetValueOrDefault(x.Id))).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<ParticipantSummaryDto> GetSummaryAsync(ParticipantListParams p, CancellationToken ct)
        => await uow.Participants.GetSummaryAsync(p, await ResolveScopedParticipantIdsAsync(ct), ct);

    private async Task<HashSet<Guid>?> ResolveScopedParticipantIdsAsync(CancellationToken ct)
        => currentUser.Id is Guid uid
            ? await userScope.GetScopedParticipantIdsAsync(uid, ct)
            : null;

    // Yetki alanı (scope) kısıtlı bir kullanıcının, kendi liste ekranında görmediği bir
    // katılımcı ID'sini doğrudan URL'ye yazarak erişmesini/değiştirmesini engeller (IDOR
    // önlemi). Süper admin veya sınırsız kullanıcılar için scopedIds null döner (kontrol atlanır).
    private async Task EnsureParticipantInScopeAsync(Guid participantId, CancellationToken ct)
    {
        var scopedIds = await ResolveScopedParticipantIdsAsync(ct);
        if (scopedIds is not null && !scopedIds.Contains(participantId))
            throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
    }

    public async Task<ParticipantDetailDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdWithRelationsAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        // Yetki alanı (scope) kısıtlı bir kullanıcı, liste ekranında görmediği bir katılımcının
        // ID'sini doğrudan biliyorsa bile detayına erişememelidir (IDOR önlemi).
        // 404 dönülür (403 değil) ki kayıt var/yok bilgisi bile sızdırılmasın.
        await EnsureParticipantInScopeAsync(id, ct);

        var mask = MaskEnabled();

        var children = p.Children
            .Where(g => g.Child is not null)
            .Select(g => MapDto(g.Child!, 0, 1, mask))
            .ToList();

        var guardians = p.Guardians
            .Where(g => g.Guardian is not null)
            .Select(g => new GuardianLinkDto(
                g.Guardian!.Id,
                mask ? MaskName(g.Guardian.FullName) : g.Guardian.FullName,
                g.Guardian.PhotoUrl,
                mask ? IdentityMask.MaskPhoneStrict(g.Guardian.Phone) : g.Guardian.Phone,
                g.Relation))
            .ToList();

        var sedaEducations = (await uow.SedaEducationRecords.GetByTcknAsync(p.Tckn, ct))
            .Select(r => new Nexora.Application.Features.Seda.Dtos.SedaEducationItemDto(r.AcademicYear, r.CreatedAt))
            .ToList();

        var (stats, monthly, recentEvents) = await BuildActivitySummaryAsync(p, ct);

        return new ParticipantDetailDto(
            p.Id,
            mask ? MaskName(p.FullName) : p.FullName,
            mask ? MaskTckn(p.Tckn) : p.Tckn,
            p.PhotoUrl,
            p.BirthDate,
            Age(p.BirthDate),
            p.Gender.ToString(),
            mask ? IdentityMask.MaskAddress(p.Address) : p.Address,
            p.City,
            p.District,
            p.Neighborhood,
            p.IlceKodu,
            mask ? IdentityMask.MaskEmail(p.Email) : p.Email,
            mask ? IdentityMask.MaskPhoneStrict(p.Phone) : p.Phone,
            p.IsMinor,
            mask ? IdentityMask.MaskPhoneStrict(p.GuardianPhone) : p.GuardianPhone,
            mask ? IdentityMask.MaskEmail(p.GuardianEmail) : p.GuardianEmail,
            children.Count,
            guardians.Count,
            0,
            DtoStatus(p),
            p.BlockReason,
            p.IsVerified,
            p.IsFirstLogin,
            p.RegisteredAt,
            p.LastEventName,
            p.CreatedAt,
            stats,
            monthly,
            recentEvents,
            children,
            guardians,
            p.AdminNotes,
            sedaEducations);
    }

    private async Task<(ParticipantStatsDto Stats, ParticipantMonthlyDto Monthly, List<ParticipantEventDto> Recent)> BuildActivitySummaryAsync(Participant p, CancellationToken ct)
    {
        var history = await eventHistory.GetListAsync(new ParticipantEventListParams { ParticipantId = p.Id, Limit = "1000" }, ct);
        var rows = history.Items;
        var today = TurkeyTime.TodayDate();

        var completed = history.Counts.Attended;
        var missed = history.Counts.Missed;
        var ongoing = rows.Count(r => r.Date.Date >= today && r.Approval != "Rejected");
        var attendanceRate = completed + missed > 0 ? (int)Math.Round(100.0 * completed / (completed + missed)) : 0;

        var familyIds = new List<Guid> { p.Id };
        familyIds.AddRange(p.Children.Where(c => c.Child is not null).Select(c => c.Child!.Id));
        var surveyCount = await uow.Surveys.CountResponsesByParticipantsAsync(familyIds, ct);

        var monthStart = new DateTime(today.Year, today.Month, 1);
        var monthEnd = monthStart.AddMonths(1);
        var monthRows = rows.Where(r => r.Date >= monthStart && r.Date < monthEnd).ToList();
        var monthAttended = monthRows.Count(r => r.Attendance == "Attended");
        var monthMissed = monthRows.Count(r => r.Attendance == "Missed");
        var monthRate = monthAttended + monthMissed > 0 ? (int)Math.Round(100.0 * monthAttended / (monthAttended + monthMissed)) : 0;
        var monthHours = (int)Math.Round(monthRows.Where(r => r.Attendance == "Attended").Sum(r => DurationHours(r.Time)));

        var monthStartUtc = TurkeyTime.ToUtc(monthStart);
        var monthTx = await uow.LoyaltyTransactions.FindAsync(
            t => familyIds.Contains(t.ParticipantId) && t.CreatedAt >= monthStartUtc && t.Points > 0, ct);
        var monthPoints = monthTx.Sum(t => t.Points);

        var stats = new ParticipantStatsDto(history.Counts.All, completed, ongoing, attendanceRate, surveyCount);
        var monthly = new ParticipantMonthlyDto(monthRows.Count, monthHours, monthPoints, monthRate);
        var recent = rows.Take(5).ToList();
        return (stats, monthly, recent);
    }

    private static double DurationHours(string? time)
    {
        if (string.IsNullOrWhiteSpace(time)) return 0;
        var parts = time.Split('-', StringSplitOptions.TrimEntries);
        if (parts.Length != 2) return 0;
        if (!TimeSpan.TryParse(parts[0], out var start) || !TimeSpan.TryParse(parts[1], out var end)) return 0;
        var duration = end - start;
        return duration > TimeSpan.Zero ? duration.TotalHours : 0;
    }

    public async Task<NviLookupResultDto> NviLookupAsync(NviLookupRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(NviLookupAsync), new { TcknPrefix = Prefix(req.Tckn) });

        if (!TcKimlikValidator.IsValid(req.Tckn))
            throw new ConflictException("Geçerli bir T.C. kimlik numarası giriniz.", "INVALID_TCKN");

        var res = await nvi.GetPersonAndChildrenAsync(req.Tckn, req.BirthDate, 18, ct);
        if (!res.Success || res.Person is null)
            throw new ConflictException(res.ErrorMessage ?? "Kimlik doğrulanamadı.", "NVI_FAILED");

        var person = res.Person;
        var mask = MaskEnabled();
        var personName = $"{person.FirstName} {person.LastName}".Trim();

        return new NviLookupResultDto(
            mask ? MaskTckn(person.Tckn) : person.Tckn,
            mask ? MaskName(personName) : personName,
            person.BirthDate,
            person.Gender.ToString(),
            person.Address,
            Age(person.BirthDate) < 18,
            res.Children.Select(c =>
            {
                var childName = $"{c.FirstName} {c.LastName}".Trim();
                return new NviChildResultDto(
                    mask ? MaskTckn(c.Tckn) : c.Tckn,
                    mask ? MaskName(childName) : childName,
                    c.BirthDate,
                    c.Gender.ToString(),
                    c.Address);
            }).ToList());
    }

    public async Task<ParticipantLookupResultDto> LookupByTcknAsync(string tckn, CancellationToken ct)
    {
        if (!TcKimlikValidator.IsValid(tckn))
            throw new ConflictException("Geçerli bir T.C. kimlik numarası giriniz.", "INVALID_TCKN");

        var existing = await uow.Participants.GetByTcknAsync(tckn, ct);
        if (existing is null)
            return new ParticipantLookupResultDto(false, null);

        var detail = await GetByIdAsync(existing.Id, ct);
        return new ParticipantLookupResultDto(true, detail);
    }

    public async Task<ParticipantDto> CreateAsync(CreateParticipantRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { TcknPrefix = Prefix(req.Tckn), req.DeliveryChannel });

        if (!TcKimlikValidator.IsValid(req.Tckn))
            throw new ConflictException("Geçerli bir T.C. kimlik numarası giriniz.", "INVALID_TCKN");

        if (await uow.Participants.ExistsByTcknAsync(req.Tckn, ct))
            throw new ConflictException("Bu T.C. kimlik numarası zaten kayıtlı.", "DUPLICATE_TCKN");

        var nviRes = await nvi.GetPersonAndChildrenAsync(req.Tckn, req.BirthDate, 18, ct);
        if (!nviRes.Success || nviRes.Person is null)
            throw new ConflictException(nviRes.ErrorMessage ?? "Kimlik doğrulanamadı.", "NVI_FAILED");

        var person = nviRes.Person;
        var isMinor = Age(person.BirthDate) < 18;

        var addressRes = await nvi.GetAddressAsync(req.Tckn, req.BirthDate, ct);
        var addr = addressRes.Success ? addressRes.Address : null;

        if (isMinor && string.IsNullOrWhiteSpace(req.GuardianPhone))
            throw new ConflictException("18 yaş altı kayıtlarda veli telefon numarası zorunludur.", "GUARDIAN_PHONE_REQUIRED");

        if (isMinor && !string.IsNullOrWhiteSpace(req.GuardianEmail))
        {
            var emailValidator = new System.ComponentModel.DataAnnotations.EmailAddressAttribute();
            if (!emailValidator.IsValid(req.GuardianEmail))
                throw new ConflictException("Geçerli bir veli e-posta adresi giriniz.", "GUARDIAN_EMAIL_INVALID");
        }

        var length = configuration.GetValue<int>("PasswordPolicy:GeneratedLength");
        var useMock = configuration.GetValue("SmsSettings:UseMockMode", false);
        var generatedPassword = PasswordGenerator.Generate(length, useMock);
        var hash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(generatedPassword);

        var participant = Participant.Create(
            req.Tckn,
            $"{person.FirstName} {person.LastName}".Trim(),
            person.BirthDate,
            person.Gender,
            isMinor,
            hash,
            req.Email,
            req.Phone,
            isMinor ? req.GuardianPhone : null,
            isMinor ? req.GuardianEmail : null,
            person.Address);

        if (addr is not null)
            participant.ApplyStructuredAddress(addr.FullAddress, addr.City, addr.District, addr.Neighborhood, addr.DistrictCode);

        await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.Participants.AddAsync(participant, ct);

            foreach (var child in nviRes.Children)
            {
                var existing = await uow.Participants.FirstOrDefaultAsync(x => x.Tckn == child.Tckn, ct);
                Guid childId;
                if (existing is not null)
                {
                    childId = existing.Id;
                }
                else
                {
                    var childHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(PasswordGenerator.Generate(length, useMock));
                    var childEntity = Participant.Create(
                        child.Tckn,
                        $"{child.FirstName} {child.LastName}".Trim(),
                        child.BirthDate,
                        child.Gender,
                        true,
                        childHash,
                        null,
                        null,
                        req.Phone,
                        req.Email,
                        child.Address);
                    if (addr is not null)
                        childEntity.ApplyStructuredAddress(addr.FullAddress, addr.City, addr.District, addr.Neighborhood, addr.DistrictCode);
                    await uow.Participants.AddAsync(childEntity, ct);
                    childId = childEntity.Id;
                }

                participant.Children.Add(ParticipantGuardian.Create(participant.Id, childId, "Çocuk"));
            }

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        var isSms = string.Equals(req.DeliveryChannel, "Sms", StringComparison.OrdinalIgnoreCase);
        var smsTarget = participant.Phone ?? participant.GuardianPhone;
        var emailTarget = participant.Email ?? participant.GuardianEmail;

        // Hoşgeldin bonusu: önceden yalnızca vatandaşın kendi self-register+OTP akışında
        // (ParticipantAuthService.VerifyOtpAsync → GrantWelcomeBonusAsync) veriliyordu.
        // Admin panelden manuel kayıt açılan katılımcılar bu bonusu hiç almıyordu (P0 bulgusu,
        // bkz. docs/hosgeldin-bonusu-e2e-test-2026-07-29.md). WelcomeBonusSeenAt henüz
        // dolmadığı için vatandaş citizen-portal'a ilk girişinde "consume" akışıyla bu
        // puanı normal şekilde görüp tüketecek.
        await loyalty.AwardPointsAsync(new AwardPointsRequest(participant.Id, "welcome_bonus", participant.Id.ToString()), ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "Participants",
            Description = $"Katılımcı oluşturuldu: {participant.FullName} ({nviRes.Children.Count} çocuk bağlandı)",
        }, ct);

        if (isSms && !string.IsNullOrWhiteSpace(smsTarget))
            await dispatcher.SendSmsAsync(smsTarget,
                $"Sayın {participant.FullName}, Sultangazi Belediyesi giriş şifreniz: {generatedPassword}. İlk girişte değiştirmeniz zorunludur.", ct);
        else if (!isSms && !string.IsNullOrWhiteSpace(emailTarget))
        {
            var email = EmailTemplates.ParticipantCredentials(participant.FullName, participant.Tckn, generatedPassword, "");
            await dispatcher.SendEmailAsync(emailTarget, email.Subject, email.HtmlBody, ct);
        }

        log.LogStepResult("DeliverCredentials", new { participant.Id, Channel = isSms ? "SMS" : "E-posta" });

        var childrenCount = nviRes.Children.Count;
        return MapDto(participant, childrenCount, 0, MaskEnabled());
    }

    public async Task<ParticipantDto> UpdateAsync(Guid id, UpdateParticipantRequest req, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        var before = JsonSerializer.Serialize(new { p.Email, p.Phone, p.GuardianPhone, p.GuardianEmail });
        var oldPhone = p.Phone;

        // SORUN (2026-09-23, kullanıcı bulgusu): UpdateContact eskiden istekteki alanı
        // KOŞULSUZ yazıyordu — admin panel formu, KVKK maskelemesi açıkken (varsayılan
        // MaskIdentity=true) liste/detay ekranından gelen maskelenmiş telefonu (ör.
        // "532****33") forma dolduruyor, PhoneInput yıldızları silince geriye "53233"
        // gibi bozuk/kısa bir rakam dizisi kalıyordu. Admin telefona hiç dokunmadan
        // formu kaydetse bile bu bozuk değer GERÇEK telefonun üzerine yazılıyordu.
        // Artık istekte alan boş/null bırakılırsa (frontend artık maskelenmiş değeri
        // hiç göndermiyor, bkz. ParticipantsTab.tsx toForm) mevcut kayıt korunur — bu
        // gerçek bir PATCH semantiği: yalnızca dolu gönderilen alanlar güncellenir.
        var phone = string.IsNullOrWhiteSpace(req.Phone) || IdentityMask.LooksMasked(req.Phone) ? p.Phone : req.Phone;
        var email = string.IsNullOrWhiteSpace(req.Email) || IdentityMask.LooksMasked(req.Email) ? p.Email : req.Email;
        var guardianPhone = string.IsNullOrWhiteSpace(req.GuardianPhone) || IdentityMask.LooksMasked(req.GuardianPhone) ? p.GuardianPhone : req.GuardianPhone;
        var guardianEmail = string.IsNullOrWhiteSpace(req.GuardianEmail) || IdentityMask.LooksMasked(req.GuardianEmail) ? p.GuardianEmail : req.GuardianEmail;

        p.UpdateContact(email, phone, guardianPhone, guardianEmail);
        if (req.IsActive.HasValue)
            p.SetStatus(req.IsActive.Value ? ParticipantStatus.Active : ParticipantStatus.Passive);
        uow.Participants.Update(p);

        var phoneChanged = !PhoneEquals(oldPhone, p.Phone);

        var affectedChildren = new List<Participant>();
        if (!p.IsMinor && phoneChanged)
        {
            var children = await uow.Participants.GetChildrenAsync(p.Id, ct);
            foreach (var child in children)
            {
                child.UpdateContact(child.Email, child.Phone, p.Phone, p.Email);
                uow.Participants.Update(child);
                affectedChildren.Add(child);
            }
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Participant",
            EntityId = p.Id,
            Module = "Participants",
            Description = $"Katılımcı iletişim bilgileri güncellendi: {p.FullName}",
            OldValues = before,
            NewValues = JsonSerializer.Serialize(new { p.Email, p.Phone, p.GuardianPhone, p.GuardianEmail }),
        }, ct);

        if (phoneChanged)
        {
            await participantAuth.TerminateSessionsAsync(p.Id, ct);
            foreach (var child in affectedChildren)
                if (string.IsNullOrWhiteSpace(child.Phone))
                    await participantAuth.TerminateSessionsAsync(child.Id, ct);
        }

        return await BuildDtoAsync(p, ct);
    }

    public async Task<ParticipantDto> RefreshFromNviAsync(Guid id, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        // Kullanıcı isteği (2026-10-06): "NVİ'den Yenile" (tekil ve toplu) artık yalnızca adresi
        // değil; ad soyad, doğum tarihi, cinsiyet, adres ve 18 yaş altı çocukları da getirir.
        // Çocuklar sistemde TC ile varsa bağlanır, yoksa yeni katılımcı olarak açılır.
        var personRes = await nvi.GetPersonAndChildrenAsync(p.Tckn, p.BirthDate, 18, ct);
        if (!personRes.Success || personRes.Person is null)
            throw new ConflictException(personRes.ErrorMessage ?? "NVI kimlik bilgisi alınamadı.", "NVI_FAILED");

        var person = personRes.Person;
        // NVI mock modunda servis her TC için sahte kişi + sahte çocuk döner; gerçek kayıtların
        // ad/cinsiyet bilgisini ezmemek ve sahte çocuk açmamak için mock modda yalnızca adres uygulanır.
        var mockMode = configuration.GetValue("Nvi:UseMockMode", true);
        if (!mockMode)
            p.ApplyNviIdentity($"{person.FirstName} {person.LastName}".Trim(), person.BirthDate, person.Gender, Age(person.BirthDate) < 18);

        var addressRes = await nvi.GetAddressAsync(p.Tckn, p.BirthDate, ct);
        var addr = addressRes.Success ? addressRes.Address : null;
        if (addr is not null)
            p.ApplyStructuredAddress(addr.FullAddress, addr.City, addr.District, addr.Neighborhood, addr.DistrictCode);
        else if (!string.IsNullOrWhiteSpace(person.Address))
            p.SetAddress(person.Address);

        var linkedTckns = (await uow.Participants.GetChildrenAsync(p.Id, ct)).Select(c => c.Tckn).ToHashSet();
        var length = configuration.GetValue<int>("PasswordPolicy:GeneratedLength");
        var useMock = configuration.GetValue("SmsSettings:UseMockMode", false);
        int added = 0, linked = 0;
        foreach (var child in mockMode ? [] : personRes.Children)
        {
            if (!linkedTckns.Add(child.Tckn)) continue;
            var existing = await uow.Participants.GetByTcknAsync(child.Tckn, ct);
            Guid childId;
            if (existing is not null)
            {
                childId = existing.Id;
                linked++;
            }
            else
            {
                var childHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(PasswordGenerator.Generate(length, useMock));
                var childEntity = Participant.Create(child.Tckn, $"{child.FirstName} {child.LastName}".Trim(), child.BirthDate,
                    child.Gender, true, childHash, null, null, p.Phone, p.Email, child.Address);
                if (addr is not null)
                    childEntity.ApplyStructuredAddress(addr.FullAddress, addr.City, addr.District, addr.Neighborhood, addr.DistrictCode);
                childEntity.MarkVerified();
                await uow.Participants.AddAsync(childEntity, ct);
                childId = childEntity.Id;
                added++;
            }
            await uow.ParticipantGuardians.AddAsync(ParticipantGuardian.Create(p.Id, childId, "Çocuk"), ct);
        }

        p.MarkNviSynced();
        uow.Participants.Update(p);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Participant",
            EntityId = p.Id,
            Module = "Participants",
            Description = $"Katılımcı NVI'den yenilendi: {p.FullName} (kimlik + adres{(addr is null ? " alınamadı" : "")}, {added} yeni çocuk, {linked} mevcut çocuk bağlandı)",
        }, ct);

        return await BuildDtoAsync(p, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        await uow.BeginTransactionAsync(ct);
        try
        {
            var released = await ReleaseApplicationsAsync(id, ct);

            uow.Participants.Delete(p);
            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);

            await participantAuth.TerminateSessionsAsync(p.Id, ct);

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Delete,
                EntityType = "Participant",
                EntityId = p.Id,
                Module = "Participants",
                Description = $"Katılımcı silindi: {p.FullName}",
                AdditionalDataJson = JsonSerializer.Serialize(released),
            }, ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }
    }

    private async Task<Dictionary<string, int>> ReleaseApplicationsAsync(Guid participantId, CancellationToken ct)
    {
        var released = new Dictionary<string, int>();

        var eventApps = await uow.EventApplications.FindAsync(a => a.ParticipantId == participantId, ct);
        if (eventApps.Count > 0)
        {
            uow.EventApplications.DeleteRange(eventApps);
            released["eventApplications"] = eventApps.Count;
        }

        var travelApps = await uow.TravelApplications.FindAsync(a => a.ParticipantId == participantId, ct);
        if (travelApps.Count > 0)
        {
            uow.TravelApplications.DeleteRange(travelApps);
            released["travelApplications"] = travelApps.Count;
        }

        var facilityApps = await uow.FacilityApplications.FindAsync(a => a.ParticipantId == participantId, ct);
        if (facilityApps.Count > 0)
        {
            uow.FacilityApplications.DeleteRange(facilityApps);
            released["facilityApplications"] = facilityApps.Count;
        }

        var facilityRegs = await uow.FacilityRegistrations.FindAsync(r => r.ParticipantId == participantId, ct);
        if (facilityRegs.Count > 0)
        {
            uow.FacilityRegistrations.DeleteRange(facilityRegs);
            released["facilityRegistrations"] = facilityRegs.Count;
        }

        return released;
    }

    public async Task<ParticipantDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        var wasActive = p.Status == ParticipantStatus.Active;
        p.SetStatus(wasActive ? ParticipantStatus.Passive : ParticipantStatus.Active);
        uow.Participants.Update(p);
        await uow.SaveChangesAsync(ct);

        // Aktiften pasife geçişte mevcut oturumlar sonlandırılır; aksi halde eski
        // token ile hesap engellenmiş gibi görünse de sisteme erişim devam eder
        // (bkz. docs/katilimcilar-tam-denetim raporu, P0 bulgusu).
        if (wasActive)
            await participantAuth.TerminateSessionsAsync(p.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Participant",
            EntityId = p.Id,
            Module = "Participants",
            Description = $"Katılımcı durumu değiştirildi: {p.FullName} → {p.Status}",
        }, ct);

        return await BuildDtoAsync(p, ct);
    }

    public async Task<ParticipantDto> SetStatusAsync(Guid id, SetStatusRequest req, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        if (!Enum.TryParse<ParticipantStatus>(req.Status, out var status))
            throw new ConflictException("Geçersiz durum.", "INVALID_STATUS");

        var wasActive = p.Status == ParticipantStatus.Active;
        p.SetStatus(status, req.Reason);
        uow.Participants.Update(p);
        await uow.SaveChangesAsync(ct);

        // Aktiften Pasife/Engelli'ye geçişte mevcut oturumlar sonlandırılır (SESSION_INVALIDATED);
        // aksi halde eski token'la giriş devam eder, hesap durumu sadece kozmetik kalırdı.
        if (wasActive && status != ParticipantStatus.Active)
            await participantAuth.TerminateSessionsAsync(p.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Participant",
            EntityId = p.Id,
            Module = "Participants",
            Description = $"Katılımcı durumu değiştirildi: {p.FullName} → {status}",
        }, ct);

        return await BuildDtoAsync(p, ct);
    }

    public async Task SendPasswordResetAsync(Guid id, SendPasswordResetRequest req, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        var isSms = req.Channel == "Sms";
        var target = isSms ? (p.Phone ?? p.GuardianPhone) : (p.Email ?? p.GuardianEmail);
        if (string.IsNullOrWhiteSpace(target))
            throw new ConflictException(isSms ? "Telefon numarası tanımlı değil." : "E-posta adresi tanımlı değil.", "CONTACT_NOT_SET");

        var length = configuration.GetValue<int>("PasswordPolicy:GeneratedLength");
        var useMock = configuration.GetValue("SmsSettings:UseMockMode", false);
        var generatedPassword = PasswordGenerator.Generate(length, useMock);
        var newHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(generatedPassword);

        if (isSms)
        {
            var delivered = await dispatcher.SendSmsAsync(target,
                $"Sayın {p.FullName}, Sultangazi Belediyesi yeni giriş şifreniz: {generatedPassword}. İlk girişte değiştirmeniz zorunludur.", ct);
            if (!delivered)
                throw new ConflictException("Geçici şifre SMS ile gönderilemedi. Mevcut şifre korundu; lütfen daha sonra tekrar deneyin.", "CREDENTIAL_DELIVERY_FAILED");
        }
        else
        {
            var email = EmailTemplates.ParticipantCredentials(p.FullName, p.Tckn, generatedPassword, "");
            await dispatcher.SendEmailAsync(target, email.Subject, email.HtmlBody, ct);
        }

        p.ResetTemporaryPassword(newHash);
        p.Unlock();
        uow.Participants.Update(p);
        await uow.SaveChangesAsync(ct);

        await participantAuth.TerminateSessionsAsync(p.Id, ct);
        await otpService.InvalidateAsync(p.Id, Nexora.Domain.Enums.OtpPurpose.PasswordReset, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordReset,
            EntityType = "Participant",
            EntityId = p.Id,
            Module = "Participants",
            Description = $"Geçici şifre gönderildi, ilk girişte değişim zorunlu ({(isSms ? "SMS" : "E-posta")}): {p.FullName}",
        }, ct);

        log.LogStepResult("DeliverCredentials", new { p.Id, Channel = isSms ? "SMS" : "E-posta" });
    }

    public async Task SetManualPasswordAsync(Guid id, SetManualPasswordRequest req, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        var hash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(req.NewPassword);
        if (req.MustChangeOnFirstLogin)
            p.ResetTemporaryPassword(hash);
        else
            p.CompleteInitialPassword(hash);

        // SORUN (2026-09-23, kullanıcı bulgusu — gerçek API testiyle kanıtlandı): vatandaş
        // şifresini hatırlayamayıp arka arkaya yanlış denerse hesap kilitlenir
        // (LockoutSettings:MaxFailedAttempts, varsayılan 5). Yönetici admin panelden doğru
        // şifreyi elle belirlese bile kilit ve FailedLoginCount olduğu gibi kalıyordu; giriş
        // "ACCOUNT_LOCKED" ile reddedilmeye devam ediyordu. Kullanıcı bunu "TC ve şifre doğru
        // olmasına rağmen giriş yapamıyorum" olarak yaşıyor. Yönetici müdahalesi (şifre
        // belirleme / geçici şifre gönderme) kilidi de temizlemelidir — aksi hâlde admin
        // panelden şifre değiştirmek fiilen hiçbir işe yaramaz.
        p.Unlock();

        uow.Participants.Update(p);
        await uow.SaveChangesAsync(ct);

        await participantAuth.TerminateSessionsAsync(p.Id, ct);
        await otpService.InvalidateAsync(p.Id, Nexora.Domain.Enums.OtpPurpose.PasswordReset, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordReset,
            EntityType = "Participant",
            EntityId = p.Id,
            Module = "Participants",
            Description = req.MustChangeOnFirstLogin
                ? $"Şifre yönetici tarafından elle belirlendi; ilk girişte değişim zorunlu: {p.FullName}"
                : $"Şifre yönetici tarafından elle belirlendi: {p.FullName}",
        }, ct);
    }

    public async Task UpdateAdminNotesAsync(Guid id, string? notes, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);
        p.SetAdminNotes(notes?.Trim() == string.Empty ? null : notes?.Trim());
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Participant",
            EntityId = p.Id,
            Module = "Participants",
            Description = $"Katılımcı admin notu güncellendi: {p.FullName}",
        }, ct);
    }

    // Kullanıcı isteği (2026-08-05): AdminUserManagementService.UnlockAsync ile aynı desen —
    // 5 hatalı giriş denemesi sonrası kilitlenen bir katılımcı hesabının kilidi (normalde
    // 1 dakika sonra otomatik açılır) admin panelden anında kaldırılabilir.
    public async Task<ParticipantDto> UnlockAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(UnlockAsync), new { id });

        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        if (!p.IsLocked && p.FailedLoginCount == 0)
            return await BuildDtoAsync(p, ct);

        p.Unlock();
        uow.Participants.Update(p);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Participant",
            EntityId = p.Id,
            Module = "Participants",
            Description = $"Hesap kilidi kaldırıldı: {p.FullName}",
        }, ct);

        return await BuildDtoAsync(p, ct);
    }

    public async Task<AppointmentKeyDto> GetAppointmentKeyAsync(Guid id, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);
        return new AppointmentKeyDto(p.AppointmentKey);
    }

    public async Task<AppointmentKeyDto> GenerateAppointmentKeyAsync(Guid id, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        // 24 bayt rastgele → 32 karakterlik URL-güvenli anahtar; tahmin edilemez.
        var key = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(24))
            .Replace('+', '-').Replace('/', '_');
        p.SetAppointmentKey(key);
        uow.Participants.Update(p);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Participant",
            EntityId = p.Id,
            Module = "Participants",
            Description = $"Randevu anahtarı üretildi: {p.FullName}",
        }, ct);

        return new AppointmentKeyDto(key);
    }

    public async Task<AppointmentKeyDto> GetOwnAppointmentKeyAsync(Guid participantId, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        return new AppointmentKeyDto(p.AppointmentKey);
    }

    public async Task RevokeAppointmentKeyAsync(Guid id, CancellationToken ct)
    {
        var p = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);
        if (p.AppointmentKey is null) return;

        p.SetAppointmentKey(null);
        uow.Participants.Update(p);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Participant",
            EntityId = p.Id,
            Module = "Participants",
            Description = $"Randevu anahtarı kaldırıldı: {p.FullName}",
        }, ct);
    }

    public async Task<List<ParticipantSurveyResponseDto>> GetSurveyHistoryAsync(Guid id, CancellationToken ct)
    {
        _ = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        // Anonim anketlerde ParticipantId hiç kaydedilmez (bkz. ISurveyRepository yorumu) —
        // bu kişiye ait aramada sadece isimli yanıtlar bulunur, mahremiyet ihlali oluşmaz.
        var responses = await uow.Surveys.GetResponsesForParticipantAsync(id, ct);
        if (responses.Count == 0) return [];

        var surveyIds = responses.Select(r => r.SurveyId).Distinct().ToList();
        // FindIncludingDeletedAsync kullanılıyor: anket şablonu sonradan silinmiş olsa bile
        // (Survey.HasQueryFilter(!IsDeleted)) katılımcının o anda verdiği gerçek cevap kaybolmaz —
        // canlı veriyle doğrulandı: bu düzeltme olmadan gerçek bir katılımcının 2 cevabından biri
        // (silinmiş "Hizmet Memnuniyeti Anketi (Demo)" şablonuna ait) sessizce kayboluyordu.
        var surveys = (await uow.Surveys.FindIncludingDeletedAsync(s => surveyIds.Contains(s.Id), ct)).ToDictionary(s => s.Id);

        var result = new List<ParticipantSurveyResponseDto>();
        foreach (var r in responses)
        {
            if (!surveys.TryGetValue(r.SurveyId, out var survey)) continue;

            var questions = await uow.Surveys.GetQuestionsAsync(r.SurveyId, ct);
            var questionsById = questions.ToDictionary(q => q.Id);

            var rawAnswers = Nexora.Application.Features.Surveys.SurveyAnswerFormatting.ParseAnswersJson(r.AnswersJson);
            var answers = rawAnswers.Select(a =>
            {
                questionsById.TryGetValue(a.QuestionId, out var question);
                return new ParticipantSurveyAnswerDto(
                    a.QuestionId,
                    question?.Question ?? "(Soru silinmiş)",
                    question?.Type ?? "text",
                    a.Answer,
                    Nexora.Application.Features.Surveys.SurveyAnswerFormatting.FormatAnswerDisplay(question, a.Answer));
            }).ToList();

            result.Add(new ParticipantSurveyResponseDto(
                r.Id,
                r.SurveyId,
                survey.Title,
                survey.Category,
                r.SubmittedAt,
                answers.Count,
                questions.Count,
                answers));
        }

        return result.OrderByDescending(r => r.SubmittedAt).ToList();
    }

    public async Task<PagedResult<ParticipantNotificationDto>> GetNotificationsAsync(Guid id, ParticipantNotificationListParams p, CancellationToken ct)
    {
        _ = await uow.Participants.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
        await EnsureParticipantInScopeAsync(id, ct);

        var paged = await uow.Notifications.GetPagedByRecipientAsync(id, p.PageResolved, p.LimitResolved, ct);

        return new PagedResult<ParticipantNotificationDto>
        {
            Items = paged.Items.Select(n => new ParticipantNotificationDto(
                n.Id, n.Title, n.Body, n.Type, n.IsRead, n.CreatedAt,
                n.ReferenceType, n.ReferenceId, n.FacilityName, n.SessionInfo, n.StatusInfo)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    private async Task<ParticipantDto> BuildDtoAsync(Participant p, CancellationToken ct)
    {
        var ids = new List<Guid> { p.Id };
        var childCounts = await uow.Participants.CountChildrenForAsync(ids, ct);
        var guardianCounts = await uow.Participants.CountGuardiansForAsync(ids, ct);
        // Kullanıcı bulgusu (2026-08-09): bkz. GetPagedAsync üzerindeki not — EventCount
        // burada da (tekil katılımcı DTO'su döndüren güncelleme/durum değişikliği uç
        // noktalarında) tutarlı olsun diye hesaplanıyor, sabit 0 bırakılmıyor.
        var eventCounts = await uow.EventApplications.CountForParticipantsAsync(ids, ct);
        var activityCounts = await uow.Participants.CountActivitiesForAsync(
            new Dictionary<Guid, string> { [p.Id] = p.Tckn }, ct);
        return MapDto(p, childCounts.GetValueOrDefault(p.Id), guardianCounts.GetValueOrDefault(p.Id), MaskEnabled(),
            activityCounts.GetValueOrDefault(p.Id), eventCounts.GetValueOrDefault(p.Id));
    }

    private bool MaskEnabled() => participantSettings.CurrentValue.MaskIdentity;

    private static ParticipantDto MapDto(Participant p, int childrenCount, int guardianCount, bool mask, int activityCount = 0, int eventCount = 0)
        => new(
            p.Id,
            mask ? MaskName(p.FullName) : p.FullName,
            mask ? MaskTckn(p.Tckn) : p.Tckn,
            p.PhotoUrl,
            p.BirthDate,
            Age(p.BirthDate),
            p.Gender.ToString(),
            mask ? IdentityMask.MaskAddress(p.Address) : p.Address,
            p.City,
            p.District,
            p.Neighborhood,
            p.IlceKodu,
            mask ? IdentityMask.MaskEmail(p.Email) : p.Email,
            mask ? IdentityMask.MaskPhoneStrict(p.Phone) : p.Phone,
            p.IsMinor,
            mask ? IdentityMask.MaskPhoneStrict(p.GuardianPhone) : p.GuardianPhone,
            mask ? IdentityMask.MaskEmail(p.GuardianEmail) : p.GuardianEmail,
            childrenCount,
            guardianCount,
            // Kullanıcı bulgusu (2026-08-09): burada önceden sabit 0 geçiliyordu — katılımcı
            // listesindeki "Etkinlik" sütunu bu yüzden her zaman 0 gösteriyordu, gerçek etkinlik
            // başvuru sayısından tamamen bağımsızdı. Artık çağıran taraf (GetPagedAsync/
            // BuildDtoAsync) gerçek sayıyı EventApplications.CountForParticipantsAsync ile
            // hesaplayıp buraya geçiriyor.
            eventCount,
            DtoStatus(p),
            p.BlockReason,
            p.IsVerified,
            p.IsFirstLogin,
            p.RegisteredAt,
            p.LastEventName,
            p.CreatedAt,
            activityCount,
            p.IsLocked,
            p.LockedUntil,
            p.FailedLoginCount);

    private static string DtoStatus(Participant p) => p.IsDeleted ? "Deleted" : p.Status.ToString();

    private static string MaskName(string name) => IdentityMask.MaskName(name);

    private static string MaskTckn(string tckn) => IdentityMask.MaskTckn(tckn);

    private static int Age(DateTime birth)
    {
        var today = DateTime.UtcNow;
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age)) age--;
        return age;
    }

    private static string Prefix(string tckn) => tckn.Length >= 3 ? tckn[..3] : "***";

    private static bool PhoneEquals(string? a, string? b) => (a ?? "") == (b ?? "");
}
