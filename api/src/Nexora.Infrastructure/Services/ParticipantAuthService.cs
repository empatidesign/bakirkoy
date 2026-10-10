using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Nexora.Application.Features.ParticipantAuth.Dtos;
using Nexora.Application.Common;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Configuration;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.ParticipantAuth;
using Nexora.Domain.Entities.Loyalty;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Security;

namespace Nexora.Infrastructure.Services;

public class ParticipantAuthService(
    IUnitOfWork uow,
    IJwtService jwtService,
    IOtpService otpService,
    IRedisService redis,
    INviService nvi,
    IConfiguration config,
    IOptionsMonitor<ParticipantSettings> participantSettings,
    IFileStorageService fileStorage,
    IAuditService audit,
    IActivityLogger log,
    ICurrentUser currentUser) : IParticipantAuthService
{
    private const string PasswordChangedDescription = "Vatandaş şifresini değiştirdi";
    private const string PasswordResetDescription = "Vatandaş şifresi sıfırlandı";

    private int PasswordChangeLimit
        => config.GetValue("PasswordPolicy:ChangeLimit", 2);

    private int PasswordChangeWindowHours
        => config.GetValue("PasswordPolicy:ChangeWindowHours", 24);

    private TimeSpan RefreshTokenTtl
        => TimeSpan.FromDays(config.GetValue("TokenSettings:Mobile:RefreshTokenDays", 30));

    // Kullanıcı isteği (2026-09-24): mobilde oturum, kullanıcı çıkış yapmadığı sürece sürer.
    // Mobil cihazdan açılan oturumun yenileme anahtarı süresizdir (TTL yok); yalnızca çıkış,
    // şifre değişimi, "oturumu sonlandır" veya admin işlemiyle silinir. Web oturumları eskisi gibi süreli.
    private TimeSpan? RefreshTtlFor(string deviceType)
        => deviceType == "mobile" && config.GetValue("TokenSettings:Mobile:PersistentSession", true)
            ? null
            : RefreshTokenTtl;

    private int AccessTokenMinutes
        => config.GetValue("JwtSettings:AccessTokenMinutes", 60);

    private TimeSpan PendingRegistrationTtl
        => TimeSpan.FromMinutes(config.GetValue("OtpSettings:PendingRegistrationMinutes", 15));

    // Kullanıcı isteği (2026-09-21): kilit süresi botlar tarafından tahmin
    // edilemesin diye taban süreye (4 dk) her denemede kriptografik olarak
    // yeniden üretilen 0-60 sn jitter eklenir (bkz. LockoutJitter, AuthService.cs'teki
    // aynı desen). Gerçek kilit süresi gözlemciden gözlemciye 4-5 dakika arasında
    // farklı bir noktada biter.
    private int CitizenLockoutMinutes
        => config.GetValue("LockoutSettings:LockoutMinutes", 4);

    private int CitizenLockoutJitterMaxSeconds
        => config.GetValue("LockoutSettings:JitterMaxSeconds", 60);

    public async Task<CitizenLoginResponseDto> LoginAsync(CitizenLoginRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(LoginAsync), new { });

        var participant = await ResolveByIdentifierAsync(request.Identifier, ct);

        // 2026-07-30 denetiminde eklendi (P1): önceden vatandaş girişinde hesap bazlı
        // brute-force kilidi hiç yoktu (yalnızca IP bazlı rate-limit vardı, ki bu XFF
        // spoofing ile atlatılabiliyordu — ayrıca düzeltildi). AdminUser'daki aynı desen.
        // Gerçek kalan süre (LockedUntil - UtcNow) burada hesaplanıp mesaja gömülür —
        // jitter'lı kilit süresi (bkz. CitizenLockoutMinutes/CitizenLockoutJitterMaxSeconds)
        // her hesapta farklı olduğu için sabit bir metin yazılamaz.
        if (participant is not null && participant.IsLocked)
            throw new ConflictException(BuildLockedMessage(participant.LockedUntil), "ACCOUNT_LOCKED");

        if (participant is not null && IsUnclaimedWithoutContact(participant))
            throw new ConflictException(ActivationRequiredMessage, "ACTIVATION_REQUIRED");

        if (!Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.Password, participant?.PasswordHash) || participant is null)
        {
            if (participant is not null)
            {
                participant.RecordFailedLogin(
                    config.GetValue("LockoutSettings:MaxFailedAttempts", 5),
                    CitizenLockoutMinutes,
                    LockoutJitter.NextSeconds(CitizenLockoutJitterMaxSeconds));
                uow.Participants.Update(participant);
                await uow.SaveChangesAsync(ct);

                // Eşiğe TAM bu denemede ulaşılmışsa hemen ACCOUNT_LOCKED dönülür (bkz.
                // AuthService.cs'teki aynı düzeltme, 2026-09-21 test bulgusu).
                if (participant.IsLocked)
                    throw new ConflictException(BuildLockedMessage(participant.LockedUntil), "ACCOUNT_LOCKED");
            }
            // SORUN (2026-09-23, kullanıcı bulgusu): Bu tek mesaj iki TAMAMEN FARKLI
            // durumu gizliyor — (a) kayıt hiç bulunamadı, (b) kayıt bulundu ama şifre
            // eşleşmedi. Kullanıcıya gösterilen metin bilinçli olarak aynı kalır
            // (hesap sayımı/enumeration saldırısını önler), ancak sunucu günlüğüne
            // ayırt edici bir iz düşmediği için canlı vakalar teşhis edilemiyordu.
            // Not: Tckn/telefon gibi kimlik verisi ASLA loglanmaz, yalnızca hangi
            // dalın çalıştığı ve bulunan kaydın Id'si yazılır.
            log.LogStepResult(nameof(LoginAsync), new
            {
                Outcome = "INVALID_CREDENTIALS",
                Reason = participant is null ? "ParticipantNotFound" : "PasswordMismatch",
                ParticipantId = participant?.Id,
                IdentifierKind = IdentifierKindOf(request.Identifier)
            });
            throw new ConflictException("Telefon/T.C. kimlik numarası veya şifre hatalı.", "INVALID_CREDENTIALS");
        }

        participant.RecordSuccessfulLogin();
        uow.Participants.Update(participant);
        await uow.SaveChangesAsync(ct);

        EnsureLoginAllowed(participant);

        var (channel, target, masked) = ResolveOtpChallenge(participant);

        if (!await otpService.IsOnCooldownAsync(participant.Id, OtpPurpose.TwoFactor, ct))
            await otpService.SendAsync(participant.Id, target, channel, OtpPurpose.TwoFactor, ct);

        // 2026-09-22 bulgusu (PasswordFingerprint.cs): OTP doğrulanırken şifrenin
        // bu andan sonra değişmediğini kontrol edebilmek için parmak izi gömülür.
        var otpSessionToken = jwtService.GeneratePendingOtpToken(participant.Id, PasswordFingerprint.Compute(participant.PasswordHash));
        log.LogStepResult("OtpRequired", new { participant.Id, channel });

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Login,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = "Vatandaş giriş OTP gönderildi",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);

        return new CitizenLoginResponseDto(true, otpSessionToken, channel, masked, otpService.ResendCooldownSeconds);
    }

    public async Task<CitizenTokenPairDto> VerifyOtpAsync(CitizenVerifyOtpRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(VerifyOtpAsync), new { });

        var pending = jwtService.ValidatePendingOtpToken(request.OtpSessionToken)
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "OTP_SESSION_EXPIRED");
        var subjectId = pending.UserId;

        var pendingRegistration = await redis.GetAsync<PendingRegistration>(PendingRegKey(subjectId), ct);
        if (pendingRegistration is not null)
            return await CompleteRegistrationAsync(subjectId, pendingRegistration, request, ct);

        var participantId = subjectId;
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        // 2026-09-22 bulgusu: şifre bu OTP oturumu üretildikten SONRA (ör. paralel
        // "şifremi unuttum" akışıyla) değiştiyse, eski şifreyle açılmış bu OTP
        // oturumu artık geçersizdir — kullanıcı baştan giriş yapmalı. Bkz.
        // PasswordFingerprint.cs üstündeki bulgu notu.
        if (PasswordFingerprint.Compute(participant.PasswordHash) != pending.PwdFingerprint)
            throw new ConflictException("Şifreniz değiştirildi. Lütfen yeni şifrenizle tekrar giriş yapın.", "OTP_SESSION_EXPIRED");

        if (participant.Status == ParticipantStatus.Blocked)
            throw new ConflictException(
                string.IsNullOrWhiteSpace(participant.BlockReason)
                    ? "Hesabınız engellenmiştir."
                    : $"Hesabınız engellenmiştir. {participant.BlockReason}",
                "ACCOUNT_BLOCKED");
        if (participant.Status == ParticipantStatus.Passive && participant.IsVerified)
            throw new ConflictException("Hesabınız pasif durumda. Lütfen belediye ile iletişime geçin.", "ACCOUNT_PASSIVE");

        await otpService.VerifyAsync(participantId, OtpPurpose.TwoFactor, request.Code, ct);

        // Giriş ekranındaki izinler OTP doğrulamasıyla aynı sunucu akışında katılımcı
        // kaydına yazılır. Böylece istemcinin sonradan atacağı ve başarısızlığı gözden
        // kaçabilecek ikinci bir isteğe bağlı kalınmaz.
        var consentChanged = false;
        if (request.KvkkAccepted)
            consentChanged |= participant.AcceptKvkk();
        if (request.NotificationConsentAccepted)
            consentChanged |= participant.AcceptNotificationConsent();

        var isRegistrationActivation = participant.Status == ParticipantStatus.Passive && !participant.IsVerified;
        var markedVerified = false;
        if (!isRegistrationActivation && !participant.IsVerified)
        {
            participant.MarkVerified();
            markedVerified = true;
        }
        if (isRegistrationActivation)
        {
            participant.CompleteOtpActivation();
            uow.Participants.Update(participant);
            await GrantWelcomeBonusAsync(participant.Id, ct);
            await uow.SaveChangesAsync(ct);
        }
        else if (consentChanged || markedVerified)
        {
            uow.Participants.Update(participant);
            await uow.SaveChangesAsync(ct);
        }

        // Kullanıcı isteği (2026-09-22): eski sistemden aktarılan üyeler "şifremi unuttum"
        // ile ilk kez giriş yaptığında (bkz. ResetPasswordAsync/ChangeInitialPasswordAsync'in
        // set ettiği NviResyncPending bayrağı) adres bilgisi (değişmiş olabilir) ve çocuk
        // listesi (18 yaş altı çocukları TCKN ile eşleştirilip sisteme kaydedilir/bağlanır)
        // otomatik olarak NVI'den senkronize edilir. Giriş akışını bloklamaması için hata
        // yutulur — senkronizasyon başarısız olursa bayrak temizlenmez, bir sonraki girişte
        // tekrar denenir; kişi ayrıca "NVİ'den Yenile" ile manuel de tetikleyebilir.
        if (participant.NviResyncPending)
        {
            try
            {
                await SyncNviOnLoginAsync(participant, ct);
            }
            catch (Exception ex)
            {
                log.LogStepResult("NviResyncOnLoginFailed", new { participant.Id, ex.Message });
            }
        }

        var pair = await IssueTokensAsync(participant, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = isRegistrationActivation ? AuditAction.StatusChange : AuditAction.Login,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = isRegistrationActivation ? "Vatandaş kaydı OTP ile doğrulandı ve aktifleştirildi" : "Vatandaş girişi yapıldı",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);

        return pair;
    }

    public async Task<CitizenOtpChallengeDto> ResendOtpAsync(CitizenResendOtpRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(ResendOtpAsync), new { });

        var subjectId = jwtService.ValidatePendingOtpToken(request.OtpSessionToken)?.UserId
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "OTP_SESSION_EXPIRED");

        var pendingRegistration = await redis.GetAsync<PendingRegistration>(PendingRegKey(subjectId), ct);
        if (pendingRegistration is not null)
        {
            var registrationCooldownId = TcknCooldownId(pendingRegistration.Tckn);
            await otpService.EnsureCanResendAsync(registrationCooldownId, OtpPurpose.TwoFactor, ct);
            await otpService.SendAsync(subjectId, pendingRegistration.Target, pendingRegistration.Channel, OtpPurpose.TwoFactor, ct);
            await otpService.StartCooldownAsync(registrationCooldownId, OtpPurpose.TwoFactor, ct);
            return new CitizenOtpChallengeDto(pendingRegistration.Channel, pendingRegistration.Masked, otpService.ResendCooldownSeconds);
        }

        var participant = await uow.Participants.GetByIdAsync(subjectId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        await otpService.EnsureCanResendAsync(subjectId, OtpPurpose.TwoFactor, ct);

        var (channel, target, masked) = ResolveOtpChallenge(participant);

        await otpService.SendAsync(subjectId, target, channel, OtpPurpose.TwoFactor, ct);

        return new CitizenOtpChallengeDto(channel, masked, otpService.ResendCooldownSeconds);
    }

    public async Task<CitizenTokenPairDto> RefreshAsync(CitizenRefreshRequest request, CancellationToken ct)
    {
        var key = RefreshKey(request.RefreshToken);
        var stored = await redis.GetAsync<RefreshPayload>(key, ct)
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");

        var participant = await uow.Participants.GetByIdAsync(stored.ParticipantId, ct)
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");

        EnsureLoginAllowed(participant);

        await redis.RemoveAsync(key, ct);
        await redis.SetRemoveAsync(SessionsKey(stored.ParticipantId), request.RefreshToken, ct);

        if (stored.SecurityVersion != participant.SecurityVersion)
            throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");

        return await IssueTokensAsync(participant, ct, stored.SessionId);
    }

    public async Task<CitizenMeResponseDto> GetMeAsync(Guid participantId, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var guardianLink = (await uow.Participants.GetGuardianLinksAsync(participantId, ct))
            .FirstOrDefault(link => link.Guardian is not null);

        var guardian = guardianLink?.Guardian is null
            ? null
            : new CitizenGuardianDto(
                guardianLink.Guardian.Id,
                MaskCitizenEnabled()
                    ? IdentityMask.MaskName(guardianLink.Guardian.FullName)
                    : guardianLink.Guardian.FullName,
                guardianLink.Guardian.PhotoUrl,
                guardianLink.Relation);

        return new CitizenMeResponseDto(ToDto(participant, maskName: false), BuildSessionConfig(), guardian);
    }

    public async Task<List<CitizenChildDto>> GetChildrenAsync(Guid participantId, CancellationToken ct)
    {
        var children = await uow.Participants.GetChildrenAsync(participantId, ct);

        if (children.Count == 0)
        {
            var guardianId = (await uow.Participants.GetGuardianLinksAsync(participantId, ct))
                .Select(link => link.GuardianId)
                .FirstOrDefault();

            if (guardianId != Guid.Empty)
                children = await uow.Participants.GetChildrenAsync(guardianId, ct);
        }

        return children
            .Select(child => new CitizenChildDto(
                child.Id,
                child.FullName,
                child.Tckn,
                child.BirthDate,
                Age(child.BirthDate),
                child.Gender,
                child.IsMinor,
                child.Status,
                child.PhotoUrl))
            .ToList();
    }

    public async Task<CitizenFamilyNviPreviewDto> PreviewFamilyFromNviAsync(Guid participantId, CancellationToken ct)
    {
        log.LogStep(nameof(PreviewFamilyFromNviAsync), new { ParticipantId = participantId });

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var nviRes = await nvi.GetPersonAndChildrenAsync(participant.Tckn, participant.BirthDate, 18, ct);
        if (!nviRes.Success || nviRes.Person is null)
            throw new NotFoundException("NVI'den kişi bilgisi alınamadı.", "NVI_NOT_FOUND");

        var existingChildren = await uow.Participants.GetChildrenAsync(participantId, ct);
        var existingTckns = existingChildren.Select(c => c.Tckn).ToHashSet();

        var person = nviRes.Person;
        var personName = $"{person.FirstName} {person.LastName}".Trim();

        // Mobil QA bulgusu (2026-09-22, madde 123): "Aile üyeleri ekleme/listeleme doğru
        // çalışıyor mu? → Hayır". Kök neden: bu uç, vatandaşın KENDİ ailesini gösterirken
        // MaskCitizenIdentity (varsayılan true) ayarına uyup ad-soyadları "A*** Y***" gibi
        // maskeliyordu — kullanıcı listeden kimi ekleyeceğini ayırt edemiyordu, ekran fiilen
        // kullanılamaz haldeydi. Bu ayar vatandaşın kimliğini YÖNETİCİ/personel gözünden
        // korumak içindir, kişinin kendisinden değil: nitekim kardeş metot GetChildrenAsync
        // (kayıtlı aile üyeleri listesi) hiç maskelemiyor ve GetMeAsync kendi kaydını
        // maskName:false ile dönüyor. Kendi verisini kendine maskelemek bu konvansiyona
        // aykırıydı; artık kendi ailesi açık gösteriliyor.
        return new CitizenFamilyNviPreviewDto(
            person.Tckn,
            personName,
            nviRes.Children.Select(c =>
            {
                var childName = $"{c.FirstName} {c.LastName}".Trim();
                return new CitizenFamilyNviChildDto(
                    c.Tckn,
                    childName,
                    c.BirthDate,
                    c.Gender.ToString(),
                    c.Address,
                    existingTckns.Contains(c.Tckn));
            }).ToList());
    }

    public async Task<CitizenFamilyConfirmResultDto> ConfirmFamilyFromNviAsync(
        Guid participantId, CitizenFamilyConfirmRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(ConfirmFamilyFromNviAsync), new { ParticipantId = participantId, Count = request.SelectedTckns?.Count ?? 0 });

        if (request.SelectedTckns is null or { Count: 0 })
            throw new ConflictException("En az bir kişi seçmelisiniz.", "NO_SELECTION");

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var nviRes = await nvi.GetPersonAndChildrenAsync(participant.Tckn, participant.BirthDate, 18, ct);
        if (!nviRes.Success || nviRes.Person is null)
            throw new NotFoundException("NVI'den kişi bilgisi alınamadı.", "NVI_NOT_FOUND");

        var selected = new HashSet<string>(request.SelectedTckns);
        var validChildTckns = nviRes.Children.Select(c => c.Tckn).ToHashSet();
        if (selected.Any(t => !validChildTckns.Contains(t)))
            throw new ConflictException("Seçilen kişilerden bazıları doğrulanan aile listenizde bulunamadı. Lütfen tekrar deneyin.", "INVALID_FAMILY_SELECTION");

        var matchedChildren = nviRes.Children.Where(c => selected.Contains(c.Tckn)).ToList();
        if (matchedChildren.Count == 0)
            throw new ConflictException("Seçilen kişiler NVI sonucunda bulunamadı.", "SELECTION_NOT_FOUND");

        var length = config.GetValue<int>("PasswordPolicy:GeneratedLength");
        var useMock = config.GetValue("SmsSettings:UseMockMode", false);

        var existingChildren = await uow.Participants.GetChildrenAsync(participantId, ct);
        var alreadyLinkedTckns = existingChildren.Select(c => c.Tckn).ToHashSet();

        var newlyAdded = 0;
        var alreadyExisted = 0;

        await uow.BeginTransactionAsync(ct);
        try
        {
            foreach (var child in matchedChildren)
            {
                if (alreadyLinkedTckns.Contains(child.Tckn))
                {
                    alreadyExisted++;
                    continue;
                }

                var existing = await uow.Participants.GetByTcknAsync(child.Tckn, ct);
                Guid childId;
                if (existing is not null)
                {
                    childId = existing.Id;
                }
                else
                {
                    var childHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(PasswordGenerator.Generate(length, useMock));
                    var childEntity = Participant.Create(
                        tckn: child.Tckn,
                        fullName: $"{child.FirstName} {child.LastName}".Trim(),
                        birthDate: child.BirthDate,
                        gender: child.Gender,
                        isMinor: true,
                        passwordHash: childHash,
                        email: null,
                        phone: null,
                        guardianPhone: participant.Phone,
                        guardianEmail: participant.Email,
                        address: child.Address);
                    childEntity.CompleteInitialPassword(childHash);
                    childEntity.MarkVerified();
                    await uow.Participants.AddAsync(childEntity, ct);
                    childId = childEntity.Id;
                }

                await uow.ParticipantGuardians.AddAsync(ParticipantGuardian.Create(participant.Id, childId, "Çocuk"), ct);
                newlyAdded++;
            }

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        var updatedChildren = await GetChildrenAsync(participantId, ct);

        return new CitizenFamilyConfirmResultDto(
            matchedChildren.Count,
            newlyAdded,
            alreadyExisted,
            updatedChildren);
    }

    public async Task<CitizenTokenPairDto> SwitchToChildAsync(Guid parentId, Guid childId, CancellationToken ct)
    {
        var children = await uow.Participants.GetChildrenAsync(parentId, ct);

        if (children.Count == 0)
        {
            var guardianId = (await uow.Participants.GetGuardianLinksAsync(parentId, ct))
                .Select(link => link.GuardianId)
                .FirstOrDefault();

            if (guardianId != Guid.Empty)
                children = await uow.Participants.GetChildrenAsync(guardianId, ct);
        }

        var child = children.FirstOrDefault(c => c.Id == childId)
            ?? throw new ForbiddenException("Bu hesaba erişim yetkiniz yok.", "NOT_GUARDIAN");

        EnsureLoginAllowed(child);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Login,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = child.Id,
            Module = "ParticipantAuth",
            Description = $"Veli çocuk hesabına geçti: {child.FullName}",
        }, ct);

        return await IssueTokensAsync(child, ct);
    }

    public async Task LogoutAsync(Guid participantId, CancellationToken ct)
    {
        var sessionId = currentUser.SessionId;
        if (sessionId != null)
        {
            var tokens = await redis.SetMembersAsync(SessionsKey(participantId), ct);
            foreach (var token in tokens)
            {
                var payload = await redis.GetAsync<RefreshPayload>(RefreshKey(token), ct);
                if (payload?.SessionId.ToString() == sessionId)
                {
                    await redis.RemoveAsync(RefreshKey(token), ct);
                    await redis.SetRemoveAsync(SessionsKey(participantId), token, ct);
                    await BlockSessionAsync(sessionId, ct);
                    break;
                }
            }
        }
        else
        {
            await InvalidateAllSessionsAsync(participantId, ct);
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Logout,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participantId,
            Module = "ParticipantAuth",
            Description = "Vatandaş çıkışı yapıldı",
        }, ct);
    }

    public async Task<List<CitizenSessionDto>> GetSessionsAsync(Guid participantId, CancellationToken ct)
    {
        var currentSessionId = currentUser.SessionId;
        var tokens = await redis.SetMembersAsync(SessionsKey(participantId), ct);
        var sessions = new List<CitizenSessionDto>();

        foreach (var token in tokens)
        {
            var payload = await redis.GetAsync<RefreshPayload>(RefreshKey(token), ct);
            if (payload is null || payload.SessionId == Guid.Empty) continue;
            sessions.Add(new CitizenSessionDto(
                payload.SessionId.ToString(),
                payload.DeviceType,
                payload.IpAddress,
                DateTimeOffset.FromUnixTimeSeconds(payload.CreatedAt).UtcDateTime,
                payload.SessionId.ToString() == currentSessionId));
        }

        return [.. sessions.OrderByDescending(s => s.CreatedAt)];
    }

    public async Task RevokeSessionAsync(Guid participantId, string sessionId, CancellationToken ct)
    {
        if (currentUser.SessionId == sessionId)
            throw new ConflictException("Mevcut oturumunuzu bu şekilde sonlandıramazsınız. Çıkış yapın.", "CANNOT_REVOKE_CURRENT");

        var tokens = await redis.SetMembersAsync(SessionsKey(participantId), ct);
        foreach (var token in tokens)
        {
            var payload = await redis.GetAsync<RefreshPayload>(RefreshKey(token), ct);
            if (payload?.SessionId.ToString() != sessionId) continue;
            await redis.RemoveAsync(RefreshKey(token), ct);
            await redis.SetRemoveAsync(SessionsKey(participantId), token, ct);
            await BlockSessionAsync(sessionId, ct);
            return;
        }

        throw new NotFoundException("Oturum bulunamadı.", "SESSION_NOT_FOUND");
    }

    public async Task<string> GenerateBypassCodeAsync(Guid participantId, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Vatandaş bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var code = jwtService.GenerateRefreshToken();
        await redis.SetAsync($"bypass:code:{code}", participantId.ToString(), TimeSpan.FromSeconds(30), ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Login,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "Participants",
            Description = $"Admin bypass kodu üretildi: {participant.FullName}",
        }, ct);

        return code;
    }

    public async Task<CitizenBypassTokenDto> ExchangeBypassCodeAsync(string code, CancellationToken ct)
    {
        var idStr = await redis.GetDeleteAsync<string>($"bypass:code:{code}", ct)
            ?? throw new NotFoundException("Geçersiz veya süresi dolmuş bypass kodu.", "BYPASS_CODE_INVALID");

        if (!Guid.TryParse(idStr, out var participantId))
            throw new NotFoundException("Geçersiz bypass kodu.", "BYPASS_CODE_INVALID");

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Vatandaş bulunamadı.", "PARTICIPANT_NOT_FOUND");

        await InvalidateAllSessionsAsync(participantId, ct);

        var sessionId = Guid.NewGuid();
        var accessToken = jwtService.GenerateCitizenAccessToken(participant, sessionId);
        var refreshToken = jwtService.GenerateRefreshToken();

        var payload = new RefreshPayload(participant.Id, sessionId, "web", currentUser.IpAddress, "bypass/admin", DateTimeOffset.UtcNow.ToUnixTimeSeconds(), participant.SecurityVersion);
        await redis.SetAsync(RefreshKey(refreshToken), payload, RefreshTokenTtl, ct);
        await redis.SetAddAsync(SessionsKey(participant.Id), refreshToken, RefreshTokenTtl, ct);

        return new CitizenBypassTokenDto(accessToken, refreshToken, DateTime.UtcNow.AddMinutes(AccessTokenMinutes), ToDto(participant), BuildSessionConfig());
    }

    public async Task<string> GenerateHandoffCodeAsync(Guid participantId, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var code = jwtService.GenerateRefreshToken();
        await redis.SetAsync(HandoffKey(code), participant.Id.ToString(), HandoffCodeTtl, ct);

        return code;
    }

    public async Task<CitizenBypassTokenDto> ExchangeHandoffCodeAsync(string code, CancellationToken ct)
    {
        var idStr = await redis.GetDeleteAsync<string>(HandoffKey(code), ct)
            ?? throw new NotFoundException("Bağlantının süresi doldu. Lütfen uygulamayı yeniden açın.", "HANDOFF_CODE_INVALID");

        if (!Guid.TryParse(idStr, out var participantId))
            throw new NotFoundException("Bağlantı geçersiz. Lütfen uygulamayı yeniden açın.", "HANDOFF_CODE_INVALID");

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        EnsureLoginAllowed(participant);

        var sessionId = Guid.NewGuid();
        var accessToken = jwtService.GenerateCitizenAccessToken(participant, sessionId);
        var refreshToken = jwtService.GenerateRefreshToken();

        var payload = new RefreshPayload(
            participant.Id,
            sessionId,
            "web",
            currentUser.IpAddress,
            "handoff/webview",
            DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            participant.SecurityVersion);

        await redis.SetAsync(RefreshKey(refreshToken), payload, RefreshTokenTtl, ct);
        await redis.SetAddAsync(SessionsKey(participant.Id), refreshToken, RefreshTokenTtl, ct);

        return new CitizenBypassTokenDto(
            accessToken,
            refreshToken,
            DateTime.UtcNow.AddMinutes(AccessTokenMinutes),
            ToDto(participant),
            BuildSessionConfig());
    }

    public async Task<CitizenTokenPairDto> ChangeInitialPasswordAsync(Guid participantId, CitizenChangeInitialPasswordRequest request, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (!participant.MustChangePassword)
            throw new ConflictException("Şifre zaten belirlenmiş.", "PASSWORD_ALREADY_SET");

        if (Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.NewPassword, participant.PasswordHash))
            throw new ConflictException("Yeni şifreniz geçici şifrenizle aynı olamaz.", "SAME_AS_CURRENT_PASSWORD");

        participant.CompleteInitialPassword(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.NewPassword));
        await uow.SaveChangesAsync(ct);

        // Kullanıcı isteği (2026-09-23): eski sistemden aktarılan üyelerin NVI adres/çocuk
        // bilgisi kayıt anında hiç çekilmemiş olabilir. Önceki sürüm burada yalnızca
        // MarkNviResyncPending() ile bayrak set edip senkronizasyonu BİR SONRAKİ girişe
        // (VerifyOtpAsync) erteliyordu — ama bu metot zaten kimliği doğrulanmış, OTP'den
        // geçmiş bir oturumda çalışıyor (first-login ekranı, token zaten mevcut). Kullanıcı
        // şifreyi belirler belirlemez doğrudan ana sayfaya yönlendiriliyor (bkz.
        // citizen-portal FirstLoginPasswordPage.tsx: authService.changeInitialPassword →
        // navigate('/')), bir sonraki VerifyOtpAsync çağrısı ancak GELECEKTEKİ bir girişte
        // olur. Sonuç: ilk oturumda adres/çocuk hiç senkronize edilmeden ana sayfaya
        // geçiliyordu. Artık senkronizasyon burada, hemen, aynı istekte yapılır — giriş
        // akışını bloklamaması için hata yutulur (best-effort, aynı VerifyOtpAsync deseni).
        // SyncNviOnLoginAsync false dönerse (NVI kimlik bilgileri henüz .env'e girilmemiş
        // veya sorgu sonuçsuz) MarkNviResyncPending() ile bayrak set edilir ki bir sonraki
        // girişte (VerifyOtpAsync) veya NVI kimlik bilgileri girildikten sonra tekrar
        // denensin — aksi halde bu katılımcı için senkronizasyon sonsuza dek denenmezdi.
        try
        {
            if (!await SyncNviOnLoginAsync(participant, ct))
            {
                participant.MarkNviResyncPending();
                await uow.SaveChangesAsync(ct);
            }
        }
        catch (Exception ex)
        {
            log.LogStepResult("NviResyncOnFirstLoginFailed", new { participant.Id, ex.Message });
            participant.MarkNviResyncPending();
            await uow.SaveChangesAsync(ct);
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordChange,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = "İlk giriş şifresi belirlendi",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);

        await InvalidateAllSessionsAsync(participant.Id, ct);
        return await IssueTokensAsync(participant, ct);
    }

    public async Task ChangePasswordAsync(Guid participantId, CitizenChangePasswordRequest request, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (!Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.CurrentPassword, participant.PasswordHash))
            throw new ConflictException("Mevcut şifreniz hatalı.", "INVALID_CURRENT_PASSWORD");

        if (Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.NewPassword, participant.PasswordHash))
            throw new ConflictException("Yeni şifreniz mevcut şifrenizle aynı olamaz.", "SAME_AS_CURRENT_PASSWORD");

        await EnsurePasswordChangeAllowedAsync(participant.Id, ct);

        participant.CompleteInitialPassword(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.NewPassword));
        await uow.SaveChangesAsync(ct);

        await TerminateAllSessionsAsync(participant.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordChange,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = PasswordChangedDescription,
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);
    }

    // IDN-11 düzeltmesi (2026-09-01): eski UpdateContactAsync tek istekte, hiçbir
    // OTP doğrulaması olmadan telefon/e-posta değişikliğini uyguluyordu (hesap
    // ele geçirme riski — saldırgan çalınmış bir oturum tokenıyla mağdurun
    // telefonunu kendi numarasına çevirip parola sıfırlama/2FA'yı ele geçirebilirdi).
    // Artık iki adımlı: RequestContactChangeAsync yeni telefon/e-postaya OTP
    // gönderir (login/verify-otp akışındaki OtpService deseniyle aynı), değişiklik
    // yalnızca ConfirmContactChangeAsync doğru OTP ile çağrıldığında uygulanır.
    public async Task<CitizenOtpChallengeDto> RequestContactChangeAsync(Guid participantId, CitizenRequestContactChangeRequest request, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        // F33: iletişim değişimi sahiplik kanıtı ister — çalınmış bir oturum tokenıyla
        // (mevcut şifre bilinmeden) kurtarma kanalı değiştirilip hesap ele geçirilemez.
        if (!Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.CurrentPassword ?? "", participant.PasswordHash))
            throw new ConflictException("Mevcut şifreniz hatalı.", "INVALID_CURRENT_PASSWORD");

        var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        var phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();

        if (email is null && phone is null)
            throw new ConflictException("Değiştirilecek telefon veya e-posta belirtilmedi.", "CONTACT_CHANGE_EMPTY");
        if (email is not null && phone is not null)
            throw new ConflictException("Telefon ve e-posta aynı anda değiştirilemez.", "CONTACT_CHANGE_MULTIPLE");

        await otpService.EnsureCanResendAsync(participantId, OtpPurpose.ContactChange, ct);

        string channel;
        string target;
        string masked;
        if (phone is not null)
        {
            channel = "sms";
            target = phone;
            masked = MaskPhone(phone);
        }
        else
        {
            channel = "email";
            target = email!;
            masked = MaskEmail(email!);
        }

        // Yeni hedefe OTP gönderilir (mevcut kayıtlı telefon/e-postaya değil) —
        // amaç, o telefon/e-postanın gerçekten talep edene ait olduğunu kanıtlamak.
        await otpService.SendAsync(participantId, target, channel, OtpPurpose.ContactChange, ct);

        var pending = new PendingContactChange(email, phone, channel, target);
        await redis.SetAsync(ContactChangeKey(participantId), pending, TimeSpan.FromSeconds(otpService.ResendCooldownSeconds), ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = $"Vatandaş iletişim değişikliği talep etti ({channel}), OTP gönderildi",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);

        return new CitizenOtpChallengeDto(channel, masked, otpService.ResendCooldownSeconds);
    }

    public async Task<CitizenUserDto> ConfirmContactChangeAsync(Guid participantId, CitizenConfirmContactChangeRequest request, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var pending = await redis.GetAsync<PendingContactChange>(ContactChangeKey(participantId), ct)
            ?? throw new ConflictException("Önce yeni telefon/e-posta için doğrulama kodu talep edin.", "CONTACT_CHANGE_NOT_REQUESTED");

        await otpService.VerifyAsync(participantId, OtpPurpose.ContactChange, request.Code, ct);

        var newEmail = pending.Email ?? participant.Email;
        var newPhone = pending.Phone ?? participant.Phone;
        participant.UpdateContact(newEmail, newPhone, participant.GuardianPhone, participant.GuardianEmail);
        // F33: iletişim değişimi güvenlik sürümünü artırır; eski oturum/OTP izinleri iptal olur.
        participant.BumpSecurityVersion();
        await uow.SaveChangesAsync(ct);

        await redis.RemoveAsync(ContactChangeKey(participantId), ct);
        await otpService.InvalidateAsync(participantId, OtpPurpose.PasswordReset, ct);
        await TerminateAllSessionsAsync(participantId, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = $"Vatandaş iletişim bilgilerini OTP ile doğrulayıp güncelledi ({pending.Channel})",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);

        return ToDto(participant);
    }

    public async Task<CitizenUserDto> RefreshFromNviAsync(Guid participantId, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var addressRes = await nvi.GetAddressAsync(participant.Tckn, participant.BirthDate, ct);
        if (!addressRes.Success || addressRes.Address is null)
            throw new ConflictException(addressRes.ErrorMessage ?? "NVI adres bilgisi alınamadı.", "NVI_ADDRESS_FAILED");

        var addr = addressRes.Address;
        participant.ApplyStructuredAddress(addr.FullAddress, addr.City, addr.District, addr.Neighborhood, addr.DistrictCode);
        uow.Participants.Update(participant);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = "Vatandaş adres bilgilerini NVI'den yeniledi",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);

        return ToDto(participant);
    }

    // Kullanıcı isteği (2026-09-22/23): eski sistemden aktarılan üyelerin giriş yaptığında
    // (bkz. VerifyOtpAsync/ChangeInitialPasswordAsync çağrıları) NVI'deki güncel adres ve
    // çocuk (18 yaş altı) bilgisi sessizce senkronize edilir. Çocuk eşleştirmesi
    // ConfirmFamilyFromNviAsync ile AYNI mantığı izler (TCKN sistemde varsa bağlanır, yoksa
    // yeni kayıt açılır) ama burada kullanıcı seçimi yoktur — NVI'nin döndürdüğü TÜM 18 yaş
    // altı çocuklar otomatik eklenir/bağlanır, çünkü bu akış manuel "aile önizleme" ekranı
    // değil arka plan senkronizasyonudur.
    //
    // Dönüş değeri (2026-09-23 düzeltmesi): NVI sonuç vermediğinde (ör. NVI_USERNAME/
    // NVI_PASSWORD henüz .env'e girilmemişse — bkz. seed-secrets.sh uyarısı) önceki sürüm
    // sessizce return edip participant.MarkNviSynced() hiç çağrılmıyordu AMA NviResyncPending
    // bayrağı da temizlenmediği için normalde "bir sonraki girişte tekrar dene" davranışı
    // korunuyordu — TEK istisna ChangeInitialPasswordAsync'in düzeltilmiş hâli: orada bu
    // metot NviResyncPending hiç set edilmeden DOĞRUDAN çağrılıyor, yani "sonuç yok" durumunda
    // hiçbir bayrak set/temizlenmediği için o katılımcı bir daha HİÇ yeniden denenmiyordu
    // (gerçek NVI kimlik bilgileri sonradan .env'e girilse bile). Artık bool dönülüyor;
    // çağıran taraf false durumunda MarkNviResyncPending() ile retry'ı garantiler.
    private async Task<bool> SyncNviOnLoginAsync(Participant participant, CancellationToken ct)
    {
        var nviRes = await nvi.GetPersonAndChildrenAsync(participant.Tckn, participant.BirthDate, 18, ct);
        if (!nviRes.Success || nviRes.Person is null)
        {
            log.LogStepResult("NviResyncOnLoginNoResult", new { participant.Id });
            return false;
        }

        var addressRes = await nvi.GetAddressAsync(participant.Tckn, participant.BirthDate, ct);
        if (addressRes.Success && addressRes.Address is not null)
        {
            var addr = addressRes.Address;
            participant.ApplyStructuredAddress(addr.FullAddress, addr.City, addr.District, addr.Neighborhood, addr.DistrictCode);
        }

        if (nviRes.Children.Count > 0)
        {
            var existingChildren = await uow.Participants.GetChildrenAsync(participant.Id, ct);
            var alreadyLinkedTckns = existingChildren.Select(c => c.Tckn).ToHashSet();

            var length = config.GetValue<int>("PasswordPolicy:GeneratedLength");
            var useMock = config.GetValue("SmsSettings:UseMockMode", false);

            foreach (var child in nviRes.Children)
            {
                if (alreadyLinkedTckns.Contains(child.Tckn)) continue;

                var existing = await uow.Participants.GetByTcknAsync(child.Tckn, ct);
                Guid childId;
                if (existing is not null)
                {
                    childId = existing.Id;
                }
                else
                {
                    var childHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(PasswordGenerator.Generate(length, useMock));
                    var childEntity = Participant.Create(
                        tckn: child.Tckn,
                        fullName: $"{child.FirstName} {child.LastName}".Trim(),
                        birthDate: child.BirthDate,
                        gender: child.Gender,
                        isMinor: true,
                        passwordHash: childHash,
                        email: null,
                        phone: null,
                        guardianPhone: participant.Phone,
                        guardianEmail: participant.Email,
                        address: child.Address);
                    childEntity.CompleteInitialPassword(childHash);
                    childEntity.MarkVerified();
                    await uow.Participants.AddAsync(childEntity, ct);
                    childId = childEntity.Id;
                }

                await uow.ParticipantGuardians.AddAsync(ParticipantGuardian.Create(participant.Id, childId, "Çocuk"), ct);
                alreadyLinkedTckns.Add(child.Tckn);
            }
        }

        participant.MarkNviSynced();
        uow.Participants.Update(participant);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = $"Giriş sonrası NVI otomatik senkronizasyonu (adres + {nviRes.Children.Count} çocuk kontrolü)",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);

        return true;
    }

    public async Task<CitizenUserDto> UploadProfilePhotoAsync(Guid participantId, Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var upload = await fileStorage.UploadAsync(stream, fileName, contentType, ct: ct);
        participant.SetPhoto(upload.Url);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = "Vatandaş profil fotoğrafını güncelledi",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);

        return ToDto(participant);
    }

    /// <summary>
    /// Mobil QA bulgusu (2026-09-22, madde 125): "Yüklenip görüntüleniyor ama koyulan
    /// profil fotoğrafı kaldırılamıyor. Hata veriyor." — silme ucu hiç yoktu.
    ///
    /// Yalnızca kayıttaki referans temizlenir, MinIO'daki nesne silinmez: Participant
    /// sadece PhotoUrl tutuyor (ObjectName alanı yok, bkz. SystemBranding'in aksine) ve
    /// URL'den nesne adını geri türetmek kırılgan olurdu. Zaten UploadProfilePhotoAsync
    /// de yeni fotoğraf yüklenirken eskisini silmiyor — bu yol mevcut davranışla tutarlı.
    /// Artık kimsenin erişemediği nesnelerin temizliği depolama tarafı bir iştir.
    /// Idempotent: fotoğrafı olmayan kullanıcıda hata fırlatmaz.
    /// </summary>
    public async Task<CitizenUserDto> RemoveProfilePhotoAsync(Guid participantId, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (string.IsNullOrWhiteSpace(participant.PhotoUrl))
            return ToDto(participant);

        participant.SetPhoto(null);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = "Vatandaş profil fotoğrafını kaldırdı",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);

        return ToDto(participant);
    }

    // Kullanıcı isteği: KVKK/sözleşme onayı ve bildirim izni onayı ayrı checkbox'lar olarak
    // alınır, kayıtta saklanır ve bir daha sorulmaz (idempotent - Accept* zaten kabul edilmişse
    // no-op döner, hata fırlatmaz).
    public async Task<CitizenUserDto> AcceptKvkkAsync(Guid participantId, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (participant.AcceptKvkk())
        {
            await uow.SaveChangesAsync(ct);
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Update,
                Result = LogResult.Success,
                EntityType = "Participant",
                EntityId = participant.Id,
                Module = "ParticipantAuth",
                Description = "Vatandaş KVKK/sözleşme metnini onayladı",
                ActorUserId = participant.Id,
                ActorUserName = participant.FullName,
            }, ct);
        }

        return ToDto(participant);
    }

    public async Task<CitizenUserDto> AcceptNotificationConsentAsync(Guid participantId, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (participant.AcceptNotificationConsent())
        {
            await uow.SaveChangesAsync(ct);
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Update,
                Result = LogResult.Success,
                EntityType = "Participant",
                EntityId = participant.Id,
                Module = "ParticipantAuth",
                Description = "Vatandaş bildirim izni sözleşmesini onayladı",
                ActorUserId = participant.Id,
                ActorUserName = participant.FullName,
            }, ct);
        }

        return ToDto(participant);
    }

    public async Task<CitizenForgotPasswordResultDto> ForgotPasswordAsync(CitizenForgotPasswordRequest request, CancellationToken ct)
    {
        var participant = await ResolveByIdentifierAsync(request.Identifier, ct);

        if (participant is null || participant.Status != ParticipantStatus.Active)
            throw new NotFoundException("Eşleşen bir kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        // Kullanıcı isteği (2026-10-06): telefonu/e-postası olmayan kayıt OTP alamaz, bu
        // yüzden şifre sıfırlayamaz. Kişi doğum tarihini de girerse NVİ ile doğrulanır ve
        // "yeni üye" gibi kayıt akışına alınır; kayıt SİLİNMEZ, CompleteRegistrationAsync
        // aynı Id'yi Reactivate eder ve NVİ'deki çocukları veliye bağlar.
        if (IsUnclaimedWithoutContact(participant))
        {
            if (request.BirthDate is null)
                throw new ConflictException(
                    "Hesabınızda kayıtlı telefon numarası yok. Devam etmek için doğum tarihinizi girin; hesabınızı yeni kayıt adımlarıyla etkinleştireceğiz.",
                    "BIRTHDATE_REQUIRED");

            var preview = await NviLookupAsync(new CitizenNviLookupRequest(participant.Tckn, request.BirthDate.Value), ct);
            log.LogStepResult("ForgotPasswordRedirectToRegistration", new { participant.Id, ChildCount = preview.Children.Count });
            return new CitizenForgotPasswordResultDto("", "", 0, RegistrationRequired: true, Registration: preview);
        }

        var (channel, target) = ResolveOtpTarget(participant);
        if (target is null)
            throw new ConflictException("Hesabınıza kayıtlı telefon numarası bulunamadı.", "CONTACT_NOT_SET");

        if (!await otpService.IsOnCooldownAsync(participant.Id, OtpPurpose.PasswordReset, ct))
        {
            await otpService.SendAsync(participant.Id, target, channel, OtpPurpose.PasswordReset, ct);

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.PasswordReset,
                Result = LogResult.Success,
                EntityType = "Participant",
                EntityId = participant.Id,
                Module = "ParticipantAuth",
                Description = "Şifre sıfırlama OTP gönderildi",
                ActorUserId = participant.Id,
                ActorUserName = participant.FullName,
            }, ct);
        }

        return new CitizenForgotPasswordResultDto("sms", "", otpService.ResendCooldownSeconds);
    }

    public async Task VerifyResetOtpAsync(CitizenVerifyResetOtpRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(VerifyResetOtpAsync), new { });

        var participant = await ResolveByIdentifierAsync(request.Identifier, ct)
            ?? throw new ConflictException("Doğrulama kodu geçersiz.", "OTP_INVALID");

        await EnsurePasswordChangeAllowedAsync(participant.Id, ct);
        try
        {
            await otpService.VerifyWithoutConsumingAsync(participant.Id, OtpPurpose.PasswordReset, request.OtpCode, ct);
        }
        catch (ConflictException ex) when (ex.ErrorCode == "OTP_MISMATCH")
        {
            throw new ConflictException("Doğrulama kodu geçersiz.", "OTP_INVALID");
        }

        log.LogStepResult("ResetOtpVerified", new { participant.Id });
    }

    public async Task ResetPasswordAsync(CitizenResetPasswordRequest request, CancellationToken ct)
    {
        var participant = await ResolveByIdentifierAsync(request.Identifier, ct)
            ?? throw new ConflictException("Doğrulama kodu geçersiz.", "OTP_INVALID");

        await EnsurePasswordChangeAllowedAsync(participant.Id, ct);
        try
        {
            await otpService.VerifyWithoutConsumingAsync(participant.Id, OtpPurpose.PasswordReset, request.OtpCode, ct);
            if (Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.NewPassword, participant.PasswordHash))
                throw new ConflictException("Yeni şifreniz mevcut şifrenizle aynı olamaz.", "SAME_AS_CURRENT_PASSWORD");
        }
        catch (ConflictException ex) when (ex.ErrorCode == "OTP_MISMATCH")
        {
            throw new ConflictException("Doğrulama kodu geçersiz.", "OTP_INVALID");
        }

        await otpService.VerifyAsync(participant.Id, OtpPurpose.PasswordReset, request.OtpCode, ct);

        participant.CompleteInitialPassword(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.NewPassword));
        // Kullanıcı isteği (2026-09-22): eski sistemden aktarılan üyelerin NVI adres/çocuk
        // bilgisi kayıt anında hiç çekilmemiş olabilir (kayıt eski, NVI entegrasyonundan
        // önce yapılmış). "Şifremi unuttum" ile giriş yapan bu kişilerin bir sonraki başarılı
        // girişinde (VerifyOtpAsync) adres ve çocuk bilgisi otomatik NVI'den senkronize edilir
        // — kişi manuel "NVİ'den Yenile" butonuna basmak zorunda kalmaz.
        participant.MarkNviResyncPending();
        await uow.SaveChangesAsync(ct);

        await TerminateAllSessionsAsync(participant.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordReset,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = PasswordResetDescription,
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);
    }

    public async Task DeleteAccountAsync(Guid participantId, CitizenDeleteAccountRequest request, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıt bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (!Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.Password, participant.PasswordHash))
            throw new ConflictException("Şifreniz hatalı.", "INVALID_PASSWORD");

        uow.Participants.Delete(participant);
        await uow.SaveChangesAsync(ct);

        await TerminateAllSessionsAsync(participant.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = "Vatandaş hesabını mobil uygulamadan sildi",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);
    }

    private async Task EnsurePasswordChangeAllowedAsync(Guid participantId, CancellationToken ct)
    {
        var limit = PasswordChangeLimit;
        var windowHours = PasswordChangeWindowHours;
        var since = DateTime.UtcNow.AddHours(-windowHours);

        var changeCount = await uow.AuditLogs.CountAsync(x =>
            x.EntityType == "Participant" &&
            x.EntityId == participantId &&
            x.Result == LogResult.Success &&
            x.CreatedAt >= since &&
            (x.Description == PasswordChangedDescription ||
             x.Description == PasswordResetDescription), ct);

        if (changeCount >= limit)
            throw new ConflictException(
                $"Şifrenizi {windowHours} saat içinde en fazla {limit} kez değiştirebilirsiniz. Lütfen daha sonra tekrar deneyin.",
                "PASSWORD_CHANGE_DAILY_LIMIT");
    }

    public async Task<CitizenNviLookupResultDto> NviLookupAsync(CitizenNviLookupRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(NviLookupAsync), new { TcknPrefix = Prefix(request.Tckn) });

        if (!TcKimlikValidator.IsValid(request.Tckn))
            throw new ConflictException("Geçerli bir T.C. kimlik numarası giriniz.", "INVALID_TCKN");

        var existingLookup = await uow.Participants.GetByTcknIncludingDeletedAsync(request.Tckn, ct);
        if (!IsReusableForRegistration(existingLookup))
            throw new ConflictException("Bu T.C. kimlik numarası ile zaten bir hesap bulunuyor. Lütfen giriş yapın.", "ALREADY_REGISTERED");

        var res = await nvi.GetPersonAndChildrenAsync(request.Tckn, request.BirthDate, 18, ct);
        if (!res.Success || res.Person is null)
            throw new NotFoundException("Bu kimlik bilgileriyle kayıt bulunamadı. Bilgileri kontrol edin.", "NVI_NOT_FOUND");

        var person = res.Person;
        var personName = $"{person.FirstName} {person.LastName}".Trim();
        var mask = MaskCitizenEnabled();

        return new CitizenNviLookupResultDto(
            mask ? IdentityMask.MaskTckn(person.Tckn) : person.Tckn,
            mask ? IdentityMask.MaskName(personName) : personName,
            person.BirthDate,
            person.Gender.ToString(),
            person.Address,
            Age(person.BirthDate) < 18,
            res.Children.Select(c =>
            {
                var childName = $"{c.FirstName} {c.LastName}".Trim();
                return new CitizenNviChildDto(
                    mask ? IdentityMask.MaskTckn(c.Tckn) : c.Tckn,
                    mask ? IdentityMask.MaskName(childName) : childName,
                    c.BirthDate,
                    c.Gender.ToString(),
                    c.Address);
            }).ToList());
    }

    public async Task<CitizenLoginResponseDto> RegisterAsync(CitizenRegisterRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(RegisterAsync), new { TcknPrefix = Prefix(request.Tckn) });

        if (!TcKimlikValidator.IsValid(request.Tckn))
            throw new ConflictException("Geçerli bir T.C. kimlik numarası giriniz.", "INVALID_TCKN");

        var existingParticipant = await uow.Participants.GetByTcknIncludingDeletedAsync(request.Tckn, ct);
        if (!IsReusableForRegistration(existingParticipant))
            throw new ConflictException("Bu T.C. kimlik numarası ile zaten bir hesap bulunuyor. Lütfen giriş yapın.", "ALREADY_REGISTERED");

        // Staj-test bulgusu (2026-09-23): "resend cooldown"ı, aşağıda üretilen
        // rastgele pendingId'ye (Redis key: otp-cooldown:{pendingId}:...) bağlıydı.
        // Kullanıcı OTP ekranından çıkıp kayıt formuna (RegisterScreen) yeniden
        // girip "Kayıt Ol"a tekrar bastığında YENİ bir rastgele pendingId üretiliyor,
        // dolayısıyla ÖNCEKİ cooldown hiç görülmeden yeni bir kod gönderiliyordu —
        // hız sınırı ekranlar arasında fiilen atlanabiliyordu (aynı ekranda kalıp
        // "tekrar gönder"e basmak ise doğru pendingId'yi kullandığı için engelleniyordu,
        // bu da davranış tutarsızlığını açıklıyor). Cooldown artık TCKN'den türetilen
        // SABİT bir kimlikle kontrol edilip başlatılıyor; bu kimlik hangi ekrandan
        // veya kaçıncı denemeden geldiğine bakılmaksızın aynı kalır.
        var registrationCooldownId = TcknCooldownId(request.Tckn);
        await otpService.EnsureCanResendAsync(registrationCooldownId, OtpPurpose.TwoFactor, ct);

        var nviRes = await nvi.GetPersonAndChildrenAsync(request.Tckn, request.BirthDate, 18, ct);
        if (!nviRes.Success || nviRes.Person is null)
            throw new NotFoundException("Bu kimlik bilgileriyle kayıt bulunamadı. Bilgileri kontrol edin.", "NVI_NOT_FOUND");

        var person = nviRes.Person;
        var isMinor = Age(person.BirthDate) < 18;

        if (isMinor && string.IsNullOrWhiteSpace(request.GuardianPhone))
            throw new ConflictException("18 yaş altı kayıtlarda veli telefonu zorunludur.", "GUARDIAN_REQUIRED");

        var addressRes = await nvi.GetAddressAsync(request.Tckn, request.BirthDate, ct);
        var addr = addressRes.Success ? addressRes.Address : null;

        var passwordHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.Password);
        var fullName = $"{person.FirstName} {person.LastName}".Trim();

        var (channel, target, masked) = ResolveOtpTargetForRegistration(request, isMinor);

        var pendingId = Guid.NewGuid();
        var pending = new PendingRegistration(
            request.Tckn,
            passwordHash,
            request.Email,
            request.Phone,
            isMinor ? request.GuardianPhone : null,
            isMinor ? request.GuardianEmail : null,
            fullName,
            person.BirthDate,
            person.Gender,
            isMinor,
            person.Address,
            addr?.FullAddress,
            addr?.City,
            addr?.District,
            addr?.Neighborhood,
            addr?.DistrictCode,
            [.. nviRes.Children.Select(c => new PendingChild(
                c.Tckn, $"{c.FirstName} {c.LastName}".Trim(), c.BirthDate, c.Gender, c.Address))],
            channel,
            target,
            masked);

        await redis.SetAsync(PendingRegKey(pendingId), pending, PendingRegistrationTtl, ct);

        await otpService.SendAsync(pendingId, target, channel, OtpPurpose.TwoFactor, ct);
        // TCKN'e bağlı cooldown, SendAsync'in pendingId'ye özel cooldown'undan AYRIDIR
        // (o da faydalı: aynı pendingId ile art arda resend'i engeller) — bu satır
        // olmadan yukarıdaki EnsureCanResendAsync kontrolü hep boş TTL bulur ve hiçbir
        // şey engellenmez.
        await otpService.StartCooldownAsync(registrationCooldownId, OtpPurpose.TwoFactor, ct);
        var otpSessionToken = jwtService.GeneratePendingOtpToken(pendingId);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            Result = LogResult.Success,
            EntityType = "Participant",
            Module = "ParticipantAuth",
            Description = $"Vatandaş kaydı başlatıldı, OTP doğrulaması bekleniyor: {fullName} ({nviRes.Children.Count} çocuk)",
        }, ct);

        return new CitizenLoginResponseDto(true, otpSessionToken, channel, masked, otpService.ResendCooldownSeconds);
    }

    private async Task<CitizenTokenPairDto> CompleteRegistrationAsync(
        Guid pendingId, PendingRegistration pending, CitizenVerifyOtpRequest request, CancellationToken ct)
    {
        await otpService.VerifyAsync(pendingId, OtpPurpose.TwoFactor, request.Code, ct);

        var existing = await uow.Participants.GetByTcknIncludingDeletedAsync(pending.Tckn, ct);
        if (!IsReusableForRegistration(existing))
            throw new ConflictException("Bu T.C. kimlik numarası ile zaten bir hesap bulunuyor. Lütfen giriş yapın.", "ALREADY_REGISTERED");

        var hasStructuredAddress = pending.AddrFull is not null || pending.AddrCity is not null;

        Participant participant;
        await uow.BeginTransactionAsync(ct);
        try
        {
            if (existing is null)
            {
                participant = Participant.Create(
                    tckn: pending.Tckn,
                    fullName: pending.FullName,
                    birthDate: pending.BirthDate,
                    gender: pending.Gender,
                    isMinor: pending.IsMinor,
                    passwordHash: pending.PasswordHash,
                    email: pending.Email,
                    phone: pending.Phone,
                    guardianPhone: pending.GuardianPhone,
                    guardianEmail: pending.GuardianEmail,
                    address: pending.PersonAddress);
                participant.CompleteInitialPassword(pending.PasswordHash);
                participant.MarkVerified();
                if (hasStructuredAddress)
                    participant.ApplyStructuredAddress(pending.AddrFull, pending.AddrCity, pending.AddrDistrict, pending.AddrNeighborhood, pending.AddrDistrictCode);
                await uow.Participants.AddAsync(participant, ct);
            }
            else
            {
                existing.Reactivate(
                    pending.FullName, pending.BirthDate, pending.Gender, pending.PersonAddress, pending.IsMinor,
                    pending.PasswordHash, pending.Email, pending.Phone, pending.GuardianPhone, pending.GuardianEmail);
                if (hasStructuredAddress)
                    existing.ApplyStructuredAddress(pending.AddrFull, pending.AddrCity, pending.AddrDistrict, pending.AddrNeighborhood, pending.AddrDistrictCode);
                uow.Participants.Update(existing);
                participant = existing;
            }

            var length = config.GetValue<int>("PasswordPolicy:GeneratedLength");
            var useMock = config.GetValue("SmsSettings:UseMockMode", false);

            foreach (var child in pending.Children)
            {
                var existingChild = await uow.Participants.FirstOrDefaultAsync(x => x.Tckn == child.Tckn, ct);
                Guid childId;
                if (existingChild is not null)
                {
                    childId = existingChild.Id;
                    // Panelden açılmış iletişimsiz çocuk kaydı: kod/bildirim veliye gitsin.
                    if (ResolveOtpTarget(existingChild).Target is null)
                    {
                        existingChild.UpdateContact(existingChild.Email, existingChild.Phone, pending.Phone, pending.Email);
                        uow.Participants.Update(existingChild);
                    }
                }
                else
                {
                    var childHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(PasswordGenerator.Generate(length, useMock));
                    var childEntity = Participant.Create(
                        tckn: child.Tckn,
                        fullName: child.FullName,
                        birthDate: child.BirthDate,
                        gender: child.Gender,
                        isMinor: true,
                        passwordHash: childHash,
                        email: null,
                        phone: null,
                        guardianPhone: pending.Phone,
                        guardianEmail: pending.Email,
                        address: child.Address);
                    if (hasStructuredAddress)
                        childEntity.ApplyStructuredAddress(pending.AddrFull, pending.AddrCity, pending.AddrDistrict, pending.AddrNeighborhood, pending.AddrDistrictCode);
                    childEntity.CompleteInitialPassword(childHash);
                    childEntity.MarkVerified();
                    await uow.Participants.AddAsync(childEntity, ct);
                    childId = childEntity.Id;
                }

                if (!participant.Children.Any(g => g.ChildId == childId))
                    participant.Children.Add(ParticipantGuardian.Create(participant.Id, childId, "Çocuk"));
            }

            if (request.KvkkAccepted) participant.AcceptKvkk();
            if (request.NotificationConsentAccepted) participant.AcceptNotificationConsent();

            await GrantWelcomeBonusAsync(participant.Id, ct);

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        await redis.RemoveAsync(PendingRegKey(pendingId), ct);

        var pair = await IssueTokensAsync(participant, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            Result = LogResult.Success,
            EntityType = "Participant",
            EntityId = participant.Id,
            Module = "ParticipantAuth",
            Description = "Vatandaş kaydı OTP ile doğrulandı ve aktifleştirildi",
            ActorUserId = participant.Id,
            ActorUserName = participant.FullName,
        }, ct);

        return pair;
    }

    private static bool IsReusableForRegistration(Participant? existing)
        => existing is null
           || existing.IsDeleted
           || (existing.Status == ParticipantStatus.Passive && !existing.IsVerified)
           || IsUnclaimedWithoutContact(existing);

    // Panelden (veya eski sistem aktarımıyla) açılmış, vatandaşın hiç etkinleştirmediği ve
    // telefon/e-posta içermeyen kayıt: giriş ve şifre sıfırlama kodu gönderilemez. Kayıt
    // SİLİNMEDEN "Kayıt Ol" akışıyla (NVİ + yeni telefona OTP) sahiplenilir; aynı Id
    // korunduğu için başvuru/katılım geçmişi kaybolmaz.
    // IsVerified şartı yok (2026-10-06): eski sistemden aktarılıp doğrulanmış sayılan ama
    // iletişim bilgisi olmayan kayıtlar da OTP alamadığı için aynı yoldan sahiplenilir.
    private static bool IsUnclaimedWithoutContact(Participant p)
        => !p.IsDeleted
           && p.Status == ParticipantStatus.Active
           && ResolveOtpTarget(p).Target is null;

    private const string ActivationRequiredMessage =
        "Kaydınız belediyemiz tarafından oluşturulmuş ancak henüz etkinleştirilmemiş. \"Kayıt Ol\" adımında T.C. kimlik numaranız ve doğum tarihinizle hesabınızı etkinleştirip telefonunuzu ve şifrenizi belirleyin.";

    private async Task GrantWelcomeBonusAsync(Guid participantId, CancellationToken ct)
    {
        var rule = await uow.LoyaltyRules.GetByActionKeyAsync("welcome_bonus", ct);
        if (rule is null || !rule.IsActive) return;

        if (await uow.LoyaltyTransactions.AnyAsync(t => t.ParticipantId == participantId && t.ActionKey == "welcome_bonus", ct))
            return;

        var tx = LoyaltyTransaction.Create(participantId, "welcome_bonus", rule.Label, rule.Points, rule.Points);
        await uow.LoyaltyTransactions.AddAsync(tx, ct);

        if (!await uow.DailyStreaks.AnyAsync(s => s.ParticipantId == participantId, ct))
        {
            var streak = DailyStreak.Create(participantId);
            streak.AddPoints(rule.Points);
            await uow.DailyStreaks.AddAsync(streak, ct);
        }
    }

    private static int Age(DateTime birth)
    {
        var today = DateTime.UtcNow;
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age)) age--;
        return age;
    }

    private static string Prefix(string tckn) => tckn.Length >= 3 ? tckn[..3] : "***";

    private static void EnsureLoginAllowed(Participant participant)
    {
        switch (participant.Status)
        {
            case ParticipantStatus.Passive:
                throw new ConflictException("Hesabınız pasif durumda. Lütfen belediye ile iletişime geçin.", "ACCOUNT_PASSIVE");
            case ParticipantStatus.Blocked:
                var reason = string.IsNullOrWhiteSpace(participant.BlockReason)
                    ? "Hesabınız engellenmiştir."
                    : $"Hesabınız engellenmiştir. {participant.BlockReason}";
                throw new ConflictException(reason, "ACCOUNT_BLOCKED");
        }
    }

    private async Task<CitizenTokenPairDto> IssueTokensAsync(Participant participant, CancellationToken ct, Guid? existingSessionId = null)
    {
        var sessionId = existingSessionId ?? Guid.NewGuid();
        var accessToken = jwtService.GenerateCitizenAccessToken(participant, sessionId);
        var refreshToken = jwtService.GenerateRefreshToken();

        var deviceType = DetectDeviceType(currentUser.UserAgent);
        var payload = new RefreshPayload(
            participant.Id,
            sessionId,
            deviceType,
            currentUser.IpAddress,
            currentUser.UserAgent,
            DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            participant.SecurityVersion);

        var ttl = RefreshTtlFor(deviceType);
        await redis.SetAsync(RefreshKey(refreshToken), payload, ttl, ct);
        // Oturum listesi (çıkış/şifre değişiminde tüm oturumlar buradan bulunur) süresiz tutulur:
        // süresiz mobil oturum varken sonradan açılan web girişi listeye süre koyup onu silmesin.
        // Liste yalnızca anahtar adlarını tutar; süresi dolan web anahtarları zaten kendiliğinden silinir.
        await redis.SetAddPersistentAsync(SessionsKey(participant.Id), refreshToken, ct);

        return new CitizenTokenPairDto(
            accessToken,
            refreshToken,
            DateTime.UtcNow.AddMinutes(AccessTokenMinutes),
            ToDto(participant),
            BuildSessionConfig());
    }

    private static string DetectDeviceType(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent)) return "web";
        var ua = userAgent.ToLowerInvariant();
        if (ua.Contains("capacitor") || ua.Contains("okhttp") || ua.Contains("cfnetwork") ||
            ua.Contains("iphone") || ua.Contains("ipad") || ua.Contains("android"))
            return "mobile";
        return "web";
    }

    private CitizenSessionConfigDto BuildSessionConfig()
        => new(
            config.GetValue("TokenSettings:Web:InactivityTimeoutMinutes", 15),
            config.GetValue("TokenSettings:Mobile:InactivityTimeoutMinutes", 0));

    private async Task InvalidateAllSessionsAsync(Guid participantId, CancellationToken ct)
    {
        var tokens = await redis.SetMembersAsync(SessionsKey(participantId), ct);
        foreach (var token in tokens)
            await redis.RemoveAsync(RefreshKey(token), ct);
        await redis.RemoveAsync(SessionsKey(participantId), ct);
    }

    private async Task TerminateAllSessionsAsync(Guid participantId, CancellationToken ct)
    {
        var tokens = await redis.SetMembersAsync(SessionsKey(participantId), ct);
        foreach (var token in tokens)
        {
            var payload = await redis.GetAsync<RefreshPayload>(RefreshKey(token), ct);
            if (payload is not null && payload.SessionId != Guid.Empty)
                await BlockSessionAsync(payload.SessionId.ToString(), ct);
            await redis.RemoveAsync(RefreshKey(token), ct);
        }
        await redis.RemoveAsync(SessionsKey(participantId), ct);
    }

    public async Task TerminateSessionsAsync(Guid participantId, CancellationToken ct)
    {
        var tokens = await redis.SetMembersAsync(SessionsKey(participantId), ct);
        foreach (var token in tokens)
        {
            var payload = await redis.GetAsync<RefreshPayload>(RefreshKey(token), ct);
            if (payload is not null && payload.SessionId != Guid.Empty)
                await BlockSessionAsync(payload.SessionId.ToString(), ct);
        }
        await InvalidateAllSessionsAsync(participantId, ct);
    }

    private static (string Channel, string Target, string Masked) ResolveOtpChallenge(Participant participant)
    {
        var (channel, target) = ResolveOtpTarget(participant);
        if (target is null)
            throw new ConflictException("İletişim bilgisi bulunamadı. Doğrulama kodu gönderilemedi. Lütfen belediye ile iletişime geçin.", "OTP_TARGET_NOT_FOUND");

        var masked = channel == "sms" ? MaskPhone(target) : MaskEmail(target);
        return (channel, target, masked);
    }

    private static (string Channel, string Target, string Masked) ResolveOtpTargetForRegistration(CitizenRegisterRequest request, bool isMinor)
    {
        var phone = !string.IsNullOrWhiteSpace(request.Phone)
            ? request.Phone
            : isMinor ? request.GuardianPhone : null;

        if (!string.IsNullOrWhiteSpace(phone))
            return ("sms", phone, MaskPhone(phone));

        var email = !string.IsNullOrWhiteSpace(request.Email)
            ? request.Email
            : isMinor ? request.GuardianEmail : null;

        if (!string.IsNullOrWhiteSpace(email))
            return ("email", email, MaskEmail(email));

        throw new ConflictException("İletişim bilgisi bulunamadı. Doğrulama kodu gönderilemedi. Lütfen belediye ile iletişime geçin.", "OTP_TARGET_NOT_FOUND");
    }

    // Günlüğe yalnızca girdinin BİÇİMİ yazılır (geçerli TCKN mi, telefon mu, hatalı mı);
    // değerin kendisi asla yazılmaz. "TcknShapedButInvalid" özellikle önemli: kullanıcı
    // TC'sini doğru girdiğini sanarken rakam hatası yapmışsa arama telefon dalına
    // düşer ve kayıt bulunamaz — bu durum günlükte bu etiketle ayırt edilir.
    private static string IdentifierKindOf(string? identifier)
    {
        var value = identifier?.Trim() ?? "";
        if (value.Length == 0)
            return "Empty";

        var digits = new string(value.Where(char.IsDigit).ToArray());
        if (digits.Length == 11 && TcKimlikValidator.IsValid(digits))
            return "ValidTckn";
        if (digits.Length == 11)
            return "TcknShapedButInvalid";
        return $"PhoneShaped({digits.Length}d)";
    }

    private async Task<Participant?> ResolveByIdentifierAsync(string identifier, CancellationToken ct)
    {
        var value = identifier?.Trim() ?? "";
        if (value.Length == 0)
            return null;

        var digits = new string(value.Where(char.IsDigit).ToArray());
        if (digits.Length == 11 && TcKimlikValidator.IsValid(digits))
            return await uow.Participants.GetByTcknAsync(digits, ct);

        // Eski/import edilen kayitlarda telefonlar 5xxxxxxxxx, yeni kayitlarda
        // 05xxxxxxxxx olarak bulunabiliyor. Kullanici 0, +90 veya bosluklu bir
        // bicimle girse de ayni hesabi bulabilmek icin yaygin saklama bicimlerini
        // sirayla dene.
        // F02: telefon benzersiz değil (aile aynı numarayı paylaşabilir). Aday biçimlere
        // uyan kayıt sayısı 1'den fazlaysa hiçbirini seçme — yanlış hesabın şifresini
        // sıfırlama/yanlış hash ile doğrulama riskini kapat; kullanıcı TCKN ile devam etsin.
        var candidates = PhoneLookupCandidates(value).ToList();
        if (await uow.Participants.CountByPhoneCandidatesAsync(candidates, ct) > 1)
            throw new ConflictException(
                "Bu telefon numarası birden fazla hesapta kayıtlı. Lütfen T.C. kimlik numaranızla giriş yapın.",
                "IDENTIFIER_REQUIRES_CONTEXT");

        foreach (var phone in candidates)
        {
            var participant = await uow.Participants.GetByPhoneAsync(phone, ct);
            if (participant is not null)
                return participant;
        }

        return null;
    }

    private static IEnumerable<string> PhoneLookupCandidates(string value)
    {
        var digits = new string(value.Where(char.IsDigit).ToArray());
        var national = digits switch
        {
            { Length: 12 } when digits.StartsWith("90", StringComparison.Ordinal) => digits[2..],
            { Length: 11 } when digits[0] == '0' => digits[1..],
            { Length: 10 } => digits,
            _ => null
        };

        var candidates = new[]
        {
            value,
            digits,
            national is null ? null : "0" + national,
            national,
            national is null ? null : "90" + national,
            national is null ? null : "+90" + national
        };

        return candidates
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!)
            .Distinct(StringComparer.Ordinal);
    }

    private static (string Channel, string? Target) ResolveOtpTarget(Participant participant)
    {
        var phone = !string.IsNullOrWhiteSpace(participant.Phone)
            ? participant.Phone
            : participant.IsMinor ? participant.GuardianPhone : null;

        if (!string.IsNullOrWhiteSpace(phone))
            return ("sms", phone);

        var email = !string.IsNullOrWhiteSpace(participant.Email)
            ? participant.Email
            : participant.IsMinor ? participant.GuardianEmail : null;

        if (!string.IsNullOrWhiteSpace(email))
            return ("email", email);

        return ("sms", null);
    }

    private bool MaskCitizenEnabled() => participantSettings.CurrentValue.MaskCitizenIdentity;

    private CitizenUserDto ToDto(Participant participant, bool maskName = true)
    {
        var mask = MaskCitizenEnabled();
        return new(
            participant.Id,
            mask && maskName ? IdentityMask.MaskName(participant.FullName) : participant.FullName,
            mask ? IdentityMask.MaskTckn(participant.Tckn) : participant.Tckn,
            participant.Email,
            participant.Phone,
            participant.PhotoUrl,
            participant.IsMinor,
            participant.Status,
            participant.MustChangePassword,
            null,
            participant.BirthDate,
            participant.Gender,
            participant.Address,
            participant.City,
            participant.District,
            participant.Neighborhood,
            participant.IlceKodu,
            Age(participant.BirthDate),
            participant.KvkkAcceptedAt.HasValue,
            participant.NotificationConsentAcceptedAt.HasValue);
    }

    private static string BuildLockedMessage(DateTime? lockedUntil)
    {
        if (lockedUntil is null) return "Hesabınız kilitlendi. Lütfen daha sonra tekrar deneyin.";
        var remaining = lockedUntil.Value - DateTime.UtcNow;
        var seconds = Math.Max(1, (int)Math.Ceiling(remaining.TotalSeconds));
        var text = seconds < 60 ? $"{seconds} saniye" : $"{Math.Ceiling(seconds / 60.0):0} dakika";
        return $"Hesabınız kilitlendi. {text} sonra tekrar deneyin.";
    }

    private static string MaskPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length < 4)
            return "***";
        var prefix = digits[..Math.Min(4, digits.Length - 2)];
        var suffix = digits[^2..];
        return $"{prefix}***{suffix}";
    }

    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0)
            return "***";
        var local = email[..at];
        var domain = email[(at + 1)..];
        var maskedLocal = local.Length <= 1 ? local : $"{local[0]}***";
        var dot = domain.LastIndexOf('.');
        var maskedDomain = dot > 0 ? $"***{domain[dot..]}" : "***";
        return $"{maskedLocal}@{maskedDomain}";
    }

    private async Task BlockSessionAsync(string sessionId, CancellationToken ct)
        => await redis.SetAsync($"auth:revoked-session:{sessionId}", 1, TimeSpan.FromMinutes(AccessTokenMinutes + 5), ct);

    private static string HandoffKey(string code) => $"handoff:code:{code}";
    private TimeSpan HandoffCodeTtl => TimeSpan.FromSeconds(
        config.GetValue("HandoffSettings:CodeTtlSeconds", 30));

    private static string RefreshKey(string token) => $"auth:citizen-refresh:{token}";
    private static string SessionsKey(Guid participantId) => $"auth:citizen-sessions:{participantId}";
    private static string PendingRegKey(Guid pendingId) => $"auth:citizen-pending-register:{pendingId}";
    private static string ContactChangeKey(Guid participantId) => $"auth:citizen-contact-change:{participantId}";

    // Kayıt akışındaki OTP resend cooldown'ı için TCKN'den türetilen SABİT bir
    // Guid — bkz. RegisterAsync üstündeki 2026-09-23 bulgu notu. pendingId her
    // denemede rastgele üretildiği için cooldown anahtarı olarak kullanılamaz;
    // bu, aynı TCKN için ekran/oturum değişse de aynı kalan deterministik bir
    // kimliktir (gerçek bir Participant.Id ile ÇAKIŞMAZ çünkü ayrı bir ad alanı
    // önekiyle hashleniyor).
    private static Guid TcknCooldownId(string tckn)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"registration-cooldown:{tckn}"));
        return new Guid(bytes[..16]);
    }

    private record RefreshPayload(
        Guid ParticipantId,
        Guid SessionId,
        string DeviceType,
        string? IpAddress,
        string? UserAgent,
        long CreatedAt,
        int SecurityVersion = 0);

    private record PendingRegistration(
        string Tckn,
        string PasswordHash,
        string? Email,
        string? Phone,
        string? GuardianPhone,
        string? GuardianEmail,
        string FullName,
        DateTime BirthDate,
        Gender Gender,
        bool IsMinor,
        string? PersonAddress,
        string? AddrFull,
        string? AddrCity,
        string? AddrDistrict,
        string? AddrNeighborhood,
        string? AddrDistrictCode,
        List<PendingChild> Children,
        string Channel,
        string Target,
        string Masked);

    private record PendingChild(
        string Tckn,
        string FullName,
        DateTime BirthDate,
        Gender Gender,
        string? Address);

    // internal: regresyon testleri (Nexora.UnitTests) OTP doğrulanmadan katılımcı
    // kaydının değişmediğini kanıtlamak için bu pending-state kaydını doğrudan
    // oluşturup redis mock'una enjekte ediyor.
    internal record PendingContactChange(string? Email, string? Phone, string Channel, string Target);
}
