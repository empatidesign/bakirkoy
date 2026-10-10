using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Nexora.Application.Common.Repositories;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    private IDbContextTransaction? _transaction;

    public IAuditLogRepository AuditLogs { get; } = new AuditLogRepository(context);
    public ISmsSendLogRepository SmsSendLogs { get; } = new SmsSendLogRepository(context);
    public IAdminUserRepository AdminUsers { get; } = new AdminUserRepository(context);
    public IDepartmentRepository Departments { get; } = new DepartmentRepository(context);
    public IRoleRepository Roles { get; } = new RoleRepository(context);
    public IPermissionModuleRepository PermissionModules { get; } = new PermissionModuleRepository(context);
    public IPermissionRepository Permissions { get; } = new PermissionRepository(context);
    public IRolePermissionRepository RolePermissions { get; } = new RolePermissionRepository(context);
    public IScopeNodeRepository ScopeNodes { get; } = new ScopeNodeRepository(context);
    public IScopeEdgeRepository ScopeEdges { get; } = new ScopeEdgeRepository(context);
    public IAdminScopeRepository AdminScopes { get; } = new AdminScopeRepository(context);
    public IAdminPermissionRepository AdminPermissions { get; } = new AdminPermissionRepository(context);
    public IParticipantRepository Participants { get; } = new ParticipantRepository(context);
    public IParticipantGuardianRepository ParticipantGuardians { get; } = new ParticipantGuardianRepository(context);
    public IServiceFacilityRepository ServiceFacilities { get; } = new ServiceFacilityRepository(context);
    public IEmergencyAreaRepository EmergencyAreas { get; } = new EmergencyAreaRepository(context);
    public IDutyPharmacyRepository DutyPharmacies { get; } = new DutyPharmacyRepository(context);
    public IQuizCategoryRepository QuizCategories { get; } = new QuizCategoryRepository(context);
    public IQuizAgeGroupRepository QuizAgeGroups { get; } = new QuizAgeGroupRepository(context);
    public IQuizRepository Quizzes { get; } = new QuizRepository(context);
    public ISurveyRepository Surveys { get; } = new SurveyRepository(context);
    public IGiftRepository Gifts { get; } = new GiftRepository(context);
    public IWheelRepository Wheels { get; } = new WheelRepository(context);
    public IGiftRequestRepository GiftRequests { get; } = new GiftRequestRepository(context);
    public ICitizenSubmissionRepository CitizenSubmissions { get; } = new CitizenSubmissionRepository(context);
    public ICitizenSubmissionEventRepository CitizenSubmissionEvents { get; } = new CitizenSubmissionEventRepository(context);
    public IHallRepository Halls { get; } = new HallRepository(context);
    public IHallFeatureRepository HallFeatures { get; } = new HallFeatureRepository(context);
    public IEventCategoryRepository EventCategories { get; } = new EventCategoryRepository(context);
    public IEventSettingsRepository EventSettings { get; } = new EventSettingsRepository(context);
    public ICompanySettingsRepository CompanySettings { get; } = new CompanySettingsRepository(context);
    public IModuleNotificationSettingsRepository ModuleNotificationSettings { get; } = new ModuleNotificationSettingsRepository(context);
    public IEventRepository Events { get; } = new EventRepository(context);
    public ISessionRepository Sessions { get; } = new SessionRepository(context);
    public IEventApplicationRepository EventApplications { get; } = new EventApplicationRepository(context);

    public IEventActivityRepository EventActivities { get; } = new EventActivityRepository(context);
    public ITravelCategoryRepository TravelCategories { get; } = new TravelCategoryRepository(context);
    public ITravelRouteRepository TravelRoutes { get; } = new TravelRouteRepository(context);
    public ITravelRepository Travels { get; } = new TravelRepository(context);
    public ITravelBusRepository TravelBuses { get; } = new TravelBusRepository(context);
    public ITravelApplicationRepository TravelApplications { get; } = new TravelApplicationRepository(context);
    public ITravelSettingsRepository TravelSettings { get; } = new TravelSettingsRepository(context);
    public ITravelAttendanceRepository TravelAttendances { get; } = new TravelAttendanceRepository(context);
    public IFacilityRepository Facilities { get; } = new FacilityRepository(context);
    public IFacilityBranchRepository FacilityBranches { get; } = new FacilityBranchRepository(context);
    public IFacilityGroupRepository FacilityGroups { get; } = new FacilityGroupRepository(context);
    public IFacilitySessionRepository FacilitySessions { get; } = new FacilitySessionRepository(context);
    public IFacilityApplicationRepository FacilityApplications { get; } = new FacilityApplicationRepository(context);
    public IFacilityRegistrationRepository FacilityRegistrations { get; } = new FacilityRegistrationRepository(context);
    public IFacilityAttendanceRepository FacilityAttendances { get; } = new FacilityAttendanceRepository(context);
    public IFacilityDeviceRepository FacilityDevices { get; } = new FacilityDeviceRepository(context);
    public IFacilityMasterAccessLogRepository FacilityMasterAccessLogs { get; } = new FacilityMasterAccessLogRepository(context);
    public IFacilitySettingsRepository FacilitySettings { get; } = new FacilitySettingsRepository(context);
    public IFacilityInstructorRepository FacilityInstructors { get; } = new FacilityInstructorRepository(context);
    public IRepository<Nexora.Domain.Entities.Facilities.AccessibleApplicationDetail> AccessibleApplicationDetails { get; }
        = new Repository<Nexora.Domain.Entities.Facilities.AccessibleApplicationDetail>(context);
    public IRepository<Nexora.Domain.Entities.Facilities.AccessibleProgressNote> AccessibleProgressNotes { get; }
        = new Repository<Nexora.Domain.Entities.Facilities.AccessibleProgressNote>(context);
    public IRepository<Nexora.Domain.Entities.Facilities.AccessibleCaregiver> AccessibleCaregivers { get; }
        = new Repository<Nexora.Domain.Entities.Facilities.AccessibleCaregiver>(context);
    public ILibraryRepository Libraries { get; } = new LibraryRepository(context);
    public ILibrarySettingsRepository LibrarySettings { get; } = new LibrarySettingsRepository(context);
    public ILibrarySettingsHistoryRepository LibrarySettingsHistory { get; } = new LibrarySettingsHistoryRepository(context);
    public ILibraryRuleRepository LibraryRules { get; } = new LibraryRuleRepository(context);
    public ILibrarySessionRepository LibrarySessions { get; } = new LibrarySessionRepository(context);
    public ILibraryQueueRepository LibraryQueue { get; } = new LibraryQueueRepository(context);
    public ILibraryBreakRepository LibraryBreaks { get; } = new LibraryBreakRepository(context);
    public ILibraryReservationRepository LibraryReservations { get; } = new LibraryReservationRepository(context);
    public ILibraryStaffRepository LibraryStaff { get; } = new LibraryStaffRepository(context);
    public ILibraryShiftRepository LibraryShifts { get; } = new LibraryShiftRepository(context);
    public ILibraryApplicationRepository LibraryApplications { get; } = new LibraryApplicationRepository(context);
    public ILibraryDeviceRepository LibraryDevices { get; } = new LibraryDeviceRepository(context);
    public INotificationRepository Notifications { get; } = new NotificationRepository(context);
    public ITeamNoteRepository TeamNotes { get; } = new TeamNoteRepository(context);
    public ITeamTaskRepository TeamTasks { get; } = new TeamTaskRepository(context);
    public ITeamMessageRepository TeamMessages { get; } = new TeamMessageRepository(context);
    public ISedaApplicationRepository SedaApplications { get; } = new SedaApplicationRepository(context);
    public ISedaSchoolRepository SedaSchools { get; } = new SedaSchoolRepository(context);
    public ISedaDefinitionRepository SedaDefinitions { get; } = new SedaDefinitionRepository(context);
    public ISedaPeriodRepository SedaPeriods { get; } = new SedaPeriodRepository(context);
    public ISedaSettingRepository SedaSettings { get; } = new SedaSettingRepository(context);
    public ISedaEducationRecordRepository SedaEducationRecords { get; } = new SedaEducationRecordRepository(context);
    public ICitizenMenuSettingRepository CitizenMenuSettings { get; } = new CitizenMenuSettingRepository(context);
    public ICompanyRepository Companies { get; } = new CompanyRepository(context);
    public ICompanyStaffRepository CompanyStaffs { get; } = new CompanyStaffRepository(context);
    public ICampaignRepository Campaigns { get; } = new CampaignRepository(context);
    public IDiscountUsageRepository DiscountUsages { get; } = new DiscountUsageRepository(context);
    public IServiceCategoryRepository ServiceCategories { get; } = new ServiceCategoryRepository(context);
    public IRepository<Nexora.Domain.Entities.Companies.CompanyOffering> CompanyOfferings { get; }
        = new Repository<Nexora.Domain.Entities.Companies.CompanyOffering>(context);
    public IEventReviewRepository EventReviews { get; } = new EventReviewRepository(context);
    public ITravelReviewRepository TravelReviews { get; } = new TravelReviewRepository(context);
    public IMobileMenuItemRepository MobileMenuItems { get; } = new MobileMenuItemRepository(context);
    public IMobileMenuBannerRepository MobileMenuBanners { get; } = new MobileMenuBannerRepository(context);
    public IMobileAppConfigRepository MobileAppConfigs { get; } = new MobileAppConfigRepository(context);
    public IMobileQuickActionRepository MobileQuickActions { get; } = new MobileQuickActionRepository(context);
    public ISystemModuleRepository SystemModules { get; } = new SystemModuleRepository(context);
    public IMenuSectionRepository MenuSections { get; } = new MenuSectionRepository(context);
    public IMenuItemRepository MenuItems { get; } = new MenuItemRepository(context);
    public ITopMenuItemRepository TopMenuItems { get; } = new TopMenuItemRepository(context);
    public ILoyaltyRuleRepository LoyaltyRules { get; } = new LoyaltyRuleRepository(context);
    public ILoyaltyTransactionRepository LoyaltyTransactions { get; } = new LoyaltyTransactionRepository(context);
    public IDailyStreakRepository DailyStreaks { get; } = new DailyStreakRepository(context);
    public IRewardRepository Rewards { get; } = new RewardRepository(context);
    public IRewardRedemptionRepository RewardRedemptions { get; } = new RewardRedemptionRepository(context);
    public IEducationInstitutionRepository EducationInstitutions { get; } = new EducationInstitutionRepository(context);
    public IEducationHistoryRepository EducationHistories { get; } = new EducationHistoryRepository(context);
    public ICompanyQrRepository CompanyQrCodes { get; } = new CompanyQrRepository(context);
    public ICampaignRedemptionRepository CampaignRedemptions { get; } = new CampaignRedemptionRepository(context);
    public ICampaignBookmarkRepository CampaignBookmarks { get; } = new CampaignBookmarkRepository(context);
    public IParticipantNotificationPreferenceRepository ParticipantNotificationPreferences { get; } = new ParticipantNotificationPreferenceRepository(context);
    public IParticipantDevicePermissionRepository ParticipantDevicePermissions { get; } = new ParticipantDevicePermissionRepository(context);
    public IParticipantServiceUsageRepository ParticipantServiceUsages { get; } = new ParticipantServiceUsageRepository(context);
    public IIntegrationSettingsRepository IntegrationSettings { get; } = new IntegrationSettingsRepository(context);
    public ISystemBrandingRepository SystemBranding { get; } = new SystemBrandingRepository(context);
    public IPopupRepository Popups { get; } = new PopupRepository(context);
    public IBakkartApplicationRepository BakkartApplications { get; } = new BakkartApplicationRepository(context);
    public IBakkartCardRepository BakkartCards { get; } = new BakkartCardRepository(context);
    public IBakkartTransactionRepository BakkartTransactions { get; } = new BakkartTransactionRepository(context);

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
        => await context.SaveChangesAsync(ct);

    public async Task BeginTransactionAsync(CancellationToken ct = default)
        => _transaction = await context.Database.BeginTransactionAsync(ct);

    // Y01: commit/rollback SONUNDA transaction dispose edilip null'lanır — aksi halde HasActiveTransaction
    // commit'ten sonra da true kalır ve nested `ownsTransaction = !HasActiveTransaction` deseni bozulur
    // (toplu import ikinci satırda yeni transaction açmaz, ilk transaction'ın kapanmış kilidiyle korumasız
    // çalışırdı). Tek-commit'lik akışlar etkilenmez; per-satır Begin/Commit döngüsü artık doğru çalışır.
    public async Task CommitAsync(CancellationToken ct = default)
    {
        if (_transaction is null) return;
        try
        {
            await _transaction.CommitAsync(ct);
        }
        finally
        {
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public async Task RollbackAsync(CancellationToken ct = default)
    {
        if (_transaction is null) return;
        try
        {
            await _transaction.RollbackAsync(ct);
        }
        finally
        {
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public bool HasActiveTransaction => _transaction is not null;

    public async Task AcquireAdvisoryLockAsync(long key, CancellationToken ct = default)
        => await context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({key})", ct);

    // Y06: bloklamayan kilit — kilit başkasındaysa (o kimlik başka işlemde) beklemeden false döner.
    // Terfi taramasında aday kimliğini try-lock ile alıp alınamazsa adayı atlamak, travel kilidini
    // tutarken kimlik kilidini beklemekten doğacak deadlock'u önler.
    public async Task<bool> TryAcquireAdvisoryLockAsync(long key, CancellationToken ct = default)
        => await context.Database
            .SqlQuery<bool>($"SELECT pg_try_advisory_xact_lock({key}) AS \"Value\"")
            .FirstAsync(ct);

    // V02: kilit alındıktan sonra izlenen (tracked) bir varlığı DB'den yeniden yükler — kilit beklerken
    // başka işlemin değiştirdiği durumu görmek için. Tracked nesneyi tekrar sorgulamak tek başına yenilemez.
    public async Task ReloadAsync<T>(T entity, CancellationToken ct = default) where T : class
        => await context.Entry(entity).ReloadAsync(ct);

    // Y01: satır-başı işlemde (toplu import) bir satır rollback olunca, o satırın change-tracker'a
    // eklediği bekleyen (Added/Modified) entity'ler sonraki satıra taşınmasın diye izleyici temizlenir.
    public void ClearChangeTracker() => context.ChangeTracker.Clear();
}
