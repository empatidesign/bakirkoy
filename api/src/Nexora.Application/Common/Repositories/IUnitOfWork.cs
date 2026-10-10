namespace Nexora.Application.Common.Repositories;

public interface IUnitOfWork
{
    IAuditLogRepository AuditLogs { get; }
    ISmsSendLogRepository SmsSendLogs { get; }
    IAdminUserRepository AdminUsers { get; }
    IDepartmentRepository Departments { get; }
    IRoleRepository Roles { get; }
    IPermissionModuleRepository PermissionModules { get; }
    IPermissionRepository Permissions { get; }
    IRolePermissionRepository RolePermissions { get; }
    IScopeNodeRepository ScopeNodes { get; }
    IScopeEdgeRepository ScopeEdges { get; }
    IAdminScopeRepository AdminScopes { get; }
    IAdminPermissionRepository AdminPermissions { get; }
    IParticipantRepository Participants { get; }
    IParticipantGuardianRepository ParticipantGuardians { get; }
    IServiceFacilityRepository ServiceFacilities { get; }
    IEmergencyAreaRepository EmergencyAreas { get; }
    IDutyPharmacyRepository DutyPharmacies { get; }
    IQuizCategoryRepository QuizCategories { get; }
    IQuizAgeGroupRepository QuizAgeGroups { get; }
    IQuizRepository Quizzes { get; }
    ISurveyRepository Surveys { get; }
    IGiftRepository Gifts { get; }
    IWheelRepository Wheels { get; }
    IGiftRequestRepository GiftRequests { get; }
    ICitizenSubmissionRepository CitizenSubmissions { get; }
    ICitizenSubmissionEventRepository CitizenSubmissionEvents { get; }
    IHallRepository Halls { get; }
    IHallFeatureRepository HallFeatures { get; }
    IEventCategoryRepository EventCategories { get; }
    IEventSettingsRepository EventSettings { get; }
    ICompanySettingsRepository CompanySettings { get; }
    IModuleNotificationSettingsRepository ModuleNotificationSettings { get; }
    IEventRepository Events { get; }
    ISessionRepository Sessions { get; }
    IEventApplicationRepository EventApplications { get; }

    IEventActivityRepository EventActivities { get; }
    ITravelCategoryRepository TravelCategories { get; }
    ITravelRouteRepository TravelRoutes { get; }
    ITravelRepository Travels { get; }
    ITravelBusRepository TravelBuses { get; }
    ITravelApplicationRepository TravelApplications { get; }
    ITravelSettingsRepository TravelSettings { get; }
    ITravelAttendanceRepository TravelAttendances { get; }
    IFacilityRepository Facilities { get; }
    IFacilityBranchRepository FacilityBranches { get; }
    IFacilityGroupRepository FacilityGroups { get; }
    IFacilitySessionRepository FacilitySessions { get; }
    IFacilityApplicationRepository FacilityApplications { get; }
    IFacilityRegistrationRepository FacilityRegistrations { get; }
    IFacilityAttendanceRepository FacilityAttendances { get; }
    IFacilityDeviceRepository FacilityDevices { get; }
    IFacilityMasterAccessLogRepository FacilityMasterAccessLogs { get; }
    IFacilitySettingsRepository FacilitySettings { get; }
    IFacilityInstructorRepository FacilityInstructors { get; }
    IRepository<Nexora.Domain.Entities.Facilities.AccessibleApplicationDetail> AccessibleApplicationDetails { get; }
    IRepository<Nexora.Domain.Entities.Facilities.AccessibleProgressNote> AccessibleProgressNotes { get; }
    IRepository<Nexora.Domain.Entities.Facilities.AccessibleCaregiver> AccessibleCaregivers { get; }
    ILibraryRepository Libraries { get; }
    ILibrarySettingsRepository LibrarySettings { get; }
    ILibrarySettingsHistoryRepository LibrarySettingsHistory { get; }
    ILibraryRuleRepository LibraryRules { get; }
    ILibrarySessionRepository LibrarySessions { get; }
    ILibraryQueueRepository LibraryQueue { get; }
    ILibraryBreakRepository LibraryBreaks { get; }
    ILibraryReservationRepository LibraryReservations { get; }
    ILibraryStaffRepository LibraryStaff { get; }
    ILibraryShiftRepository LibraryShifts { get; }
    ILibraryApplicationRepository LibraryApplications { get; }
    ILibraryDeviceRepository LibraryDevices { get; }
    INotificationRepository Notifications { get; }
    ITeamNoteRepository TeamNotes { get; }
    ITeamTaskRepository TeamTasks { get; }
    ITeamMessageRepository TeamMessages { get; }
    ISedaApplicationRepository SedaApplications { get; }
    ISedaSchoolRepository SedaSchools { get; }
    ISedaDefinitionRepository SedaDefinitions { get; }
    ISedaPeriodRepository SedaPeriods { get; }
    ISedaSettingRepository SedaSettings { get; }
    ISedaEducationRecordRepository SedaEducationRecords { get; }
    ICitizenMenuSettingRepository CitizenMenuSettings { get; }
    ICompanyRepository Companies { get; }
    ICompanyStaffRepository CompanyStaffs { get; }
    ICampaignRepository Campaigns { get; }
    IDiscountUsageRepository DiscountUsages { get; }
    IServiceCategoryRepository ServiceCategories { get; }
    IRepository<Nexora.Domain.Entities.Companies.CompanyOffering> CompanyOfferings { get; }
    IEventReviewRepository EventReviews { get; }
    ITravelReviewRepository TravelReviews { get; }
    IMobileMenuItemRepository MobileMenuItems { get; }
    IMobileMenuBannerRepository MobileMenuBanners { get; }
    IMobileAppConfigRepository MobileAppConfigs { get; }
    IMobileQuickActionRepository MobileQuickActions { get; }
    ISystemModuleRepository SystemModules { get; }
    IMenuSectionRepository MenuSections { get; }
    IMenuItemRepository MenuItems { get; }
    ITopMenuItemRepository TopMenuItems { get; }
    ILoyaltyRuleRepository LoyaltyRules { get; }
    ILoyaltyTransactionRepository LoyaltyTransactions { get; }
    IDailyStreakRepository DailyStreaks { get; }
    IRewardRepository Rewards { get; }
    IRewardRedemptionRepository RewardRedemptions { get; }
    IEducationInstitutionRepository EducationInstitutions { get; }
    IEducationHistoryRepository EducationHistories { get; }
    ICompanyQrRepository CompanyQrCodes { get; }
    ICampaignRedemptionRepository CampaignRedemptions { get; }
    ICampaignBookmarkRepository CampaignBookmarks { get; }
    IParticipantNotificationPreferenceRepository ParticipantNotificationPreferences { get; }
    IParticipantDevicePermissionRepository ParticipantDevicePermissions { get; }
    IParticipantServiceUsageRepository ParticipantServiceUsages { get; }
    IIntegrationSettingsRepository IntegrationSettings { get; }
    ISystemBrandingRepository SystemBranding { get; }
    IPopupRepository Popups { get; }
    IBakkartApplicationRepository BakkartApplications { get; }
    IBakkartCardRepository BakkartCards { get; }
    IBakkartTransactionRepository BakkartTransactions { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task BeginTransactionAsync(CancellationToken ct = default);
    Task CommitAsync(CancellationToken ct = default);
    Task RollbackAsync(CancellationToken ct = default);

    // Şu an açık bir transaction var mı? İç içe (nested) BeginTransactionAsync çağrısı EF Core'da
    // hataya sebep olur — bu, "zaten bir transaction içindeyim, yenisini açma" kontrolü için kullanılır.
    bool HasActiveTransaction { get; }

    // Postgres transaction-scoped advisory lock (pg_advisory_xact_lock). Aynı anahtarla eşzamanlı
    // çağrılar bu satırda sırayla bekler; transaction commit/rollback olduğunda otomatik serbest kalır.
    // Kapasite gibi "say-sonra-yaz" (check-then-insert) senaryolarında race condition'ı engellemek için kullanılır.
    // NOT: Çağrıldığı anda açık bir transaction OLMALI (BeginTransactionAsync sonrası çağrılmalı).
    Task AcquireAdvisoryLockAsync(long key, CancellationToken ct = default);

    // Bloklamayan advisory kilit: kilit başkasındaysa beklemeden false döner. Travel kilidini tutarken
    // kimlik kilidini beklemekten doğacak deadlock'u önlemek için terfi taramasında kullanılır (Y06).
    Task<bool> TryAcquireAdvisoryLockAsync(long key, CancellationToken ct = default);

    Task ReloadAsync<T>(T entity, CancellationToken ct = default) where T : class;

    // Bekleyen (kaydedilmemiş) tüm change-tracker girişlerini temizler — satır-başı transaction'lı toplu
    // akışlarda bir satır rollback olunca bekleyen entity'lerin sonraki satıra sızmasını önler (Y01).
    void ClearChangeTracker();
}
