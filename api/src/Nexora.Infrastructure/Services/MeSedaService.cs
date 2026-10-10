using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Seda;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services.Seda;

namespace Nexora.Infrastructure.Services;

public class MeSedaService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    ISedaSettingsService settingsService,
    ISedaDefinitionService definitionService,
    ISedaSchoolService schoolService,
    IActivityLogger log,
    IAuditService audit) : IMeSedaService
{
    public async Task<CitizenSedaInfoDto> GetInfoAsync(CancellationToken ct)
    {
        var settings = await settingsService.GetAsync(ct);
        return new CitizenSedaInfoDto(settings.ApplicationsOpen, settings.RequireApproval, settings.ActivePeriod);
    }

    public async Task<CitizenSedaOptionsDto> GetOptionsAsync(CancellationToken ct)
    {
        var schools     = await schoolService.GetOptionsAsync(ct);
        var eduTypes    = await definitionService.GetOptionsAsync("education-type", ct);
        var grades      = await definitionService.GetOptionsAsync("grade", ct);
        var examCenters = await definitionService.GetOptionsAsync("exam-center", ct);
        return new CitizenSedaOptionsDto(schools, eduTypes, grades, examCenters);
    }

    /// <summary>
    /// Başvuruda gönderilen okul / eğitim türü / sınıf / sınav merkezi değerlerinin,
    /// admin panelde tanımlı seçeneklerden biri olduğunu doğrular. Vatandaş uygulaması
    /// bu değerleri zaten listeden seçiyor; bu kontrol, istemciye güvenmemek ve
    /// raporlamayı uydurma/yazım hatalı kayıtlardan korumak içindir (bkz. G1 bulgusu).
    ///
    /// ÜRETİM GÜVENLİĞİ (2026-09-21 tespiti): Bu kontrol ilk hâlinde canlı ortamı
    /// kilitleyecekti. Üretim verisinde yalnızca 2 okul tanımlıyken mevcut 10.956
    /// başvuru 6 farklı okul adı kullanıyordu ve HİÇBİRİ tanım listesinde yoktu —
    /// yani katı doğrulama açılsaydı vatandaş kendi okulunu seçemeyeceği için TÜM
    /// yeni SEDA başvuruları "400 Geçersiz okul seçimi" ile reddedilecekti.
    /// Bu yüzden doğrulama, listenin gerçekten kullanılabilir olduğu alanlarla
    /// sınırlıdır: bir alanın tanım listesi boşsa ya da mevcut başvurularda kullanılan
    /// değerleri kapsamıyorsa o alan serbest bırakılır (aksi hâlde kapsama sorunu
    /// vatandaşa hata olarak yansır). Admin tanım listesini tamamladığında koruma
    /// kendiliğinden devreye girer.
    /// </summary>
    private async Task EnsureOptionsAreValidAsync(CitizenSedaApplyRequest req, CancellationToken ct)
    {
        var options = await GetOptionsAsync(ct);
        var errors = new Dictionary<string, string[]>();

        void Check(string field, string? value, IReadOnlyCollection<SedaOptionDto> allowed, string label)
        {
            if (string.IsNullOrWhiteSpace(value)) return; // zorunluluk kontrolü validator'da
            if (allowed.Count == 0) return;               // tanım listesi boşsa kısıtlama yapma
            var ok = allowed.Any(o =>
                string.Equals(o.Value, value, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(o.Label, value, StringComparison.OrdinalIgnoreCase));
            if (!ok) errors[field] = [$"Geçersiz {label} seçimi. Lütfen listeden seçim yapınız."];
        }

        // Okul listesi ayrı ele alınır: tanım sayısı, halihazırda başvurularda kullanılan
        // okul çeşitliliğinden azsa liste "eksik" demektir ve doğrulama uygulanmaz.
        // Böylece eksik tanım yüzünden gerçek vatandaş başvurusu reddedilmez.
        var schoolListUsable = await IsSchoolListUsableAsync(options.Schools.Count, ct);
        if (schoolListUsable)
            Check(nameof(req.SchoolName), req.SchoolName, options.Schools, "okul");

        Check(nameof(req.EducationType),  req.EducationType,  options.EducationTypes, "eğitim türü");
        Check(nameof(req.NextYearGrade),  req.NextYearGrade,  options.Grades,         "sınıf");
        Check(nameof(req.ExamCenterName), req.ExamCenterName, options.ExamCenters,    "sınav merkezi");

        if (errors.Count > 0)
            throw new ValidationException(errors.Values.First()[0], errors);
    }

    /// <summary>
    /// Okul tanım listesinin doğrulama yapmaya yetecek kadar tam olup olmadığını söyler.
    /// Mevcut başvurularda geçen farklı okul sayısı, tanımlı okul sayısından fazlaysa
    /// liste eksiktir; bu durumda doğrulama yapmak vatandaşı bloke eder (bkz. yukarıdaki not).
    /// </summary>
    private async Task<bool> IsSchoolListUsableAsync(int definedSchoolCount, CancellationToken ct)
    {
        if (definedSchoolCount == 0) return false;
        var distinctUsed = await uow.SedaApplications.CountDistinctSchoolNamesAsync(ct);
        return definedSchoolCount >= distinctUsed;
    }

    public async Task<SedaApplicationDto> ApplyAsync(CitizenSedaApplyRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(ApplyAsync), new { req.SchoolName });

        var settings = await settingsService.GetAsync(ct);
        if (!settings.ApplicationsOpen)
            throw new ConflictException("Başvuru alımı şu anda kapalıdır.", "SEDA_APPLICATIONS_CLOSED");

        var citizenId = currentUser.Id;
        if (!citizenId.HasValue)
            throw new UnauthorizedAccessException();

        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            var dto = await ApplyCoreAsync(citizenId.Value, req, settings, ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
            return dto;
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }
    }

    private async Task<SedaApplicationDto> ApplyCoreAsync(Guid citizenId, CitizenSedaApplyRequest req, SedaSettingsDto settings, CancellationToken ct)
    {
        // Bulgu (2026-09-21 uçtan uca testi, G1): okul/eğitim türü/sınıf/sınav merkezi
        // alanları serbest metin olarak kaydediliyordu; sunucu, gönderilen değerin
        // /me/seda/options listesinde bulunup bulunmadığını hiç kontrol etmiyordu.
        // Canlı doğrulandı: tanımlı olmayan "Olmayan Okul" değeriyle başvuru 201 ile kabul
        // edildi. Bu, okul bazlı raporlamayı (summary?schoolName=) yazım hatalı/uydurma
        // kayıtlarla bozuyordu. Anket modülünde aynı kontrol zaten doğru yapılıyor.
        await EnsureOptionsAreValidAsync(req, ct);

        await uow.AcquireAdvisoryLockAsync(CitizenLockKey(citizenId), ct);

        var participant = await uow.Participants.GetByIdAsync(citizenId, ct)
            ?? throw new NotFoundException("Kayıtlı kişi bilgisi bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var hasTckn = !string.IsNullOrWhiteSpace(participant.Tckn);
        if (hasTckn)
            await uow.AcquireAdvisoryLockAsync(SedaConcurrency.TcknLockKey(participant.Tckn), ct);

        var alreadyApplied = await uow.SedaApplications.HasActiveApplicationForCitizenAsync(citizenId, settings.ActivePeriod?.Id, ct)
            || (hasTckn && await uow.SedaApplications.HasActiveApplicationForTcknAsync(participant.Tckn, settings.ActivePeriod?.Id, ct));
        if (alreadyApplied)
            throw new ConflictException("Zaten aktif bir SEDA eğitim başvurunuz bulunuyor.", "SEDA_ALREADY_APPLIED");

        if (settings.ActivePeriod is not null && settings.ActivePeriod.MaxApplications > 0)
        {
            await uow.AcquireAdvisoryLockAsync(SedaConcurrency.PeriodLockKey(settings.ActivePeriod.Id), ct);
            var currentCount = await uow.SedaApplications.CountByPeriodAsync(settings.ActivePeriod.Id, ct);
            if (currentCount >= settings.ActivePeriod.MaxApplications)
                throw new ConflictException("Başvuru kontenjanı dolmuştur.", "SEDA_QUOTA_FULL");
        }

        if (settings.ActivePeriod is not null)
        {
            var today = Nexora.Domain.Common.TurkeyTime.TodayDate();
            if (today < settings.ActivePeriod.StartDate.Date || today > settings.ActivePeriod.EndDate.Date)
                throw new ConflictException("Başvuru dönemi şu anda açık değil (dönem tarihleri dışında).", "SEDA_PERIOD_OUT_OF_WINDOW");
        }

        var fullName = participant.FullName.Trim();
        var lastSpace = fullName.LastIndexOf(' ');
        var studentName = lastSpace > 0 ? fullName[..lastSpace] : fullName;
        var studentSurname = lastSpace > 0 ? fullName[(lastSpace + 1)..] : "";

        var initialStatus = settings.RequireApproval ? "pending" : "approved";

        var code = $"SEDA{await uow.SedaApplications.NextCodeNumberAsync(ct):D6}";
        var app = SedaApplication.Create(
            code,
            studentName, studentSurname, participant.Tckn,
            participant.BirthDate,
            req.SchoolName.Trim(), req.NextYearGrade.Trim(), req.EducationType.Trim(), req.ExamCenterName.Trim(),
            participant.Phone?.Trim() ?? string.Empty,
            participant.GuardianPhone?.Trim() ?? participant.Phone?.Trim() ?? string.Empty,
            participant.Neighborhood?.Trim() ?? string.Empty,
            participant.Address?.Trim() ?? string.Empty,
            initialStatus, req.Notes?.Trim(), currentUser.Name,
            citizenId, settings.ActivePeriod?.Id);

        await uow.SedaApplications.AddAsync(app, ct);
        try
        {
            await uow.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (SedaConcurrency.IsTcknUniqueViolation(ex))
        {
            throw new ConflictException("Zaten aktif bir SEDA eğitim başvurunuz bulunuyor.", "SEDA_ALREADY_APPLIED");
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "SedaApplication",
            EntityId = app.Id,
            Module = "Seda",
            Description = $"Vatandaş SEDA başvurusu yaptı: {app.Code} — {app.StudentName} {app.StudentSurname} ({app.SchoolName})",
            NewValues = JsonSerializer.Serialize(ToDto(app)),
        }, ct);

        return ToDto(app);
    }

    private static long CitizenLockKey(Guid citizenId) => BitConverter.ToInt64(citizenId.ToByteArray(), 0);

    public async Task<PagedResult<SedaApplicationDto>> GetMyApplicationsAsync(int page, int limit, CancellationToken ct)
    {
        var citizenId = currentUser.Id;
        if (!citizenId.HasValue)
            throw new UnauthorizedAccessException();

        var paged = await uow.SedaApplications.GetByUserAsync(citizenId.Value, page, limit, ct);
        return new PagedResult<SedaApplicationDto>
        {
            Items = paged.Items.Select(ToDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<CitizenSedaResultDto> GetMyResultAsync(CancellationToken ct)
    {
        var citizenId = currentUser.Id;
        if (!citizenId.HasValue)
            throw new UnauthorizedAccessException();

        var participant = await uow.Participants.GetByIdAsync(citizenId.Value, ct)
            ?? throw new NotFoundException("Kayıtlı kişi bilgisi bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var activePeriod = await uow.SedaPeriods.GetActiveAsync(ct);
        if (activePeriod is null)
            return new CitizenSedaResultDto(false, null, false, null, null);

        var records = await GetMatchingRecordsAsync(participant, ct);
        var matchInPeriod = records.FirstOrDefault(x => x.Record.PeriodId == activePeriod.Id).Record;
        var matchByYear = records.FirstOrDefault(x => x.Record.PeriodId == null && x.Record.AcademicYear == activePeriod.Name).Record;
        var record = matchInPeriod ?? matchByYear;

        // BULGU (2026-09-21 uçtan uca testi): isWinner alanına `record is not null`
        // veriliyordu, yani "sonuç kaydın var mı" sorusu "kazandın mı" diye
        // cevaplanıyordu. Canlı doğrulandı: DB'de IsWinner=false / ResultNote="KAZANAMADI"
        // olan vatandaşa API isWinner:true döndürüyordu — kazanamayan kişiye
        // kazandığını söyleyen, itiraza açık ciddi bir hata. Çoğul uç
        // (GetMyResultsAsync) zaten doğru alanı kullanıyor; burada da kaydın
        // gerçek IsWinner değeri okunuyor.
        return new CitizenSedaResultDto(true, activePeriod.Name, record?.IsWinner ?? false, record?.Score, record?.ResultNote);
    }

    public async Task<List<CitizenSedaResultItemDto>> GetMyResultsAsync(CancellationToken ct)
    {
        var citizenId = currentUser.Id;
        if (!citizenId.HasValue)
            throw new UnauthorizedAccessException();

        var participant = await uow.Participants.GetByIdAsync(citizenId.Value, ct)
            ?? throw new NotFoundException("Kayıtlı kişi bilgisi bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var records = await GetMatchingRecordsAsync(participant, ct);
        if (records.Count == 0) return [];

        var periodIds = records.Where(x => x.Record.PeriodId.HasValue).Select(x => x.Record.PeriodId!.Value).Distinct().ToList();
        var periods = periodIds.Count > 0
            ? (await uow.SedaPeriods.FindAsync(p => periodIds.Contains(p.Id), ct)).ToDictionary(p => p.Id, p => p.Name)
            : new Dictionary<Guid, string>();

        return records
            .Select(x => new CitizenSedaResultItemDto(
                x.Record.AcademicYear,
                x.Record.PeriodId.HasValue ? periods.GetValueOrDefault(x.Record.PeriodId.Value) : null,
                x.Record.IsWinner,
                x.Record.Score,
                x.Record.Rank,
                x.Record.ResultNote,
                x.Record.DetailsJson,
                x.MatchedBy))
            .OrderByDescending(x => x.AcademicYear)
            .ToList();
    }

    // Kullanıcı isteği (2026-08-12): "vatandaşlar kendi portalında telefon numaraları ile
    // sorgulayabilmesi" — Excel'de doğru TCKN girilmemiş satırlar için TCKN eşleşmesine ek/yedek
    // olarak, giriş yapmış (OTP doğrulanmış) vatandaşın KENDİ kayıtlı Phone/GuardianPhone'una göre
    // eşleşme denenir. Genel/açık bir "herkesin telefonuyla arama yapabileceği" ekran DEĞİL —
    // sonuç sadece o an giriş yapmış kullanıcının kendi telefon numarasına göre çözülüyor.
    private async Task<List<(SedaEducationRecord Record, string MatchedBy)>> GetMatchingRecordsAsync(
        Nexora.Domain.Entities.Participants.Participant participant, CancellationToken ct)
    {
        var byTckn = await uow.SedaEducationRecords.GetByTcknAsync(participant.Tckn, ct);
        var result = byTckn.Select(r => (Record: r, MatchedBy: "tckn")).ToList();

        var matchedIds = result.Select(x => x.Record.Id).ToHashSet();
        foreach (var phone in new[] { participant.Phone, participant.GuardianPhone })
        {
            if (string.IsNullOrWhiteSpace(phone)) continue;
            var normalized = NormalizePhone(phone);
            if (normalized.Length == 0) continue;
            var byPhone = await uow.SedaEducationRecords.GetByPhoneAsync(normalized, ct);
            foreach (var r in byPhone)
                if (matchedIds.Add(r.Id)) result.Add((r, "phone"));
        }

        return result;
    }

    private static string NormalizePhone(string phone)
    {
        var digitsOnly = new string(phone.Where(char.IsDigit).ToArray());
        return digitsOnly.Length >= 10 ? digitsOnly[^10..] : digitsOnly;
    }

    public async Task CancelApplicationAsync(Guid applicationId, CancellationToken ct)
    {
        log.LogStep(nameof(CancelApplicationAsync), new { applicationId });

        var citizenId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var app = await uow.SedaApplications.GetByIdAsync(applicationId, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");

        if (app.CitizenUserId != citizenId)
            throw new ForbiddenException("Bu başvuruya erişim yetkiniz yok.", "APPLICATION_FORBIDDEN");

        if (app.Status == "cancelled")
            return;

        if (app.Status != "pending")
            throw new ConflictException(
                "Değerlendirmesi tamamlanan başvuru iptal edilemez.", "NOT_CANCELABLE");

        app.SetStatus("cancelled", currentUser.Name);
        uow.SedaApplications.Update(app);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Cancel,
            EntityType = "SedaApplication",
            EntityId = app.Id,
            Module = "Seda",
            Description = $"Vatandaş SEDA başvurusunu iptal etti: {app.Code} — {app.StudentName} {app.StudentSurname}",
        }, ct);
    }

    private static bool ComputeCanCancel(SedaApplication a) => a.Status == "pending";

    private static SedaApplicationDto ToDto(SedaApplication a) => new(
        a.Id, a.Code, a.StudentName, a.StudentSurname, a.Tckn, a.BirthDate, a.SchoolName,
        a.NextYearGrade, a.EducationType, a.ExamCenterName, a.StudentPhone, a.ParentPhone,
        a.Neighborhood, a.Address, a.Status, a.Notes, a.RejectionReason, a.CreatedAt, a.AppliedBy, a.ReviewedAt, a.ReviewedBy,
        ComputeCanCancel(a));
}
