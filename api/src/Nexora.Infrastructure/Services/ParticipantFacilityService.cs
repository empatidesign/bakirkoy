using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Application.Features.ParticipantFacilities;
using Nexora.Application.Features.ParticipantFacilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.Notifications;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class ParticipantFacilityService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IAuditService audit,
    IFileStorageService fileStorage,
    IFacilityRegistrationService registrationService,
    IFacilityNotificationService notification,
    Nexora.Application.Features.Notifications.INotificationService inApp,
    IQrTokenService qr,
    IConfiguration config,
    IFacilityParticipationLimitGuard participationLimitGuard,
    IFacilityCrossProgramLimitGuard crossProgramLimitGuard,
    IMalwareScanService malwareScan,
    IActivityLogger log) : IParticipantFacilityService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
    private const string DocumentsBucket = "nexora-private";
    private string SultangaziDistrictCode => config.GetValue("Residency:SultangaziDistrictCode", Nexora.Domain.Common.ResidencyPolicy.DefaultSultangaziDistrictCode)!;

    public async Task<CitizenFacilityDiscoverResultDto> DiscoverAsync(string module, CitizenFacilityDiscoverParams p, CancellationToken ct)
    {
        if (!FacilityModuleRegistry.IsValid(module))
            throw new NotFoundException("Geçersiz hizmet türü.", "INVALID_MODULE");

        var actor = await ResolveActorAsync(p.ParticipantId, ct);
        int? eligibleAge = actor is null ? null : Age(actor.BirthDate);
        string? eligibleGender = actor is null ? null : (actor.Gender == Gender.Male ? "male" : "female");
        var requestedGender = string.IsNullOrWhiteSpace(p.Gender) ? null : p.Gender;

        var listFilter = new DiscoverFilter(
            module, p.Search, p.BranchId, p.BranchName,
            p.ShowAll == true ? null : eligibleAge,
            p.ShowAll == true ? null : (requestedGender ?? eligibleGender),
            p.OnlySubGroups,
            p.OnlyAvailable == true,
            p.FacilityId,
            p.AgeMin,
            p.AgeMax,
            p.OnlyWithParking == true,
            p.OnlyFull == true);

        var paged = await uow.FacilityGroups.GetActiveDiscoverAsync(listFilter, p.PageResolved, p.LimitResolved, ct);
        var groups = paged.Items;

        var facilities = await LoadFacilityNamesAsync(groups.Select(g => g.FacilityId), ct);
        var serviceFacilityInfo = await LoadServiceFacilityInfoByFacilityAsync(groups.Select(g => g.FacilityId), ct);
        var branches = await LoadBranchNamesAsync(groups.Select(g => g.BranchId), ct);
        var appliedGroupIds = await AppliedGroupIdsAsync(actor?.Id, groups.Select(g => g.Id).ToList(), ct);

        // Kullanıcı isteği: bir programa yapılan başvuru admin tarafından reddedildiğinde, o kişi
        // artık o SPESİFİK programı keşfet ekranında hiç görmemeli ve o programa bir daha
        // başvuramamalı — ama diğer tüm programlara normal şekilde başvurabilmeli. Önceden
        // "rejected" durumu genel olarak "aktif değil" sayıldığı için (bkz. HasActiveApplicationAsync)
        // kişi hem programı görmeye hem tekrar başvurmaya devam edebiliyordu. Reddedilen program
        // kimlikleri ayrıca hesaplanıp discover listesinden çıkarılıyor.
        var rejectedGroupIds = await RejectedGroupIdsAsync(actor?.Id, groups.Select(g => g.Id).ToList(), ct);

        var items = groups
            .Where(g => !rejectedGroupIds.Contains(g.Id))
            .Select(g => ToCard(
                g,
                facilities.GetValueOrDefault(g.FacilityId, "—"),
                branches.GetValueOrDefault(g.BranchId, "—"),
                actor,
                appliedGroupIds.Contains(g.Id),
                serviceFacilityInfo.TryGetValue(g.FacilityId, out var sfDiscover) ? sfDiscover : null)).ToList();

        items = [.. items.OrderBy(i => i.AlreadyApplied ? 1 : 0).ThenBy(i => i.PeriodStart ?? DateTime.MaxValue)];

        var totalFilter = listFilter with { Age = null, Gender = requestedGender };
        var eligibleFilter = listFilter with { Age = eligibleAge, Gender = requestedGender ?? eligibleGender };
        var totalCount = await uow.FacilityGroups.CountDiscoverAsync(totalFilter, ct);
        var eligibleCount = actor is null
            ? totalCount
            : await uow.FacilityGroups.CountDiscoverAsync(eligibleFilter, ct);

        return new CitizenFacilityDiscoverResultDto(items, paged.Total, paged.Page, paged.Limit, eligibleCount, totalCount);
    }

    public async Task<List<CitizenFacilityBranchDto>> GetBranchesAsync(string module, Guid? participantId, CancellationToken ct)
    {
        if (!FacilityModuleRegistry.IsValid(module))
            throw new NotFoundException("Geçersiz hizmet türü.", "INVALID_MODULE");

        var actor = await ResolveActorAsync(participantId, ct);
        int? eligibleAge = actor is null ? null : Age(actor.BirthDate);
        string? eligibleGender = actor is null ? null : (actor.Gender == Gender.Male ? "male" : "female");

        var branchCounts = await uow.FacilityGroups.GetActiveBranchesAsync(module, eligibleAge, eligibleGender, ct);
        return branchCounts
            .Select(b => new CitizenFacilityBranchDto(b.BranchName, b.Count, b.EligibleCount))
            .ToList();
    }

    public async Task<CitizenFacilityFiltersDto> GetFiltersAsync(string module, CitizenFacilityDiscoverParams p, CancellationToken ct)
    {
        if (!FacilityModuleRegistry.IsValid(module))
            throw new NotFoundException("Geçersiz hizmet türü.", "INVALID_MODULE");

        var actor = await ResolveActorAsync(p.ParticipantId, ct);
        int? eligibleAge = actor is null ? null : Age(actor.BirthDate);
        string? eligibleGender = actor is null ? null : (actor.Gender == Gender.Male ? "male" : "female");

        var scopeFilter = new DiscoverFilter(
            module, p.Search, null, null, null, null, p.OnlySubGroups, false);

        var filters = await uow.FacilityGroups.GetActiveFiltersAsync(scopeFilter, eligibleAge, eligibleGender, ct);

        return new CitizenFacilityFiltersDto(
            filters.Facilities.Select(x => new CitizenFacilityFacilityOptionDto(x.Id, x.Name, x.Count)).ToList(),
            filters.Branches.Select(x => new CitizenFacilityBranchDto(x.BranchName, x.Count, x.EligibleCount)).ToList(),
            filters.Genders.Select(x => new CitizenFacilityGenderOptionDto(x.Name, GenderLabel(x.Name), x.Count)).ToList(),
            filters.AgeGroups.Select(x => new CitizenFacilityAgeGroupOptionDto(x.AgeMin, x.AgeMax, AgeGroupLabel(x.AgeMin, x.AgeMax), x.Count)).ToList(),
            filters.AvailableCount,
            filters.TotalCount,
            filters.WithParkingCount);
    }

    private static string GenderLabel(string gender) => gender switch
    {
        "male" => "Erkek",
        "female" => "Kadın",
        "mixed" => "Karma",
        _ => gender,
    };

    private static string AgeGroupLabel(int ageMin, int ageMax)
    {
        if (ageMin > 0 && ageMax > 0) return $"{ageMin}–{ageMax} Yaş";
        if (ageMin > 0) return $"{ageMin}+ Yaş";
        if (ageMax > 0) return $"0–{ageMax} Yaş";
        return "Tüm yaşlar";
    }

    private async Task<Participant?> ResolveActorAsync(Guid? participantId, CancellationToken ct)
    {
        var self = currentUser.Id.HasValue
            ? await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct)
            : null;
        if (self is null || participantId is null || participantId == self.Id)
            return self;

        var children = await uow.Participants.GetChildrenAsync(self.Id, ct);
        var selected = children.FirstOrDefault(c => c.Id == participantId.Value);
        return selected ?? self;
    }

    public async Task<CitizenFacilityGroupDetailDto> GetDetailAsync(string module, Guid groupId, CancellationToken ct)
    {
        if (!FacilityModuleRegistry.IsValid(module))
            throw new NotFoundException("Geçersiz hizmet türü.", "INVALID_MODULE");

        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct);
        if (group is null || group.Module != module || !group.IsActive)
            throw new NotFoundException("Program bulunamadı.", "GROUP_NOT_FOUND");

        var actor = currentUser.Id.HasValue
            ? await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct)
            : null;

        var facility = await uow.Facilities.GetByIdAsync(group.FacilityId, ct);
        if (facility is null || !facility.IsActive)
            throw new NotFoundException("Program bulunamadı.", "GROUP_NOT_FOUND");

        // Kullanıcı isteği (2026-08-05): DiscoverAsync (BuildDiscoverQuery) ve ApplyAsync ile aynı
        // kural burada da uygulanıyor — branch pasifse veya üst grup ("seans") pasifse, alt grup
        // kendisi aktif olsa bile detay ekranı 404 dönmeli; aksi halde citizen doğrudan link/QR ile
        // bu ekrana ulaşıp kapalı bir programa başvuru formunu (applicationOpen: true) görebiliyordu
        // (kasif modülünde canlı citizen API testiyle doğrulandı: pasif üst grubun aktif alt grubu
        // "Yakup Atölye" için GetDetailAsync önceden 200/applicationOpen:true dönüyordu, düzeltme
        // sonrası 404 GROUP_NOT_FOUND dönüyor — bkz. commit mesajı).
        var detailBranch = await uow.FacilityBranches.GetByIdAsync(group.BranchId, ct);
        if (detailBranch is null || !detailBranch.IsActive)
            throw new NotFoundException("Program bulunamadı.", "GROUP_NOT_FOUND");

        if (group.ParentGroupId is Guid detailParentGroupId)
        {
            var detailParentGroup = await uow.FacilityGroups.GetByIdAsync(detailParentGroupId, ct);
            if (detailParentGroup is null || !detailParentGroup.IsActive)
                throw new NotFoundException("Program bulunamadı.", "GROUP_NOT_FOUND");
        }

        var facilityName = facility?.Name ?? "—";
        var branchName = detailBranch.Name;
        var appliedGroupIds = await AppliedGroupIdsAsync(actor?.Id, [group.Id], ct);

        ServiceFacility? serviceFacility = facility?.ServiceFacilityId is not null
            ? await uow.ServiceFacilities.GetByIdAsync(facility.ServiceFacilityId.Value, ct)
            : null;

        var facilityImages = serviceFacility is not null ? ResolveImages(serviceFacility) : (null, []);

        var card = ToCard(group, facilityName, branchName, actor, appliedGroupIds.Contains(group.Id));

        var sessions = await uow.FacilitySessions.GetByGroupAsync(group.Id, ct);
        var periodStart = group.PeriodStart?.Date;
        var periodEnd = group.PeriodEnd?.Date;
        var sessionDtos = sessions
            .Where(s => !s.IsCancelled
                && (periodStart is null || s.Date.Date >= periodStart.Value)
                && (periodEnd is null || s.Date.Date <= periodEnd.Value))
            .OrderBy(s => s.Date).ThenBy(s => s.StartTime)
            .Select(s => new CitizenFacilitySessionDto(s.Id, s.Date, s.Day, s.StartTime, s.EndTime, s.IsCancelled))
            .ToList();

        var applicants = await BuildApplicantsAsync(group, actor, ct);
        var rule = await ResolveGroupDocumentRuleAsync(module, group, ct);

        var limitSettings = await uow.FacilitySettings.GetGeneralAsync(module, ct);
        var (limitType, limitCount) = FacilityParticipationLimit.Resolve(group.AttendanceLimitOverride, group.AttendanceLimitType, group.AttendanceLimitCount, limitSettings?.SettingsJson);

        // basvuruhitetmeyenkurallar.md sonrası UI-envanteri: admin panelde "Genel Ayarlar > Katılım
        // Sınıfları" (yaş bazlı ikamet/sağlık raporu/veli onayı/katılım-limiti-override kuralları)
        // hiç okunmuyordu. Katılımcının yaşı henüz bilinmiyor bu detay-görüntüleme yolunda (aktör
        // birden fazla kişi adına bakabilir) — gerçek uygulama ResolveGroupDocumentRuleAsync ve
        // ApplyAsync'te (age biliniyor) yapılıyor, bkz. aşağıdaki ApplyAsync.
        var participationLimitText = FacilityParticipationLimit.Text(limitType, limitCount);

        // Kullanıcı isteği (2026-10-04): önkoşul kurs + özel sorular — citizen UI başvuru
        // formunu/uyarısını kurabilsin diye detay cevabında da taşınır (gerçek zorlama
        // ApplyAsync'tedir, bu sadece UI'ın önden bilgilendirmesi içindir).
        var groupRules = FacilityDocumentRules.ParseGroupRules(group.ConditionsJson);
        string? prerequisiteGroupName = null;
        var prerequisiteMet = true;
        if (groupRules.PrerequisiteGroupId is Guid prereqGroupId)
        {
            var prereqGroup = await uow.FacilityGroups.GetByIdAsync(prereqGroupId, ct);
            prerequisiteGroupName = prereqGroup?.Name;
            prerequisiteMet = actor is not null && (await uow.FacilityRegistrations.FindAsync(
                r => r.GroupId == prereqGroupId && r.Tckn == actor.Tckn
                  && (r.Status == "active" || r.Status == "expired"), ct)).Count > 0;
        }
        var customQuestionDtos = groupRules.CustomQuestions
            .Select(q => new CitizenFacilityCustomQuestionDto(q.Id, q.Question, q.Required))
            .ToList();

        return new CitizenFacilityGroupDetailDto(
            card.Id, card.Module, card.ModuleLabel, card.FacilityName, card.BranchName,
            card.Name, card.Type, card.Gender, card.AgeMin, card.AgeMax,
            card.Capacity, card.RegisteredCount, card.ReserveCapacity, card.WaitlistCount,
            card.PeriodStart, card.PeriodEnd,
            card.ScheduleSummary, card.FeeText, card.Eligible, card.AlreadyApplied,
            string.IsNullOrWhiteSpace(group.InstructorName) ? null : group.InstructorName,
            serviceFacility?.Name,
            string.IsNullOrWhiteSpace(serviceFacility?.Address) ? null : serviceFacility!.Address,
            serviceFacility?.Latitude,
            serviceFacility?.Longitude,
            serviceFacility?.ParkingCapacity is > 0,
            serviceFacility?.ParkingCapacity is > 0 ? serviceFacility.ParkingCapacity : null,
            serviceFacility?.ParkingCapacity is > 0 ? serviceFacility.ParkingType.ToString() : null,
            group.Description, ReadConditions(group.ConditionsJson),
            sessionDtos, applicants,
            rule.RequiresApplicationDocuments, rule.DocumentsRequiredMessage,
            rule.DocumentTypes.Select(t => new CitizenFacilityDocumentTypeDto(t.Key, t.Label, t.Required, t.AllowedFormats)).ToList(),
            participationLimitText,
            ReadConditionsKey(group.ConditionsJson, "requirements"),
            ReadConditionsKey(group.ConditionsJson, "applicationConditions"),
            ReadConditionsKey(group.ConditionsJson, "aboutHtml"),
            ReadConditionsKey(group.ConditionsJson, "imageUrl") ?? facilityImages.Primary,
            facilityImages.All,
            card.ApplicationOpen,
            card.ApplicationClosedReason,
            card.ApplicationStartDate,
            card.ApplicationEndDate,
            groupRules.PrerequisiteGroupId,
            prerequisiteGroupName,
            prerequisiteMet,
            customQuestionDtos);
    }

    public async Task<CitizenFacilityApplicationDto> ApplyAsync(string module, Guid groupId, CitizenFacilityApplyRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(ApplyAsync), new { module, groupId, req.ParticipantId });

        if (!FacilityModuleRegistry.IsValid(module))
            throw new NotFoundException("Geçersiz hizmet türü.", "INVALID_MODULE");

        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participantId = req.ParticipantId ?? actorId;
        if (participantId != actorId)
        {
            var family = await uow.Participants.GetChildrenAsync(actorId, ct);
            if (family.All(c => c.Id != participantId))
                throw new ForbiddenException("Bu kişi adına işlem yapamazsınız.", "APPLICANT_FORBIDDEN");
        }

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Başvuru yapılacak kişi bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (participant.Status != ParticipantStatus.Active)
            throw new ConflictException("Hesabınız aktif değil. Lütfen belediye ile iletişime geçin.", "ACCOUNT_NOT_ACTIVE");

        var group = await uow.FacilityGroups.GetByIdAsync(groupId, ct);
        if (group is null || group.Module != module || !group.IsActive)
            throw new NotFoundException("Program bulunamadı.", "GROUP_NOT_FOUND");

        var branch = await uow.FacilityBranches.GetByIdAsync(group.BranchId, ct);
        if (branch is null || branch.Module != module)
            throw new NotFoundException("Program bulunamadı.", "BRANCH_NOT_FOUND");
        if (!branch.IsActive)
            throw new ConflictException("Seçilen program şu anda pasif durumdadır. Başvuru yapılamaz.", "BRANCH_INACTIVE");

        if (group.ParentGroupId is Guid parentGroupId)
        {
            var parentGroup = await uow.FacilityGroups.GetByIdAsync(parentGroupId, ct);
            if (parentGroup is null || parentGroup.Module != module || !parentGroup.IsActive)
                throw new NotFoundException("Program bulunamadı.", "GROUP_NOT_FOUND");
        }

        var groupFacility = await uow.Facilities.GetByIdAsync(group.FacilityId, ct);
        if (groupFacility is null || !groupFacility.IsActive)
            throw new ConflictException("Bu tesis şu anda hizmet vermemektedir. Başvuru yapılamaz.", "FACILITY_INACTIVE");

        var windowBlock = Nexora.Domain.Common.FacilityApplicationWindow.Check(
            group.Type, group.ApplicationStartDate, group.ApplicationEndDate,
            group.PeriodStart, group.PeriodEnd, group.PeriodType, group.PeriodMonths,
            TurkeyTime.TodayDate());
        if (windowBlock is not null)
            throw new ConflictException(windowBlock.Value.Message, windowBlock.Value.Code);

        // Kural kaynağı tek yerde (FacilityEligibilityRules): admin panelden doğrudan kayıt ve
        // başvuru onaylama yolları da (FacilityRegistrationService.EnsureEligibilityAsync) aynı
        // sınıfı çağırır — iki yol ayrışamaz. Uyruk (TC/Yabancı) ve ikamet (Sultangazi/serbest)
        // bağımsız iki eksendir; eski sultangazi_only/foreign_only tek-eksen değerleri de
        // geriye dönük desteklenir.
        var age = Age(participant.BirthDate);
        var eligibility = Nexora.Domain.Common.FacilityEligibilityRules.CheckAll(
            group, participant, participant.Tckn, TurkeyTime.TodayDate(), SultangaziDistrictCode);
        if (eligibility is not null)
            throw new ConflictException(eligibility.Message, eligibility.ErrorCode);

        if (group.AcademyWhitelistEnabled && !FacilityAcademyWhitelist.IsAllowed(group.AcademyWhitelistTcknsJson, participant.Tckn))
            throw new ConflictException("Bu akademi grubuna yalnızca önceden tanımlı katılımcılar başvurabilir.", "ACADEMY_NOT_WHITELISTED");

        // basvuruhitetmeyenkurallar.md sonrası UI-envanteri: admin panelde "Tesis Özel > Yıllık
        // Katılım Şartları" (tesis bazında override edilebilen tarih penceresi + max başvuru + yaş
        // aralığı) tamamen ölüydü — admin panelin kendi banner'ı bunu "şu anda sadece kaydediliyor"
        // diye itiraf ediyordu. Artık gerçekten çalışıyor: tesis kendi ayarını kullanıyorsa
        // (UseGeneral=false) ve yearlyEnabled=true ise, tarih penceresi/max başvuru/yaş aralığı
        // fiilen uygulanıyor.
        var facilityScope = await uow.FacilitySettings.GetForFacilityAsync(group.FacilityId, ct);
        if (facilityScope is not null && !facilityScope.UseGeneral)
        {
            var yearly = Nexora.Application.Features.Facilities.FacilityYearlyWindow.Parse(facilityScope.SettingsJson);
            if (yearly.Enabled)
            {
                var todayY = TurkeyTime.TodayDate();
                if (yearly.StartDate.HasValue && todayY < yearly.StartDate.Value)
                    throw new ConflictException("Bu tesis için yıllık başvurular henüz açılmadı.", "YEARLY_APPLICATION_NOT_OPEN");
                if (yearly.EndDate.HasValue && todayY > yearly.EndDate.Value)
                    throw new ConflictException("Bu tesis için yıllık başvuru süresi sona erdi.", "YEARLY_APPLICATION_CLOSED");
                if (yearly.MinAge > 0 && age < yearly.MinAge)
                    throw new ConflictException($"Bu tesis için yıllık katılım şartı en az {yearly.MinAge} yaş.", "YEARLY_AGE_NOT_ELIGIBLE");
                if (yearly.MaxAge > 0 && age > yearly.MaxAge)
                    throw new ConflictException($"Bu tesis için yıllık katılım şartı en fazla {yearly.MaxAge} yaş.", "YEARLY_AGE_NOT_ELIGIBLE");
                if (yearly.MaxApplications > 0)
                {
                    var facilityYearApps = await uow.FacilityApplications.CountAsync(
                        a => !a.IsDeleted && a.FacilityId == group.FacilityId && a.Status != "rejected"
                          && a.AppliedAt.Year == todayY.Year, ct);
                    if (facilityYearApps >= yearly.MaxApplications)
                        throw new ConflictException("Bu tesis için bu yılki maksimum başvuru sayısına ulaşıldı.", "YEARLY_QUOTA_FULL");
                }
            }
        }

        var limitSettings = await uow.FacilitySettings.GetGeneralAsync(module, ct);

        // basvuruhitetmeyenkurallar.md sonrası UI-envanteri: admin panelde "Genel Ayarlar > Katılım
        // Sınıfları" (yaşa göre ikamet/sağlık raporu/veli onayı şartı + katılım-limiti override
        // tanımlayan liste) kaydediliyordu ama başvuru sırasında hiç okunmuyordu — vatandaş,
        // admin'in tanımladığı yaş-sınıfı kurallarını (örn. "65+ Kıdemli sınıfı sağlık raporu ister")
        // hiç karşılamadan başvurabiliyordu. Artık katılımcının yaşına uyan AKTİF sınıf bulunup,
        // o sınıfın ikamet/sağlık-raporu/veli-onayı/katılım-limiti-override kuralları uygulanıyor.
        // Not: ücret muafiyeti/indirimi kasıtlı olarak enforce edilmiyor — sistemde gerçek bir
        // ödeme/tahsilat akışı yok (bkz. FacilityParticipationClass.cs açıklaması).
        var participationClass = FacilityParticipationClass.ResolveForAge(limitSettings?.SettingsJson, age);
        // K01/V06/Y05: dinamik katılım limiti tek kaynak guard'la uygulanır (admin/doğrudan-kayıt/import ile
        // AYNI sayım + kimlik-birleşim: ParticipantId ∪ TCKN, application ∪ application'sız kayıt).
        if (await HasActiveApplicationAsync(participantId, group.Id, ct))
            throw new ConflictException("Bu kişi bu programa zaten başvurdu.", "ALREADY_APPLIED");

        // Mükerrer başvuru limitten ÖNCE: aksi halde zaten başvurmuş kişi "katılım sınırına ulaşıldı" görüyordu.
        await participationLimitGuard.EnsureWithinLimitAsync(module, group, participantId, participant.Tckn, participant.BirthDate, null, ct);

        // Kullanıcı isteği (2026-10-05, Kadın ve Aile Merkezi): aynı programa (branch) başka bir
        // tesiste aktif başvuru/kayıt varken tekrar başvuru + modül-geneli yıllık toplam başvuru
        // tavanı — admin yolu (FacilityApplicationService) ile AYNI tek-kaynak guard.
        await crossProgramLimitGuard.EnsureAllowedAsync(module, group.BranchId, group.FacilityId, participantId, participant.Tckn, null, ct);

        // Kullanıcı isteği: bir programa başvuru reddedildiğinde (admin panelinde "Reddet" ile,
        // yalnızca "pending" durumdaki başvurular için kullanılabilir bir aksiyon) kişi artık o
        // SPESİFİK programa bir daha başvuramamalı — ama başka programlara serbestçe
        // başvurabilmeli. "expired" (dönem sonu) durumu ise farklıdır ve tekrar başvuruya izin
        // vermeye devam eder (bkz. FacilityApplication.ExpireMembership).
        if (await HasRejectedApplicationAsync(participantId, group.Id, ct))
            throw new ConflictException("Bu programa yaptığınız önceki başvuru reddedildiği için bu programa tekrar başvuramazsınız.", "APPLICATION_PREVIOUSLY_REJECTED");

        await EnsureNoScheduleConflictAsync(module, participantId, group, ct);

        // Kullanıcı isteği (2026-10-04): "önkoşul kurs" — örn. Arapça Seviye 2'ye yalnızca
        // Arapça Seviye 1'e (önkoşul grup) kayıtlı/kayıtlı-olmuş kişiler başvurabilir. Hem
        // hâlâ devam eden (active) hem dönemi bitmiş (expired — "tamamlanmış" sayılır) bir
        // kayıt yeterli; reddedilmiş/çıkarılmış (removed) bir önkoşul kaydı yeterli değildir.
        var groupRules = FacilityDocumentRules.ParseGroupRules(group.ConditionsJson);
        if (groupRules.PrerequisiteGroupId is Guid prereqId)
        {
            var prereqGroup = await uow.FacilityGroups.GetByIdAsync(prereqId, ct);
            var hasPrereq = (await uow.FacilityRegistrations.FindAsync(
                r => r.GroupId == prereqId && r.Tckn == participant.Tckn
                  && (r.Status == "active" || r.Status == "expired"), ct)).Count > 0;
            if (!hasPrereq)
                throw new ConflictException(
                    prereqGroup is not null
                        ? $"Bu programa başvurabilmek için önce \"{prereqGroup.Name}\" programına kayıtlı olmanız/tamamlamış olmanız gerekir."
                        : "Bu programa başvurabilmek için önkoşul programı tamamlamış olmanız gerekir.",
                    "PREREQUISITE_NOT_MET");
        }

        // Kullanıcı isteği (2026-10-04): grup bazında tanımlı özel evet/hayır soruları (örn.
        // Havuz'da "Yüzme biliyor musunuz?") — zorunlu işaretlenenler yanıtlanmadan başvuru
        // kabul edilmez.
        var customAnswersJson = req.CustomAnswers is { Count: > 0 }
            ? JsonSerializer.Serialize(req.CustomAnswers, JsonOpts)
            : "{}";
        var missingAnswers = FacilityDocumentRules.MissingRequiredAnswers(groupRules.CustomQuestions, customAnswersJson);
        if (missingAnswers.Count > 0)
            throw new ConflictException(
                $"Şu soruların yanıtlanması zorunludur: {string.Join(", ", missingAnswers.Select(q => q.Question))}.",
                "CUSTOM_QUESTIONS_REQUIRED");

        var rule = await ResolveGroupDocumentRuleAsync(module, group, ct);
        if (participationClass is not null)
        {
            var extraTypes = new List<FacilityDocumentType>(rule.DocumentTypes);
            if (participationClass.RequiresResidence && !extraTypes.Any(t => string.Equals(t.Key, "residence", StringComparison.OrdinalIgnoreCase)))
                extraTypes.Add(new FacilityDocumentType("residence", "İkametgâh Belgesi", true));
            if (participationClass.RequiresHealthReport && !extraTypes.Any(t => string.Equals(t.Key, "health", StringComparison.OrdinalIgnoreCase)))
                extraTypes.Add(new FacilityDocumentType("health", "Sağlık Raporu", true));
            if (extraTypes.Count != rule.DocumentTypes.Count)
                rule = rule with { RequiresApplicationDocuments = true, RequiredDocumentTypes = extraTypes, DocumentsRequiredMessage = rule.DocumentsRequiredMessage ?? $"{participationClass.Label} sınıfı için gerekli evrakların yüklenmesi zorunludur." };

            // basvuruhitetmeyenkurallar.md sonrası UI-envanteri: "Veli/Vasi Onayı" kuralı — sınıf
            // 18 yaş altı için veli onayı istiyorsa ve başvuru bizzat katılımcının kendi hesabından
            // (actorId == participantId, yani vatandaş kendi adına, veli hesabından değil) yapılıyorsa
            // reddedilir. Bir veli/ebeveyn hesabından (actorId != participantId, çocuk adına) yapılan
            // başvuru zaten fiilen veli onayı taşır, engellenmez.
            if (participationClass.RequiresParentalConsent && age < 18 && participantId == actorId)
                throw new ConflictException($"{participationClass.Label} sınıfı için başvuru veli/vasi hesabından yapılmalıdır.", "GUARDIAN_CONSENT_REQUIRED");
        }

        var documents = req.Documents ?? [];
        var verifiedDocuments = new List<CitizenFacilityApplyDocument>();
        foreach (var doc in documents)
        {
            if (string.IsNullOrWhiteSpace(doc.Type) || string.IsNullOrWhiteSpace(doc.ObjectName)) continue;
            if (await fileStorage.ExistsAsync(doc.ObjectName, DocumentsBucket, ct))
                verifiedDocuments.Add(doc);
        }
        FacilityDocumentRules.EnsureRequiredProvided(rule, verifiedDocuments.Select(d => d.Type));
        var documentsJson = JsonSerializer.Serialize(verifiedDocuments, JsonOpts);

        var guardianPhone = participant.GuardianPhone;
        if (age < 18 && string.IsNullOrWhiteSpace(guardianPhone) && participantId != actorId)
        {
            var actor = await uow.Participants.GetByIdAsync(actorId, ct);
            guardianPhone = actor?.Phone;
        }

        var autoApprove = group.AutoApprove;

        var application = FacilityApplication.Create(new FacilityApplicationData(
            module, group.FacilityId, group.BranchId, group.Id, participant.Id,
            participant.FullName, participant.Tckn, participant.Phone ?? "", participant.Email,
            participant.BirthDate, guardianPhone, documentsJson, customAnswersJson), "pending");

        var applicationStatus = "pending";

        await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.FacilityApplications.AddAsync(application, ct);
            await uow.SaveChangesAsync(ct);

            if (autoApprove)
            {
                var reg = await registrationService.RegisterAsync(module, new RegisterParticipantRequest(
                    group.Id, application.Id, participant.Id,
                    participant.FullName, participant.Tckn, participant.Phone ?? "",
                    participant.BirthDate, guardianPhone), ct);
                if (reg.Kind == "reserve")
                {
                    application.Waitlist(currentUser.Name);
                    applicationStatus = "waitlist";
                }
                else
                {
                    application.Approve(currentUser.Name);
                    applicationStatus = "approved";
                }
                uow.FacilityApplications.Update(application);
            }
            else
            {
                await registrationService.EnsureCapacityAvailableAsync(module, group.Id, null, ct);
            }

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            Result = LogResult.Success,
            EntityType = "FacilityApplication",
            EntityId = application.Id,
            Module = module,
            Description = $"Vatandaş başvuru yaptı: {group.Name} ({participant.FullName})",
            ActorUserId = actorId,
            ActorUserName = currentUser.Name,
        }, ct);

        var facility = await uow.Facilities.GetByIdAsync(group.FacilityId, ct);
        var facilityName = facility?.Name ?? "—";
        var branchName = (await uow.FacilityBranches.GetByIdAsync(group.BranchId, ct))?.Name ?? "—";

        var statusEvent = applicationStatus switch
        {
            "approved" => "application_approved",
            "waitlist" => "application_waitlisted",
            _ => "application_pending",
        };
        // Kullanıcı bulgusu (2026-09-22): burada sabit "Başvurunuz alındı" in-app bildirimi
        // oluşturuluyordu VE hemen altında notification.SendStatusAsync(statusEvent, ...) da
        // duruma göre kendi in-app bildirimini (ör. otomatik onaylandıysa "Başvurunuz onaylandı")
        // oluşturuyordu — aynı başvuru için realtime üzerinden art arda iki bildirim/toast
        // geliyordu ("Başvurunuz onaylandı" + "Başvurunuz alındı"). SendStatusAsync zaten her
        // duruma (approved/waitlisted/pending) uygun doğru başlık+mesajı gönderdiği için buradaki
        // ayrı/sabit bildirim kaldırıldı, tekilleştirme SendStatusAsync'e bırakıldı.
        // Denetim bulgusu 2026-08-08 (badger ajanı, docs/sablon-sistemi-baglanti-denetimi-2026-08-08.md):
        // vatandaş başvuru yolunda (bu metod) SessionDate/SessionTime hiç geçirilmiyordu — "en yakın
        // seans" bilgisi ne SMS'te ne in-app bildirimde görünmüyordu. GetNextUpcomingSessionAsync
        // (mevcut GetFirstSessionStartAsync'in aksine yalnızca bugün ve sonrasını dikkate alır) burada
        // da kullanılıyor, admin yolundaki (FacilityApplicationService) düzeltmeyle tutarlı.
        var (applySessionDate, applySessionTime) = await GetNextUpcomingSessionAsync(group.Id, ct);
        await notification.SendStatusAsync(module, statusEvent, participant.Phone, participant.FullName,
            new FacilityNotificationVars(GroupName: group.Name, FacilityName: facilityName, SessionDate: applySessionDate, SessionTime: applySessionTime), ct, participant.Id);

        var sfInfo = await LoadServiceFacilityInfoByFacilityAsync([group.FacilityId], ct);
        sfInfo.TryGetValue(group.FacilityId, out var sfEntry);
        var firstSessionStart = await GetFirstSessionStartAsync(group.Id, ct);
        // D08/V08: başvuru anında aktif asıl kayıt oluştuysa (otomatik onay) kişisel hak tarihleri gösterilir;
        // pending/yedekte kayıt yok → program dönemi (hak kazanılmış gibi gösterilmez).
        var applyReg = (await uow.FacilityRegistrations.FindAsync(r => r.ApplicationId == application.Id && r.Status == "active" && r.Kind == "main", ct)).FirstOrDefault();
        return BuildApplicationDto(application, group, facilityName, branchName, participant, actorId,
            sfEntry?.Name, sfEntry?.Address, sfEntry?.Latitude, sfEntry?.Longitude, sfEntry?.ParkingCapacity, sfEntry?.ParkingType?.ToString(), ComputeCanCancel(application.Status, group, firstSessionStart), applyReg);
    }

    public async Task<CitizenFacilityDocumentUploadResult> UploadDocumentAsync(string module, Guid? groupId, Stream stream, string fileName, string contentType, CancellationToken ct, string? documentType = null)
    {
        if (!FacilityModuleRegistry.IsValid(module))
            throw new NotFoundException("Geçersiz hizmet türü.", "INVALID_MODULE");

        var participantId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        // COM-DOC-002: yürütülebilir/tehlikeli dosya türleri (.exe, .apk, çift uzantı vb.) reddedilir.
        // Daha önce hiçbir tip/uzantı kontrolü yoktu — bir .exe dosyası "Sağlık Raporu" evrakı olarak
        // kabul edilip başvuruyu onaylatabiliyordu (canlı testte kanıtlandı).
        Nexora.Application.Common.SafeUploadValidation.EnsureSafeDocument(fileName, contentType);

        // Kullanıcı isteği (2026-10-04): evrak yükleme revizyonu — "yüklenecek pdf/jpg/png
        // zorunluluğu olacak ve optimize edilerek yüklenecek ve güvenlik kontrolünden geçirilecek":
        //   1) Dosyanın GERÇEK içeriği (beyan edilen Content-Type/uzantı değil, magic-byte imzası)
        //      pdf/jpg/png'den biri olmalı; grup+evrak-tipi için admin panelde daraltılmış bir
        //      format listesi (documentFormats) tanımlıysa ona da uymalı.
        //   2) Görseller (jpg/png) WebP'ye dönüştürülüp optimize edilerek depolanır (MobileConfigService/
        //      MobileMenuService ile AYNI WebpImageConverter — PDF'ler olduğu gibi bırakılır, PDF
        //      optimizasyonu bu projenin kapsamında değil).
        //   3) Güvenlik taraması (IMalwareScanService — ClamAvMalwareScanService/NoOp) uygulanır.
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, ct);
        var rawBytes = buffer.ToArray();
        if (rawBytes.Length == 0)
            throw new ConflictException("Yüklenen dosya boş.", "FILE_REQUIRED");

        IReadOnlyList<string>? allowedFormats = null;
        if (groupId.HasValue && !string.IsNullOrWhiteSpace(documentType))
        {
            var uploadGroup = await uow.FacilityGroups.GetByIdAsync(groupId.Value, ct);
            if (uploadGroup is not null)
            {
                var uploadRule = await ResolveGroupDocumentRuleAsync(module, uploadGroup, ct);
                allowedFormats = uploadRule.DocumentTypes
                    .FirstOrDefault(t => string.Equals(t.Key, documentType, StringComparison.OrdinalIgnoreCase))
                    ?.AllowedFormats;
            }
        }
        Nexora.Application.Common.FileSignatureValidator.EnsureValidDocumentFormat(rawBytes, allowedFormats);

        buffer.Position = 0;
        var scanResult = await malwareScan.ScanAsync(buffer, fileName, ct);
        if (!scanResult.IsClean)
            throw new ConflictException(
                "Bu dosya güvenlik taramasından geçemedi ve yüklenemedi. Lütfen dosyanızı kontrol edip tekrar deneyin.",
                "MALWARE_DETECTED");

        buffer.Position = 0;
        var (optimizedStream, optimizedFileName, optimizedContentType, ownsStream) =
            await WebpImageConverter.ConvertAsync(buffer, fileName, contentType, ct);

        var keyPrefix = $"{module}/{(groupId.HasValue ? groupId.Value.ToString() : "general")}/{participantId}";
        var upload = await fileStorage.UploadAsync(optimizedStream, optimizedFileName, optimizedContentType, DocumentsBucket, ct, keyPrefix: keyPrefix);
        if (ownsStream) await optimizedStream.DisposeAsync();
        var url = FileUrl.Private(upload.ObjectName);
        return new CitizenFacilityDocumentUploadResult(upload.ObjectName, optimizedFileName, url);
    }

    public async Task<PagedResult<CitizenFacilityApplicationDto>> GetApplicationsAsync(CitizenFacilityApplicationListParams p, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participantIds = new List<Guid> { actorId };
        var tckns = new List<string>();
        var self = await uow.Participants.GetByIdAsync(actorId, ct);
        if (!string.IsNullOrWhiteSpace(self?.Tckn)) tckns.Add(self!.Tckn);
        if (string.Equals(p.Scope, "family", StringComparison.OrdinalIgnoreCase))
        {
            var children = await uow.Participants.GetChildrenAsync(actorId, ct);
            participantIds.AddRange(children.Select(c => c.Id));
            tckns.AddRange(children.Where(c => !string.IsNullOrWhiteSpace(c.Tckn)).Select(c => c.Tckn));
        }

        participantIds = participantIds.Distinct().ToList();

        // TCKN de geçiliyor: engelleme kontrolü kişiyi TCKN ile tanıdığı için liste de tanımalı,
        // aksi halde "engelliyor ama listede yok" durumu oluşuyordu (bkz. docs/hata.md #5/#7/#8).
        var paged = await uow.FacilityApplications.GetByParticipantsAsync(
            participantIds, p.Module, p.Status, p.PageResolved, p.LimitResolved, ct, p.Search, tckns.Distinct().ToList());
        var items = await MapManyAsync(paged.Items, actorId, ct);

        return new PagedResult<CitizenFacilityApplicationDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<CitizenTurnstileQrDto>> GetTurnstileQrAsync(string? module, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        if (!string.IsNullOrWhiteSpace(module) && !FacilityModuleRegistry.IsValid(module))
            throw new NotFoundException("Geçersiz hizmet türü.", "INVALID_MODULE");

        var participants = new List<Participant>();
        var self = await uow.Participants.GetByIdAsync(actorId, ct);
        if (self is not null) participants.Add(self);
        participants.AddRange(await uow.Participants.GetChildrenAsync(actorId, ct));

        var windowSeconds = config.GetValue("QrSettings:RotationSeconds", 60);
        var result = new List<CitizenTurnstileQrDto>();
        var seen = new HashSet<Guid>();

        foreach (var p in participants)
        {
            if (string.IsNullOrWhiteSpace(p.Tckn)) continue;
            var regs = await uow.FacilityRegistrations.GetActiveMainByTcknAsync(p.Tckn, ct);
            foreach (var reg in regs)
            {
                if (reg.Status != "active" || !seen.Add(reg.Id)) continue;
                if (!string.IsNullOrWhiteSpace(module) && reg.Module != module) continue;

                var token = qr.Generate(reg.Id, $"facility:{reg.Module}", windowSeconds);
                var facility = await uow.Facilities.GetByIdAsync(reg.FacilityId, ct);
                var group = await uow.FacilityGroups.GetByIdAsync(reg.GroupId, ct);

                result.Add(new CitizenTurnstileQrDto(
                    reg.Id,
                    reg.Module,
                    FacilityModuleLabels.For(reg.Module),
                    facility?.Name ?? "",
                    group?.Name ?? "",
                    token,
                    windowSeconds));
            }
        }

        return result;
    }

    public async Task CancelApplicationAsync(Guid applicationId, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var application = await uow.FacilityApplications.GetByIdAsync(applicationId, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");

        var allowedIds = new List<Guid> { actorId };
        var children = await uow.Participants.GetChildrenAsync(actorId, ct);
        allowedIds.AddRange(children.Select(c => c.Id));

        if (!application.ParticipantId.HasValue || !allowedIds.Contains(application.ParticipantId.Value))
            throw new ForbiddenException("Bu başvuruya erişim yetkiniz yok.", "APPLICATION_FORBIDDEN");

        if (application.Status == "rejected")
            throw new ConflictException("Reddedilen kayıt iptal edilemez.", "NOT_CANCELABLE");

        // Bulgu (2026-10-04, canlı QA denetimi): zaten iptal edilmiş bir başvuruya tekrar
        // çağrılınca sessizce no-op olarak başarılı döner (Travel/Event'teki idempotent
        // fix'le tutarlı — çift tıklama/network retry güvenli, hata göstermez).
        if (application.Status == "cancelled")
            return;

        var programGroup = application.GroupId.HasValue
            ? await uow.FacilityGroups.GetByIdAsync(application.GroupId.Value, ct)
            : null;
        var firstSessionStart = programGroup is not null
            ? await GetFirstSessionStartAsync(programGroup.Id, ct)
            : null;
        if (!ComputeCanCancel(application.Status, programGroup, firstSessionStart))
            throw new ConflictException("İlk seans başladıktan sonra kayıt iptal edilemez.", "CANCEL_WINDOW_PASSED");

        if (application.Status == "pending")
        {
            // Bulgu (2026-10-04, canlı QA denetimi — nihai prod-öncesi tur): burada önceden
            // uow.FacilityApplications.Delete() çağrılıyordu, yani IsDeleted=true oluyordu.
            // Global query filter (!IsDeleted) yüzünden başvuru "Başvurularım" listesinden
            // TAMAMEN kayboluyordu (görünüşte hiç var olmamış gibi) — Event/Travel'daki
            // "C6 düzeltmesi" bug'ının aynısı, Facility'ye hiç backport edilmemiş. Artık
            // Event/Travel'daki doğru desenle tutarlı: soft-delete yerine Status="cancelled"
            // set edilip kayıt geçmişte görünür bırakılıyor.
            application.Cancel();
            uow.FacilityApplications.Update(application);
            await uow.SaveChangesAsync(ct);

            if (application.ParticipantId is Guid pendingPid)
                await inApp.CreateAsync(pendingPid, "Başvurunuz iptal edildi",
                    $"{programGroup?.Name ?? "Program"} programına başvurunuz iptal edildi.", "application",
                    "facility", application.Id.ToString(), programGroup?.Name, null, "İptal Edildi", ct);

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Cancel,
                Result = LogResult.Success,
                EntityType = "FacilityApplication",
                EntityId = application.Id,
                Module = application.Module,
                Description = "Vatandaş başvurusunu iptal etti",
                ActorUserId = actorId,
                ActorUserName = currentUser.Name,
            }, ct);
            return;
        }

        var group = application.GroupId.HasValue
            ? await uow.FacilityGroups.GetByIdAsync(application.GroupId.Value, ct)
            : null;
        var groupName = group?.Name ?? "Program";

        var registration = await FindRegistrationAsync(application, ct);

        IReadOnlyList<FacilityDeferredNoticeDto> deferredNotices = [];
        await uow.BeginTransactionAsync(ct);
        try
        {
            if (registration is not null)
                // Y02: dış transaction içinde çıkarma bildirimi göndermez; yükselen yedeğin bildirimi dahil
                // ertelenmiş bildirimleri toplayıp commit sonrası gönderiyoruz (kaybolmasın).
                // NOT: RemoveForBatchAsync bağlı FacilityApplication'ı dahili olarak Reject() ile
                // kapatır (admin/devamsızlık çıkarma akışıyla paylaşılan ortak kod) — vatandaşın
                // kendi iptalinde bu YANLIŞ anlam taşır ("reddedildi" değil, kendi isteğiyle
                // "iptal etti"). Bu yüzden hemen altta application.Cancel() ile status
                // "cancelled"a çevrilip asıl doğru anlama düzeltiliyor (aynı tracked instance,
                // SaveChanges'ten önce son değer kazanır).
                deferredNotices = await registrationService.RemoveForBatchAsync(application.Module, registration.Id, "Vatandaş kaydını iptal etti", ct);

            // Bulgu (2026-10-04, canlı QA denetimi): bkz. yukarıdaki "pending" dalındaki aynı not.
            // Önceden Delete() (soft-delete) çağrılıyordu, kayıt geçmişten tamamen kayboluyordu.
            application.Cancel();
            uow.FacilityApplications.Update(application);

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        // Y02: commit sonrası — yükselen yedeğe terfi bildirimi + iptal edilen kayda çıkarma bildirimi.
        await registrationService.SendDeferredNoticesAsync(deferredNotices, ct);

        if (application.ParticipantId is Guid cancelPid)
            await inApp.CreateAsync(cancelPid, "Kaydınız iptal edildi",
                $"{groupName} programındaki kaydınız iptal edildi.", "application",
                "facility", application.Id.ToString(), groupName, null, "İptal Edildi", ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Cancel,
            Result = LogResult.Success,
            EntityType = "FacilityApplication",
            EntityId = application.Id,
            Module = application.Module,
            Description = $"Vatandaş onaylı kaydını iptal etti: {groupName}",
            ActorUserId = actorId,
            ActorUserName = currentUser.Name,
        }, ct);
    }

    private async Task<DateTime?> GetFirstSessionStartAsync(Guid groupId, CancellationToken ct)
    {
        var sessions = await uow.FacilitySessions.GetByGroupAsync(groupId, ct);
        var first = sessions.Where(s => !s.IsCancelled).OrderBy(s => s.Date).ThenBy(s => s.StartTime).FirstOrDefault();
        if (first is null) return null;
        var time = TimeSpan.TryParse(first.StartTime, out var parsed) ? parsed : TimeSpan.Zero;
        return first.Date.Date + time;
    }

    // Denetim bulgusu 2026-08-08 (badger ajanı): FacilityApplicationService.GetNextSessionDateTimeAsync
    // ile aynı mantık (bugün ve sonrasını dikkate alır, dd.MM.yyyy + saat string olarak döner) —
    // bildirim placeholder'ları ({{seans_tarihi}}/{{seans_saati}}) için kullanılıyor.
    // Kullanıcı talebi (2026-09-25, aynı ailede paralel düzeltme): hak kazanılan GÜN HARİÇ sonraki
    // ilk seans bildirilmeli — "> today" (eskiden ">= today" idi).
    private async Task<(string? Date, string? Time)> GetNextUpcomingSessionAsync(Guid groupId, CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        var sessions = await uow.FacilitySessions.GetByGroupAsync(groupId, ct);
        var next = sessions
            .Where(s => !s.IsCancelled && s.Date.Date > today)
            .OrderBy(s => s.Date).ThenBy(s => s.StartTime)
            .FirstOrDefault();
        if (next is null) return (null, null);
        return (next.Date.ToString("dd.MM.yyyy"), next.StartTime);
    }

    private static bool ComputeCanCancel(string status, FacilityGroup? group, DateTime? firstSessionStart)
    {
        // Bulgu (2026-10-04, canlı QA denetimi): "cancelled" statüsü eklenene kadar bu
        // kontrol hiç gerekmiyordu (iptal edilmiş kayıt soft-delete edilip tamamen
        // kayboluyordu). Artık geçmişte görünür kaldığı için burada da elenmeli, yoksa
        // mobil "İptal Et" butonunu yanlışlıkla tekrar gösterebilir.
        if (status is "rejected" or "cancelled") return false;
        if (firstSessionStart is not null) return TurkeyTime.NowWallClock() < firstSessionStart.Value;
        if (group?.PeriodStart is not null) return group.PeriodStart.Value.Date >= TurkeyTime.TodayDate();
        return true;
    }

    private async Task<FacilityRegistration?> FindRegistrationAsync(FacilityApplication application, CancellationToken ct)
    {
        var byApplication = await uow.FacilityRegistrations.FindAsync(
            r => r.ApplicationId == application.Id && r.Status != "removed", ct);
        var match = byApplication.FirstOrDefault();
        if (match is not null) return match;

        if (!application.GroupId.HasValue || !application.ParticipantId.HasValue) return null;

        var byGroupParticipant = await uow.FacilityRegistrations.FindAsync(
            r => r.GroupId == application.GroupId.Value
                && r.ParticipantId == application.ParticipantId.Value
                && r.Status != "removed", ct);
        return byGroupParticipant.FirstOrDefault();
    }

    // Denetim bulgusu (docs/tesis-spor-egitim-derin-test-2026-08-31.md P1-4, 2026-09-05 canlı
    // testle doğrulandı): admin path'teki (FacilityRegistrationService.EnsureNoSameDayConflictAsync)
    // aynı kök nedenin vatandaş tarafındaki eşleniği — a.Module == module filtresi kontrolü kendi
    // modülüyle sınırlıyordu. Kişi aynı gün/saatte iki farklı modülde (ör. sports + pool) asıl üye
    // olabiliyordu; kural "aynı anda iki yerde olunamaz" fiziksel bir kısıt olduğu için modülden
    // bağımsız uygulanmalı. Modül filtresi kaldırıldı.
    private async Task EnsureNoScheduleConflictAsync(string module, Guid participantId, FacilityGroup target, CancellationToken ct)
    {
        if (target.PeriodStart is null || target.PeriodEnd is null) return;
        var targetDays = FacilityScheduleHelper.ParseDays(target.ScheduleJson);
        if (targetDays.Count == 0) return;

        // "Aktif başvuru" tanımı artık tek kaynaktan (FacilityApplicationStatuses.IsActive) geliyor;
        // Başvurularım listesi de aynı yüklemi kullanır. Böylece "engelliyor ama listede yok"
        // durumu yapısal olarak imkansız (bkz. docs/hata.md #5/#7/#8).
        // !a.IsDeleted (2026-09-23): iptal edilen başvuru Delete() ile soft-delete ediliyor, ancak
        // FacilityApplication'da global query filter olmadığı için bu kayıtlar sorgulara sızıyordu.
        // Sonuç: kişi başvurusunu iptal etse bile o saat "dolu" sayılıp yeni başvuru engelleniyordu.
        var existing = (await uow.FacilityApplications.FindAsync(
            a => !a.IsDeleted && a.ParticipantId == participantId && a.GroupId != target.Id, ct))
            .Where(a => FacilityApplicationStatuses.IsActive(a.Status));

        foreach (var app in existing)
        {
            if (!app.GroupId.HasValue) continue;
            var other = await uow.FacilityGroups.GetByIdAsync(app.GroupId.Value, ct);
            if (other is null || other.PeriodStart is null || other.PeriodEnd is null) continue;
            if (!FacilityScheduleHelper.PeriodsOverlap(target.PeriodStart.Value, target.PeriodEnd.Value, other.PeriodStart.Value, other.PeriodEnd.Value)) continue;
            var overlap = FacilityScheduleHelper.FindOverlap(target.ScheduleJson, other.ScheduleJson);
            if (overlap is null) continue;

            // Kişi "neden reddedildim" sorusunu sorabilsin diye çakışmanın gün/saatini yazıyoruz.
            // Hata raporu (docs/hata.md #5/#7/#8): engelleyen kayıt genellikle BAŞKA bir hizmet
            // türünde (ör. gençlik kampına başvururken spor kaydı) olduğu için vatandaş onu girdiği
            // modülün listesinde arayıp bulamıyor, "başvurum yok ama engelliyor" sanıyordu. Mesaj
            // artık hizmet türünü de söylüyor ve kaydın nerede görüneceğini tarif ediyor.
            // Program adı yalnızca kişi KENDİ kaydına bakıyorsa görünür; başkası (çocuk/aile ferdi)
            // adına başvuruda o kişinin başka programının adı ifşa edilmez, sadece randevu saati.
            var own = currentUser.Id == participantId;
            var otherModuleLabel = FacilityModuleLabels.For(app.Module);
            throw new ConflictException(
                own
                    ? $"{overlap.Describe()} saatinde {otherModuleLabel} hizmetindeki \"{other.Name}\" programında randevunuz var. Aynı gün ve saatte yalnızca bir programa başvurulabilir. Bu kaydınızı \"Başvurularım\" ekranında görebilir, iptal edip yeniden başvurabilirsiniz."
                    : $"Bu kişinin {overlap.Describe()} saatinde {otherModuleLabel} hizmetinde başka bir randevusu var. Aynı gün ve saatte yalnızca bir programa başvurulabilir. İlgili kayıt \"Başvurularım\" ekranında görünür.",
                "SCHEDULE_CONFLICT");
        }
    }

    // Kullanıcı isteği: dönemi/hakkı dolan (expired) bir üyeliğin başvurusu artık "aktif" sayılmamalı
    // — aksi halde kişi süresi dolduktan sonra aynı gruba/spora bir daha asla başvuramazdı.
    // !a.IsDeleted (2026-09-23): iptal edilen başvuru soft-delete ediliyor ve global query filter
    // olmadığı için burada hâlâ "aktif başvuru" sayılıyordu. Kişi başvurusunu iptal ettikten sonra
    // ALREADY_APPLIED hatası alıyor ama iptal ettiği kaydı "Başvurularım" ekranında göremiyordu.
    // Geçmiş yılda (örn. 2025) yapılmış hiçbir faaliyet/başvuru aktif yılı (2026) engellemez.
    private async Task<bool> HasActiveApplicationAsync(Guid participantId, Guid groupId, CancellationToken ct)
    {
        var currentYear = TurkeyTime.TodayDate().Year;
        return (await uow.FacilityApplications.FindAsync(
            a => !a.IsDeleted && a.GroupId == groupId && a.ParticipantId == participantId && a.AppliedAt.Year == currentYear, ct))
            .Any(a => FacilityApplicationStatuses.IsActive(a.Status));
    }

    // Kullanıcı isteği: bir programa yapılan başvuru reddedildiğinde kişi o SPESİFİK programa bir
    // daha başvuramamalı ve o programı keşfet ekranında görmemeli (ama diğer tüm programlara
    // serbestçe başvurabilmeli). "expired" (dönem sonu/hak bitişi) reddetme değildir, ayrı tutulur.
    // Geçmiş yıldaki retler aktif yılı etkilemez.
    private async Task<bool> HasRejectedApplicationAsync(Guid participantId, Guid groupId, CancellationToken ct)
    {
        var currentYear = TurkeyTime.TodayDate().Year;
        return (await uow.FacilityApplications.FindAsync(
            a => !a.IsDeleted && a.GroupId == groupId && a.ParticipantId == participantId && a.Status == "rejected" && a.AppliedAt.Year == currentYear, ct)).Any();
    }

    private async Task<HashSet<Guid>> RejectedGroupIdsAsync(Guid? participantId, List<Guid> groupIds, CancellationToken ct)
    {
        if (participantId is null || groupIds.Count == 0) return [];
        var currentYear = TurkeyTime.TodayDate().Year;
        var apps = await uow.FacilityApplications.FindAsync(
            a => !a.IsDeleted && a.GroupId != null && groupIds.Contains(a.GroupId.Value) && a.ParticipantId == participantId.Value && a.Status == "rejected" && a.AppliedAt.Year == currentYear, ct);
        return apps.Where(a => a.GroupId.HasValue).Select(a => a.GroupId!.Value).ToHashSet();
    }

    private async Task<HashSet<Guid>> AppliedGroupIdsAsync(Guid? participantId, List<Guid> groupIds, CancellationToken ct)
    {
        if (participantId is null || groupIds.Count == 0) return [];
        var currentYear = TurkeyTime.TodayDate().Year;

        // !a.IsDeleted (2026-09-23): bkz. HasActiveApplicationAsync — iptal edilen başvuru olmasa da
        // "zaten başvuruldu" görünüp keşfet ekranında program gizli kalmasın.
        var apps = await uow.FacilityApplications.FindAsync(
            a => !a.IsDeleted && a.GroupId != null && groupIds.Contains(a.GroupId.Value) && a.ParticipantId == participantId.Value && a.AppliedAt.Year == currentYear, ct);
        return apps
            .Where(a => a.GroupId.HasValue && FacilityApplicationStatuses.IsActive(a.Status))
            .Select(a => a.GroupId!.Value)
            .ToHashSet();
    }

    private async Task<Dictionary<Guid, string>> LoadFacilityNamesAsync(IEnumerable<Guid> facilityIds, CancellationToken ct)
    {
        var ids = facilityIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        return (await uow.Facilities.FindAsync(f => ids.Contains(f.Id), ct)).ToDictionary(f => f.Id, f => f.Name);
    }

    private sealed record ServiceFacilityInfo(
        string Name,
        string? Address,
        double? Latitude,
        double? Longitude,
        int? ParkingCapacity,
        FacilityParkingType? ParkingType,
        string? ImageUrl,
        List<string> Images);

    private static (string? Primary, List<string> All) ResolveImages(ServiceFacility s)
    {
        // Kayıtta Url boş bırakılıp object name Id'ye yazılıyor (bkz.
        // ServiceFacilityManagementService.ToImage); URL okuma anında üretilir.
        var urls = s.Images
            .OrderByDescending(i => i.IsPrimary)
            .Select(i => FileUrl.Public(string.IsNullOrWhiteSpace(i.Url) ? i.Id : i.Url))
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .ToList();
        return (urls.FirstOrDefault(), urls);
    }

    private async Task<Dictionary<Guid, ServiceFacilityInfo>> LoadServiceFacilityInfoByFacilityAsync(IEnumerable<Guid> facilityIds, CancellationToken ct)
    {
        var ids = facilityIds.Distinct().ToList();
        if (ids.Count == 0) return [];

        var facilities = await uow.Facilities.FindAsync(f => ids.Contains(f.Id), ct);
        var serviceFacilityIds = facilities
            .Where(f => f.ServiceFacilityId.HasValue)
            .Select(f => f.ServiceFacilityId!.Value)
            .Distinct()
            .ToList();
        if (serviceFacilityIds.Count == 0) return [];

        var serviceFacilities = (await uow.ServiceFacilities.FindAsync(s => serviceFacilityIds.Contains(s.Id), ct))
            .ToDictionary(s => s.Id, s =>
            {
                var (primary, all) = ResolveImages(s);
                return new ServiceFacilityInfo(
                    s.Name,
                    string.IsNullOrWhiteSpace(s.Address) ? null : s.Address,
                    s.Latitude,
                    s.Longitude,
                    s.ParkingCapacity > 0 ? s.ParkingCapacity : null,
                    s.ParkingCapacity > 0 ? s.ParkingType : null,
                    primary,
                    all);
            });

        var result = new Dictionary<Guid, ServiceFacilityInfo>();
        foreach (var f in facilities)
        {
            if (f.ServiceFacilityId.HasValue && serviceFacilities.TryGetValue(f.ServiceFacilityId.Value, out var info))
                result[f.Id] = info;
        }
        return result;
    }

    private async Task<Dictionary<Guid, string>> LoadBranchNamesAsync(IEnumerable<Guid> branchIds, CancellationToken ct)
    {
        var ids = branchIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        return (await uow.FacilityBranches.FindAsync(b => ids.Contains(b.Id), ct)).ToDictionary(b => b.Id, b => b.Name);
    }

    private async Task<Dictionary<Guid, string>> LoadFacilityNamesIncludingDeletedAsync(IEnumerable<Guid> facilityIds, CancellationToken ct)
    {
        var ids = facilityIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        return (await uow.Facilities.FindIncludingDeletedAsync(f => ids.Contains(f.Id), ct)).ToDictionary(f => f.Id, f => f.Name);
    }

    private async Task<Dictionary<Guid, string>> LoadBranchNamesIncludingDeletedAsync(IEnumerable<Guid> branchIds, CancellationToken ct)
    {
        var ids = branchIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        return (await uow.FacilityBranches.FindIncludingDeletedAsync(b => ids.Contains(b.Id), ct)).ToDictionary(b => b.Id, b => b.Name);
    }

    private CitizenFacilityGroupDto ToCard(FacilityGroup g, string facilityName, string branchName, Participant? participant, bool alreadyApplied, ServiceFacilityInfo? serviceFacilityInfo = null)
        => new(
            g.Id, g.Module, FacilityModuleLabels.For(g.Module),
            facilityName, branchName, g.Name, g.Type, g.Gender,
            g.AgeMin, g.AgeMax, g.Capacity, g.RegisteredCount,
            g.ReserveCapacity, g.WaitlistCount,
            g.PeriodStart, g.PeriodEnd,
            BuildScheduleSummary(g.ScheduleJson),
            BuildFeeText(g.FeeJson),
            participant is not null && IsEligible(g, participant),
            alreadyApplied,
            string.IsNullOrWhiteSpace(g.InstructorName) ? null : g.InstructorName,
            serviceFacilityInfo?.Name,
            serviceFacilityInfo?.Address,
            serviceFacilityInfo?.Latitude,
            serviceFacilityInfo?.Longitude,
            serviceFacilityInfo?.ParkingCapacity is > 0,
            serviceFacilityInfo?.ParkingCapacity,
            serviceFacilityInfo?.ParkingType?.ToString(),
            ApplicationOpen: WindowBlockOf(g) is null,
            ApplicationClosedReason: WindowBlockOf(g)?.Message,
            ApplicationStartDate: g.ApplicationStartDate,
            ApplicationEndDate: g.ApplicationEndDate,
            ImageUrl: serviceFacilityInfo?.ImageUrl,
            Images: serviceFacilityInfo?.Images);

    private static (string Code, string Message)? WindowBlockOf(FacilityGroup g)
        => Nexora.Domain.Common.FacilityApplicationWindow.Check(
            g.Type, g.ApplicationStartDate, g.ApplicationEndDate,
            g.PeriodStart, g.PeriodEnd, g.PeriodType, g.PeriodMonths,
            TurkeyTime.TodayDate());

    private async Task<List<CitizenFacilityApplicationDto>> MapManyAsync(List<FacilityApplication> apps, Guid actorId, CancellationToken ct)
    {
        if (apps.Count == 0) return [];

        var groupIds = apps.Where(a => a.GroupId.HasValue).Select(a => a.GroupId!.Value).Distinct().ToList();
        var groups = groupIds.Count == 0
            ? new Dictionary<Guid, FacilityGroup>()
            : (await uow.FacilityGroups.FindIncludingDeletedAsync(g => groupIds.Contains(g.Id), ct)).ToDictionary(g => g.Id);

        var facilities = await LoadFacilityNamesIncludingDeletedAsync(apps.Select(a => a.FacilityId), ct);
        var branches = await LoadBranchNamesIncludingDeletedAsync(apps.Select(a => a.BranchId), ct);
        var serviceFacilityInfo = await LoadServiceFacilityInfoByFacilityAsync(apps.Select(a => a.FacilityId), ct);

        var partIds = apps.Where(a => a.ParticipantId.HasValue).Select(a => a.ParticipantId!.Value).Distinct().ToList();
        var parts = partIds.Count == 0
            ? new Dictionary<Guid, Participant>()
            : (await uow.Participants.FindAsync(x => partIds.Contains(x.Id), ct)).ToDictionary(x => x.Id);

        var firstSessionByGroup = new Dictionary<Guid, DateTime?>();
        foreach (var gid in groupIds)
            firstSessionByGroup[gid] = await GetFirstSessionStartAsync(gid, ct);

        // D08/V08: başvuru→asıl kayıt eşlemesi TOPLU yüklenir (N+1 yok) — kişisel hak tarihleri için.
        // Aktif VEYA süresi bitmiş (expired) asıl kayıt dahil: süresi biten üye de kendi kişisel
        // tarihini görür, yanlışlıkla grup dönemine dönmez. Yalnız pending/yedekte kayıt yoktur.
        var appIdList = apps.Select(a => a.Id).ToList();
        var activeRegByApp = (await uow.FacilityRegistrations.FindAsync(
                r => r.ApplicationId != null && appIdList.Contains(r.ApplicationId.Value)
                    && (r.Status == "active" || r.Status == "expired") && r.Kind == "main", ct))
            .GroupBy(r => r.ApplicationId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.Status == "active").First());

        return apps.Select(a =>
        {
            var group = a.GroupId.HasValue ? groups.GetValueOrDefault(a.GroupId.Value) : null;
            var part = a.ParticipantId.HasValue ? parts.GetValueOrDefault(a.ParticipantId.Value) : null;
            serviceFacilityInfo.TryGetValue(a.FacilityId, out var sfInfo);
            var firstStart = a.GroupId.HasValue ? firstSessionByGroup.GetValueOrDefault(a.GroupId.Value) : null;
            return BuildApplicationDto(
                a, group,
                facilities.GetValueOrDefault(a.FacilityId, "—"),
                branches.GetValueOrDefault(a.BranchId, "—"),
                part, actorId,
                sfInfo?.Name,
                sfInfo?.Address,
                sfInfo?.Latitude,
                sfInfo?.Longitude,
                sfInfo?.ParkingCapacity,
                sfInfo?.ParkingType?.ToString(),
                ComputeCanCancel(a.Status, group, firstStart),
                activeRegByApp.GetValueOrDefault(a.Id));
        }).ToList();
    }

    private static CitizenFacilityApplicationDto BuildApplicationDto(
        FacilityApplication a, FacilityGroup? group, string facilityName, string branchName, Participant? part, Guid actorId, string? serviceFacilityName, string? serviceFacilityAddress, double? serviceFacilityLatitude, double? serviceFacilityLongitude, int? parkingCapacity, string? parkingType, bool canCancel, FacilityRegistration? registration = null)
    {
        List<CitizenFacilityApplicationDocumentDto>? documents = null;
        if (!string.IsNullOrWhiteSpace(a.DocumentsJson) && a.DocumentsJson != "[]")
        {
            try
            {
                var docs = JsonSerializer.Deserialize<List<CitizenFacilityApplyDocument>>(a.DocumentsJson, JsonOpts);
                if (docs is { Count: > 0 })
                    documents = docs.Select(d => new CitizenFacilityApplicationDocumentDto(d.Type, d.FileName, d.Label)).ToList();
            }
            catch { }
        }
        return new(
            a.Id, a.Module, FacilityModuleLabels.For(a.Module),
            a.GroupId, group?.Name ?? "", branchName, facilityName,
            a.Status, canCancel,
            // D08: aktif asıl kaydı varsa KİŞİSEL hak tarihleri (membershipStart/periodEnd) gösterilir;
            // yoksa (pending/yedek) programın genel dönemi — yedekteyken hak kazanılmış gibi gösterilmez.
            registration?.MembershipStart ?? group?.PeriodStart,
            registration?.PeriodEnd ?? group?.PeriodEnd,
            group is not null ? BuildScheduleSummary(group.ScheduleJson) : "",
            a.ParticipantId, part?.FullName ?? a.FullName,
            a.ParticipantId.HasValue && a.ParticipantId.Value == actorId,
            a.AppliedAt,
            string.IsNullOrWhiteSpace(group?.InstructorName) ? null : group!.InstructorName,
            serviceFacilityName,
            serviceFacilityAddress,
            serviceFacilityLatitude,
            serviceFacilityLongitude,
            parkingCapacity is > 0,
            parkingCapacity,
            parkingType,
            documents,
            a.RejectReason);
    }

    // Denetim bulgusu (2026-09-05): Bu metot yalnızca cinsiyet+yaş kontrol ediyordu, ikamet/uyruk
    // (residencyMode: sultangazi_only vb.) hiç kontrol edilmiyordu — halbuki gerçek başvuru yolu
    // (ApplyAsync, satır ~325) CheckAll ile ikameti de kontrol ediyor. Sonuç: grup detay ekranında
    // "uygun" (eligible=true) görünen bir vatandaş, gerçekte başvurunca 409 RESIDENCY_NOT_ELIGIBLE
    // ile reddediliyordu — UI ile gerçek davranış arasında tutarsızlık. Artık aynı kural kaynağı
    // (FacilityEligibilityRules.CheckAll) kullanılıyor, ApplyAsync ile birebir aynı sonucu üretir.
    private bool IsEligible(FacilityGroup g, Participant participant)
        => Nexora.Domain.Common.FacilityEligibilityRules.CheckAll(
            g, participant, participant.Tckn, TurkeyTime.TodayDate(), SultangaziDistrictCode) is null;

    private string? IneligibleReason(FacilityGroup g, Participant participant)
    {
        var violation = Nexora.Domain.Common.FacilityEligibilityRules.CheckAll(
            g, participant, participant.Tckn, TurkeyTime.TodayDate(), SultangaziDistrictCode);
        if (violation is null) return null;

        return violation.ErrorCode switch
        {
            "GENDER_NOT_ELIGIBLE" => g.Gender == "male" ? "Yalnızca erkek katılımcılar" : "Yalnızca kadın katılımcılar",
            "AGE_NOT_ELIGIBLE" => Age(participant.BirthDate) < g.AgeMin
                ? $"En az {g.AgeMin} yaş şartı"
                : $"En fazla {g.AgeMax} yaş şartı",
            _ => violation.Message,
        };
    }

    private async Task<List<CitizenFacilityApplicantDto>> BuildApplicantsAsync(FacilityGroup group, Participant? self, CancellationToken ct)
    {
        if (self is null) return [];

        var people = new List<(Participant Person, bool IsSelf)> { (self, true) };
        var children = await uow.Participants.GetChildrenAsync(self.Id, ct);
        people.AddRange(children.Select(c => (c, false)));

        var ids = people.Select(x => x.Person.Id).ToList();
        var activeApps = await uow.FacilityApplications.FindAsync(
            a => !a.IsDeleted && a.GroupId == group.Id && a.ParticipantId != null && ids.Contains(a.ParticipantId.Value) && a.Status != "rejected", ct);
        var appliedIds = activeApps.Where(a => a.ParticipantId.HasValue).Select(a => a.ParticipantId!.Value).ToHashSet();

        return people.Select(x =>
        {
            var eligible = IsEligible(group, x.Person);
            return new CitizenFacilityApplicantDto(
                x.Person.Id, x.Person.FullName, x.IsSelf, Age(x.Person.BirthDate),
                x.Person.Gender == Gender.Male ? "male" : "female",
                eligible, eligible ? null : IneligibleReason(group, x.Person),
                appliedIds.Contains(x.Person.Id));
        }).ToList();
    }

    private static int Age(DateTime birth)
    {
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    private static string BuildScheduleSummary(string scheduleJson)
    {
        var slots = FacilityScheduleHelper.ParseSlots(scheduleJson);
        if (slots.Count == 0) return "";

        var labels = slots
            .Where(s => !string.IsNullOrWhiteSpace(s.Day))
            .Select(s => DayLabel(s.Day!))
            .Where(l => l is not null)
            .Distinct()
            .ToList();

        if (labels.Count == 0) return "";

        var times = slots
            .Where(s => !string.IsNullOrWhiteSpace(s.StartTime) && !string.IsNullOrWhiteSpace(s.EndTime))
            .Select(s => $"{s.StartTime}-{s.EndTime}")
            .Distinct()
            .ToList();

        var dayPart = string.Join(", ", labels);
        return times.Count == 1 ? $"{dayPart} · {times[0]}" : dayPart;
    }

    private static string? DayLabel(string day)
    {
        if (!FacilityScheduleHelper.DayMap.TryGetValue(day.Trim(), out var dow)) return null;
        return dow switch
        {
            DayOfWeek.Monday => "Pazartesi",
            DayOfWeek.Tuesday => "Salı",
            DayOfWeek.Wednesday => "Çarşamba",
            DayOfWeek.Thursday => "Perşembe",
            DayOfWeek.Friday => "Cuma",
            DayOfWeek.Saturday => "Cumartesi",
            DayOfWeek.Sunday => "Pazar",
            _ => null,
        };
    }

    private static string? BuildFeeText(string feeJson)
    {
        if (string.IsNullOrWhiteSpace(feeJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(feeJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;

            var isPaid = root.TryGetProperty("isPaid", out var p) && p.ValueKind == JsonValueKind.True;
            if (!isPaid) return "Ücretsiz";

            decimal amount = 0;
            if (root.TryGetProperty("amount", out var a))
            {
                if (a.ValueKind == JsonValueKind.Number) a.TryGetDecimal(out amount);
                else if (a.ValueKind == JsonValueKind.String && decimal.TryParse(a.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed)) amount = parsed;
            }
            if (amount <= 0) return "Ücretsiz";

            var feeType = root.TryGetProperty("feeType", out var t) ? t.GetString() : null;
            var period = feeType switch
            {
                "monthly" => "/ay",
                "term" => "/dönem",
                "yearly" => "/yıl",
                "once" => "",
                _ => "",
            };
            return $"{amount.ToString("0.##", CultureInfo.InvariantCulture)} ₺{period}";
        }
        catch
        {
            return null;
        }
    }

    private async Task<FacilityModuleRule> ResolveGroupDocumentRuleAsync(string module, FacilityGroup group, CancellationToken ct)
    {
        // basvuruhitetmeyenkurallar.md (A-kovası, Tesis/Spor #2) canlı testte kanıtlandı: Engelsiz
        // Yaşam ("accessible-life") modülü için FacilityModuleRegistry.Rules'ta TANIMLI zorunlu evrak
        // kuralı (SGK Engelli Sağlık Raporu + Sağlık Raporu) vatandaşın kendi başvuru yolunda
        // (ParticipantFacilityService.ApplyAsync) HİÇ okunmuyordu — sadece admin'in manuel başvuru
        // oluşturduğu yol (FacilityApplicationService.CreateAsync) bu registry'yi kontrol ediyordu.
        // Sonuç: bir vatandaş, engelli sağlık raporu YÜKLEMEDEN Engelsiz Yaşam programına
        // başvurabiliyordu. Düzeltme: modül-geneli registry kuralı (taban/floor) ile grup-seviyesi
        // dinamik ConditionsJson kuralı (ek/üstüne eklenen) BİRLEŞTİRİLİYOR.
        var moduleRule = FacilityModuleRegistry.RulesFor(module);

        var (documentsRequired, requiredDocumentIds, documentFormats, residenceRequired) = ParseGroupDocumentConfig(group.ConditionsJson);
        if ((!documentsRequired || requiredDocumentIds.Count == 0) && !residenceRequired && moduleRule.DocumentTypes.Count == 0)
            return new FacilityModuleRule();

        var types = new List<FacilityDocumentType>(moduleRule.DocumentTypes);
        if (documentsRequired && requiredDocumentIds.Count > 0)
        {
            var library = await LoadDocumentLibraryLabelsAsync(module, ct);
            foreach (var id in requiredDocumentIds)
            {
                if (types.Any(t => string.Equals(t.Key, id, StringComparison.OrdinalIgnoreCase))) continue;
                var lbl = library.TryGetValue(id, out var entry) ? entry : "Evrak";
                var formats = documentFormats.TryGetValue(id, out var fmts) ? fmts : null;
                types.Add(new FacilityDocumentType(id, lbl, true, formats));
            }
        }
        if (residenceRequired && !types.Any(t => string.Equals(t.Key, "residence", StringComparison.OrdinalIgnoreCase)))
            types.Add(new FacilityDocumentType("residence", "İkametgâh Belgesi", true));

        return new FacilityModuleRule(
            RequiresApplicationDocuments: types.Count > 0,
            DocumentsRequiredMessage: moduleRule.DocumentsRequiredMessage ?? "Bu program için gerekli evrakların yüklenmesi zorunludur.",
            RequiredDocumentTypes: types);
    }

    private static (bool DocumentsRequired, IReadOnlyList<string> RequiredDocumentIds, Dictionary<string, IReadOnlyList<string>> DocumentFormats, bool ResidenceRequired) ParseGroupDocumentConfig(string conditionsJson)
    {
        var ids = new List<string>();
        var formats = new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(conditionsJson) ? "{}" : conditionsJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return (false, ids, formats, false);
            var documentsRequired = root.TryGetProperty("documentsRequired", out var dr) && dr.ValueKind == JsonValueKind.True;
            var residenceRequired = root.TryGetProperty("residenceRequired", out var rr) && rr.ValueKind == JsonValueKind.True;
            if (root.TryGetProperty("requiredDocumentIds", out var idsEl) && idsEl.ValueKind == JsonValueKind.Array)
                foreach (var e in idsEl.EnumerateArray())
                    if (e.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(e.GetString()))
                        ids.Add(e.GetString()!);
            if (root.TryGetProperty("documentFormats", out var fmtEl) && fmtEl.ValueKind == JsonValueKind.Object)
                foreach (var prop in fmtEl.EnumerateObject())
                {
                    if (prop.Value.ValueKind != JsonValueKind.Array) continue;
                    var list = new List<string>();
                    foreach (var fe in prop.Value.EnumerateArray())
                        if (fe.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(fe.GetString()))
                            list.Add(fe.GetString()!);
                    if (list.Count > 0) formats[prop.Name] = list;
                }
            return (documentsRequired, ids, formats, residenceRequired);
        }
        catch
        {
            return (false, ids, formats, false);
        }
    }

    private async Task<Dictionary<string, string>> LoadDocumentLibraryLabelsAsync(string module, CancellationToken ct)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var settings = await uow.FacilitySettings.GetGeneralAsync(module, ct);
        if (settings is null || string.IsNullOrWhiteSpace(settings.SettingsJson)) return result;
        try
        {
            using var doc = JsonDocument.Parse(settings.SettingsJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("requiredDocuments", out var arr)
                && arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var d in arr.EnumerateArray())
                {
                    if (d.ValueKind != JsonValueKind.Object) continue;
                    var id = d.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                    var label = d.TryGetProperty("label", out var lEl) ? lEl.GetString() : null;
                    if (!string.IsNullOrWhiteSpace(id))
                        result[id!] = string.IsNullOrWhiteSpace(label) ? "Evrak" : label!;
                }
            }
        }
        catch
        {
        }
        return result;
    }

    private static string? ReadConditions(string conditionsJson)
    {
        if (string.IsNullOrWhiteSpace(conditionsJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(conditionsJson);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.String)
            {
                var s = root.GetString();
                return string.IsNullOrWhiteSpace(s) ? null : s;
            }
            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("text", out var textEl) && textEl.ValueKind == JsonValueKind.String)
            {
                var s = textEl.GetString();
                return string.IsNullOrWhiteSpace(s) ? null : s;
            }
        }
        catch
        {
            return null;
        }
        return null;
    }

    private static string? ReadConditionsKey(string conditionsJson, string key)
    {
        if (string.IsNullOrWhiteSpace(conditionsJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(conditionsJson);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.String)
            {
                var s = el.GetString();
                return string.IsNullOrWhiteSpace(s) ? null : s;
            }
        }
        catch
        {
            return null;
        }
        return null;
    }
}
