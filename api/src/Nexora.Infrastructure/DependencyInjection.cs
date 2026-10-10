using Consul;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Minio;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Infrastructure.Services;
using Nexora.Application.Configuration;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Auth;
using Nexora.Application.Features.Departments;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Halls;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.Participants;
using Nexora.Application.Features.Permissions;
using Nexora.Application.Features.CitizenIdentity;
using Nexora.Application.Features.Roles;
using Nexora.Application.Features.ServiceFacilities;
using Nexora.Application.Features.Reviews;
using Nexora.Infrastructure.Consul;
using Nexora.Infrastructure.Services.Nvi;
using Nexora.Infrastructure.HealthChecks;
using Nexora.Infrastructure.Logging;
using Nexora.Infrastructure.Persistence;
using Nexora.Infrastructure.Persistence.Interceptors;
using Nexora.Infrastructure.Persistence.Repositories;
using Nexora.Infrastructure.Services.Scheduled;
using Nexora.Infrastructure.Storage;
using StackExchange.Redis;

namespace Nexora.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ConsulSettings>(configuration.GetSection("Consul"));
        services.Configure<MinioSettings>(configuration.GetSection("MinioSettings"));
        services.Configure<NviSettings>(configuration.GetSection("Nvi"));
        services.Configure<ResidencySettings>(configuration.GetSection("Residency"));
        services.Configure<SmsSettings>(configuration.GetSection("SmsSettings"));
        services.Configure<OtpSettings>(configuration.GetSection("OtpSettings"));
        services.Configure<SmtpSettings>(configuration.GetSection("SmtpSettings"));
        services.Configure<ParticipantSettings>(configuration.GetSection("Participants"));
        services.Configure<PharmacySettings>(configuration.GetSection("PharmacySettings"));
        services.Configure<AfadGisSettings>(configuration.GetSection("AfadGis"));

        services.AddScoped<AuditSaveChangesInterceptor>();
        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var commandTimeoutSeconds = configuration.GetValue("Database:CommandTimeoutSeconds", 30);

            options.UseNpgsql(configuration.GetConnectionString("PostgreSQL"), npgsql =>
            {
                npgsql.CommandTimeout(commandTimeoutSeconds);
            });
            options.AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>());
            options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        });

        services.AddScoped<IAuditLogRepository, AuditLogRepository>();
        services.AddScoped<IAdminUserRepository, AdminUserRepository>();
        services.AddScoped<IDepartmentRepository, DepartmentRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IPermissionModuleRepository, PermissionModuleRepository>();
        services.AddScoped<IPermissionRepository, PermissionRepository>();
        services.AddScoped<IRolePermissionRepository, RolePermissionRepository>();
        services.AddScoped<IUserScopeService, UserScopeService>();
        services.AddScoped<IScopeNodeRepository, ScopeNodeRepository>();
        services.AddScoped<IScopeEdgeRepository, ScopeEdgeRepository>();
        services.AddScoped<IAdminScopeRepository, AdminScopeRepository>();
        services.AddScoped<IAdminPermissionRepository, AdminPermissionRepository>();
        services.AddScoped<IParticipantRepository, ParticipantRepository>();
        services.AddScoped<IServiceFacilityRepository, ServiceFacilityRepository>();
        services.AddScoped<IEmergencyAreaRepository, EmergencyAreaRepository>();
        services.AddScoped<IDutyPharmacyRepository, DutyPharmacyRepository>();
        services.AddScoped<IQuizCategoryRepository, QuizCategoryRepository>();
        services.AddScoped<IQuizAgeGroupRepository, QuizAgeGroupRepository>();
        services.AddScoped<IQuizRepository, QuizRepository>();
        services.AddScoped<ISurveyRepository, SurveyRepository>();
        services.AddScoped<IGiftRepository, GiftRepository>();
        services.AddScoped<IWheelRepository, WheelRepository>();
        services.AddScoped<IGiftRequestRepository, GiftRequestRepository>();
        services.AddScoped<ICitizenSubmissionRepository, CitizenSubmissionRepository>();
        services.AddScoped<IHallRepository, HallRepository>();
        services.AddScoped<IHallFeatureRepository, HallFeatureRepository>();
        services.AddScoped<IEventCategoryRepository, EventCategoryRepository>();
        services.AddScoped<IEventSettingsRepository, EventSettingsRepository>();
        services.AddScoped<ICompanySettingsRepository, CompanySettingsRepository>();
        services.AddScoped<IEventRepository, EventRepository>();
        services.AddScoped<ISessionRepository, SessionRepository>();
        services.AddScoped<IEventApplicationRepository, EventApplicationRepository>();

        services.AddScoped<IEventActivityRepository, EventActivityRepository>();
        services.AddScoped<ITravelCategoryRepository, TravelCategoryRepository>();
        services.AddScoped<ITravelRouteRepository, TravelRouteRepository>();
        services.AddScoped<ITravelRepository, TravelRepository>();
        services.AddScoped<ITravelBusRepository, TravelBusRepository>();
        services.AddScoped<ITravelApplicationRepository, TravelApplicationRepository>();
        services.AddScoped<ITravelSettingsRepository, TravelSettingsRepository>();
        services.AddScoped<ITravelAttendanceRepository, TravelAttendanceRepository>();
        services.AddScoped<IFacilityRepository, FacilityRepository>();
        services.AddScoped<IFacilityBranchRepository, FacilityBranchRepository>();
        services.AddScoped<IFacilityGroupRepository, FacilityGroupRepository>();
        services.AddScoped<IFacilitySessionRepository, FacilitySessionRepository>();
        services.AddScoped<IFacilityApplicationRepository, FacilityApplicationRepository>();
        services.AddScoped<IFacilityRegistrationRepository, FacilityRegistrationRepository>();
        services.AddScoped<IFacilityAttendanceRepository, FacilityAttendanceRepository>();
        services.AddScoped<IFacilityDeviceRepository, FacilityDeviceRepository>();
        services.AddScoped<IFacilitySettingsRepository, FacilitySettingsRepository>();
        services.AddScoped<IFacilityInstructorRepository, FacilityInstructorRepository>();
        services.AddScoped<ILibraryRepository, LibraryRepository>();
        services.AddScoped<ILibrarySettingsRepository, LibrarySettingsRepository>();
        services.AddScoped<ILibraryRuleRepository, LibraryRuleRepository>();
        services.AddScoped<ILibrarySessionRepository, LibrarySessionRepository>();
        services.AddScoped<ILibraryQueueRepository, LibraryQueueRepository>();
        services.AddScoped<ILibraryBreakRepository, LibraryBreakRepository>();
        services.AddScoped<ILibraryReservationRepository, LibraryReservationRepository>();
        services.AddScoped<ILibraryStaffRepository, LibraryStaffRepository>();
        services.AddScoped<ILibraryShiftRepository, LibraryShiftRepository>();
        services.AddScoped<ILibraryDeviceRepository, LibraryDeviceRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<ISedaApplicationRepository, SedaApplicationRepository>();
        services.AddScoped<ISedaSchoolRepository, SedaSchoolRepository>();
        services.AddScoped<ISedaDefinitionRepository, SedaDefinitionRepository>();
        services.AddScoped<ISedaPeriodRepository, SedaPeriodRepository>();
        services.AddScoped<ISedaSettingRepository, SedaSettingRepository>();
        services.AddScoped<ISedaEducationRecordRepository, SedaEducationRecordRepository>();
        services.AddScoped<ICitizenMenuSettingRepository, CitizenMenuSettingRepository>();
        services.AddScoped<ICompanyRepository, CompanyRepository>();
        services.AddScoped<ICampaignRepository, CampaignRepository>();
        services.AddScoped<IDiscountUsageRepository, DiscountUsageRepository>();
        services.AddScoped<IServiceCategoryRepository, ServiceCategoryRepository>();
        services.AddScoped<IEventReviewRepository, EventReviewRepository>();
        services.AddScoped<ITravelReviewRepository, TravelReviewRepository>();
        services.AddScoped<ICompanyQrRepository, CompanyQrRepository>();
        services.AddScoped<ICampaignRedemptionRepository, CampaignRedemptionRepository>();
        services.AddScoped<ICampaignBookmarkRepository, CampaignBookmarkRepository>();
        services.AddScoped<IBakkartApplicationRepository, BakkartApplicationRepository>();
        services.AddScoped<IBakkartCardRepository, BakkartCardRepository>();
        services.AddScoped<IBakkartTransactionRepository, BakkartTransactionRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<ISmsGovernanceService, SmsGovernanceService>();
        services.AddScoped<IActivityLogger, ActivityLogger>();
        services.AddSingleton<IJwtService, JwtService>();
        services.AddSingleton<IQrTokenService, QrTokenService>();
        services.AddScoped<IDoorController, LibraryDoorController>();
        services.AddScoped<IFacilityDoorController, FacilityDoorController>();
        services.AddScoped<ILibraryLockController, LibraryLockController>();
        services.AddSingleton<IExcelService, ExcelService>();
        services.AddScoped<ICitizenIdentityQrService, CitizenIdentityQrService>();
        services.AddScoped<Nexora.Application.Features.LibraryStaffIdentity.IStaffIdentityQrService, StaffIdentityQrService>();
        services.AddServiceWithLogging<Nexora.Application.Features.QrPasses.IQrPassService, QrPassService>();
        services.AddServiceWithLogging<IAuthService, AuthService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantAuth.IParticipantAuthService, ParticipantAuthService>();
        services.AddServiceWithLogging<IAdminUserManagementService, AdminUserManagementService>();
        services.AddServiceWithLogging<IScopedStaffService, ScopedStaffService>();
        services.AddServiceWithLogging<IDepartmentService, DepartmentService>();
        services.AddServiceWithLogging<IRoleService, RoleService>();
        services.AddServiceWithLogging<Nexora.Application.Features.AuditLogs.IAuditLogService, AuditLogService>();
        services.AddServiceWithLogging<Nexora.Application.Features.SmsAudit.ISmsAuditDashboardService, SmsAuditDashboardService>();
        services.AddServiceWithLogging<IPermissionService, PermissionService>();
        services.AddServiceWithLogging<Nexora.Application.Features.SmsPermissions.ISmsPermissionService, SmsPermissionService>();
        services.AddServiceWithLogging<IParticipantService, ParticipantManagementService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Participants.IParticipantEventHistoryService, ParticipantEventHistoryService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Participants.IParticipantServiceUsageService, ParticipantServiceUsageService>();
        services.AddServiceWithLogging<IServiceFacilityService, ServiceFacilityManagementService>();
        services.AddScoped<Nexora.Application.Features.Public.IPublicCatalogService, PublicCatalogService>();
        services.AddScoped<Nexora.Application.Features.AiCatalog.IAiCatalogService, AiCatalogService>();
        services.AddServiceWithLogging<Nexora.Application.Features.EmergencyAreas.IEmergencyAreaService, EmergencyAreaService>();
        services.AddServiceWithLogging<Nexora.Application.Features.DutyPharmacies.IDutyPharmacyService, Nexora.Infrastructure.Services.DutyPharmacies.DutyPharmacyService>();
        services.AddScoped<Nexora.Application.Features.DutyPharmacies.IDutyPharmacySyncClient, Nexora.Infrastructure.Services.DutyPharmacies.IstanbulEczaciOdasiDutyPharmacyClient>();
        services.AddServiceWithLogging<Nexora.Application.Features.Wheels.IGiftService, GiftService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Wheels.IWheelService, WheelService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Popups.IPopupService, PopupService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Wheels.IGiftRequestService, GiftRequestService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Wheels.ISpinService, SpinService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Wheels.IGiftApplicationService, GiftApplicationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Wheels.IGiftRequestNotifier, GiftRequestNotifier>();
        services.AddServiceWithLogging<Nexora.Application.Features.CitizenSubmissions.ICitizenSubmissionService, CitizenSubmissionService>();
        services.AddServiceWithLogging<IMuhtarNotifier, MuhtarNotifier>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ILibrarySettingsService, LibrarySettingsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.IOperationTemplateClassifier, OperationTemplateClassifier>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.IHardwareVerificationService, HardwareVerificationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ITemplateShadowAuditService, TemplateShadowAuditService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ITemplateRuleEngine, TemplateRuleEngine>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ILibraryService, LibraryManagementService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Analytics.IAnalyticsService, AnalyticsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Reports.IReportsService, ReportsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Reports.IParticipantActivityReportService, ParticipantActivityReportService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Participants.IParticipantDemographicsService, ParticipantDemographicsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ILibraryRuleService, LibraryRuleService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ILibraryApplicationService, LibraryApplicationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ILibraryNotificationService, LibraryNotificationService>();
        services.AddHttpClient<Nexora.Application.Features.Libraries.IEmanetService, EmanetService>(c =>
            c.Timeout = TimeSpan.FromSeconds(configuration.GetValue("Emanet:TimeoutSeconds", 5)));
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ILibraryOperationsService, LibraryOperationsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ILibraryStaffService, LibraryStaffService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ILibraryShiftService, LibraryShiftService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ILibraryDeviceService, LibraryDeviceService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Libraries.ILibraryWebhookService, LibraryWebhookService>();
        services.AddServiceWithLogging<Nexora.Application.Features.DeviceMonitor.IDeviceMonitorService, DeviceMonitorService>();
        services.AddServiceWithLogging<IHallService, HallService>();
        services.AddServiceWithLogging<IEventCategoryService, EventCategoryService>();
        services.AddServiceWithLogging<IEventSettingsService, EventSettingsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Companies.ICompanySettingsService, CompanySettingsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Notifications.IModuleNotificationSettingsService, ModuleNotificationSettingsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Notifications.IBirthdayGreetingService, BirthdayGreetingService>();
        services.AddSingleton<Nexora.Infrastructure.Services.IApiKeyEncryptor, Nexora.Infrastructure.Services.ApiKeyEncryptor>();
        services.AddServiceWithLogging<Nexora.Application.Features.Integrations.IIntegrationSettingsService, IntegrationSettingsService>();
        services.AddHttpClient<Nexora.Application.Features.Integrations.IAiQueryService, AiQueryService>();
        // ULAK-05: SSRF kaçışını iki noktada engelle — (1) redirect kapalı (dış hedefin 3xx yanıtı
        // takip edilmez), (2) bağlantı-anı IP doğrulaması (ConnectCallback) yalnız doğrulanmış public
        // IP'ye TCP bağlantısı kurar; TryValidate'teki DNS çözümlemesi ile gerçek bağlantı arasındaki
        // DNS rebinding penceresi kapatılır.
        services.AddHttpClient("ulakbel")
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
            {
                AllowAutoRedirect = false,
                ConnectCallback = Nexora.Infrastructure.Http.OutboundUrlGuard.GuardedConnectAsync,
            });
        services.AddServiceWithLogging<Nexora.Application.Features.CitizenSubmissions.IUlakbelForwardService, UlakbelForwardService>();
        // Bridge360 (henüz forward servisi yok, sadece Ayarlar > Entegrasyonlar'daki bağlantı testi
        // bu client'ı kullanır) — aynı SSRF korumasıyla kayıtlı; gerçek API dokümanı geldiğinde
        // IBridge360ForwardService eklendiğinde bu client doğrudan onun tarafından da kullanılacak.
        services.AddHttpClient("bridge360")
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
            {
                AllowAutoRedirect = false,
                ConnectCallback = Nexora.Infrastructure.Http.OutboundUrlGuard.GuardedConnectAsync,
            });
        services.AddHttpClient("corporate-api");
        services.AddScoped<Nexora.Application.Features.CorporateProxy.ICorporateApiProxyService, Nexora.Infrastructure.Services.CorporateApiProxyService>();
        // Kullanıcı isteği (2026-08-28): başvuru içeriği analiz edilip ilgili müdürlüğe yönlendirilir.
        services.AddServiceWithLogging<Nexora.Application.Features.CitizenSubmissions.ISubmissionContentAnalyzer, SubmissionContentAnalyzer>();
        services.AddServiceWithLogging<Nexora.Application.Features.CitizenSubmissions.IMuhtarDashboardService, MuhtarDashboardService>();
        services.AddServiceWithLogging<IEventNotificationService, EventNotificationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Notifications.INotificationBroadcastService, NotificationBroadcastService>();
        services.AddServiceWithLogging<IEventService, EventService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Quizzes.IQuizCategoryService, QuizCategoryService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Quizzes.IQuizAgeGroupService, QuizAgeGroupService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Quizzes.IQuizService, QuizService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Surveys.ISurveyService, SurveyService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Surveys.ISurveyPlatformService, SurveyPlatformService>();
        services.AddServiceWithLogging<ITravelCategoryService, TravelCategoryService>();
        services.AddServiceWithLogging<ITravelRouteService, TravelRouteService>();
        services.AddServiceWithLogging<ITravelService, TravelService>();
        services.AddServiceWithLogging<ITravelBusService, TravelBusService>();
        services.AddServiceWithLogging<ITravelApplicationService, TravelApplicationService>();
        services.AddServiceWithLogging<ITravelNotificationService, TravelNotificationService>();
        services.AddServiceWithLogging<ITravelSettingsService, TravelSettingsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Travels.ITravelBoardingService, TravelBoardingService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Travels.ITravelAttendanceService, TravelAttendanceService>();
        services.AddServiceWithLogging<ISessionService, SessionService>();
        services.AddServiceWithLogging<IEventApplicationService, EventApplicationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantEvents.IParticipantEventService, ParticipantEventService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantFacilities.IParticipantFacilityService, ParticipantFacilityService>();
        services.AddServiceWithLogging<Nexora.Application.Features.AccessibleApplications.IAccessibleApplicationService, AccessibleApplicationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantLibraries.IParticipantLibraryService, ParticipantLibraryService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantTravels.IParticipantTravelService, ParticipantTravelService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantEmergencyAreas.IParticipantEmergencyAreaService, ParticipantEmergencyAreaService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantLiveMap.IParticipantLiveMapService, ParticipantLiveMapService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantCampaigns.IParticipantCampaignService, ParticipantCampaignService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantWheels.IParticipantWheelService, ParticipantWheelService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantSubmissions.IParticipantSubmissionService, ParticipantSubmissionService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantQuizzes.IParticipantQuizService, ParticipantQuizService>();
        services.AddServiceWithLogging<Nexora.Application.Features.ParticipantSurveys.IParticipantSurveyService, ParticipantSurveyService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Reviews.IReviewService, ReviewService>();
        services.AddServiceWithLogging<Nexora.Application.Features.History.IHistoryService, HistoryService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Notifications.INotificationService, NotificationService>();
        services.AddScoped<Nexora.Application.Features.Team.ITeamScopeService, TeamScopeService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Presence.IPresenceService, PresenceService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Team.ITeamService, TeamService>();
        services.AddServiceWithLogging<IEventAttendanceService, EventAttendanceService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Scan.IFacilityEntryScanService, FacilityEntryScanService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Seda.ISedaApplicationService, SedaApplicationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Seda.ISedaSchoolService, SedaSchoolService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Seda.ISedaDefinitionService, SedaDefinitionService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Seda.ISedaPeriodService, SedaPeriodService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Seda.ISedaSettingsService, SedaSettingsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Seda.ISedaEducationRecordService, SedaEducationRecordService>();
        services.AddServiceWithLogging<Nexora.Application.Features.CitizenMenu.ICitizenMenuService, CitizenMenuService>();
        services.AddServiceWithLogging<Nexora.Application.Features.MobileMenu.IMobileMenuService, MobileMenuService>();
        services.AddServiceWithLogging<Nexora.Application.Features.MobileConfig.IMobileConfigService, MobileConfigService>();
        services.AddServiceWithLogging<Nexora.Application.Features.SystemBranding.ISystemBrandingService, SystemBrandingService>();
        services.AddServiceWithLogging<Nexora.Application.Features.AppMenu.IAppMenuService, AppMenuService>();
        services.AddServiceWithLogging<Nexora.Application.Features.TopMenu.ITopMenuService, TopMenuService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Loyalty.ILoyaltyService, LoyaltyService>();
        services.AddServiceWithLogging<Nexora.Application.Features.NotificationPreferences.INotificationPreferenceService, NotificationPreferenceService>();
        services.AddServiceWithLogging<Nexora.Application.Features.DevicePermissions.IDevicePermissionService, DevicePermissionService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Education.IEducationService, EducationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Seda.IMeSedaService, MeSedaService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilityService, FacilityService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilityBranchService, FacilityBranchService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilityGroupService, FacilityGroupService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilitySessionService, FacilitySessionService>();
        services.AddScoped<Nexora.Application.Features.Facilities.IFacilityParticipationLimitGuard, FacilityParticipationLimitGuard>();
        services.AddScoped<Nexora.Application.Features.Facilities.IFacilityCrossProgramLimitGuard, FacilityCrossProgramLimitGuard>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilityRegistrationService, FacilityRegistrationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilityApplicationService, FacilityApplicationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilityAttendanceService, FacilityAttendanceService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilityDeviceService, FacilityDeviceService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Devices.ILiderTekWebhookService, LiderTekWebhookService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilitySettingsService, FacilitySettingsService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilityReportService, FacilityReportService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilityInstructorService, FacilityInstructorService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Companies.ICompanyService, CompanyService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Companies.ICampaignService, CampaignService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Companies.IServiceCategoryService, ServiceCategoryService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Companies.IDiscountUsageService, DiscountUsageService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Companies.ICampaignRedemptionService, CampaignRedemptionService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Bakkart.IBakkartService, BakkartService>();
        services.AddServiceWithLogging<Nexora.Application.Features.CompanyAuth.ICompanyAuthService, CompanyAuthService>();
        services.AddServiceWithLogging<Nexora.Application.Features.CompanyMe.ICompanyMeService, CompanyMeService>();
        services.AddServiceWithLogging<Nexora.Application.Features.CompanyStaffAuth.ICompanyStaffAuthService, CompanyStaffAuthService>();
        services.AddServiceWithLogging<Nexora.Application.Features.QrSystem.IQrSystemService, QrSystemService>();
        services.AddHttpClient("sms")
            .ConfigurePrimaryHttpMessageHandler(sp =>
            {
                var handler = new HttpClientHandler();
                if (sp.GetRequiredService<IConfiguration>().GetValue("SmsSettings:AllowInvalidServerCertificate", false))
                    handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;
                return handler;
            });
        services.AddScoped<ISmsService, SmsService>();
        services.AddScoped<IEmailService, Nexora.Infrastructure.Services.Email.EmailService>();
        services.AddScoped<INotificationDispatcher, NotificationDispatcher>();
        services.AddScoped<IPushSender, FirebasePushSender>();
        services.AddScoped<IParticipantNotificationService, ParticipantNotificationService>();
        services.AddServiceWithLogging<Nexora.Application.Features.Facilities.IFacilityNotificationService, FacilityNotificationService>();
        services.AddScoped<IOtpService, OtpService>();

        // Kullanıcı isteği (2026-10-04): evrak yükleme güvenlik taraması — ClamavSettings:Enabled
        // açık olmadan gerçek ClamAvMalwareScanService (clamd TCP) devreye girmez, NoOp çalışır.
        services.AddScoped<IMalwareScanService>(sp =>
        {
            var cfg = sp.GetRequiredService<IConfiguration>();
            if (cfg.GetValue("ClamavSettings:Enabled", false))
                return ActivatorUtilities.CreateInstance<ClamAvMalwareScanService>(sp);
            return ActivatorUtilities.CreateInstance<NoOpMalwareScanService>(sp);
        });

        services.AddHttpClient();
        services.AddScoped<INviStsClient, NviStsClient>();
        services.AddScoped<NviMockService>();
        services.AddScoped<NviService>();
        services.AddScoped<INviService, NviServiceSelector>();

        var redisConnection = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrEmpty(redisConnection))
        {
            services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConnection));
            services.AddSingleton<IRedisService, RedisService>();

            // Online kullanici takibi Redis'e dayanir (dakika kovalari).
            services.AddSingleton<IOnlineUserTracker, OnlineUserTracker>();
        }
        else
        {
            // Redis yapilandirilmamissa online takibi sessizce devre disi kalir;
            // uygulama calismaya devam eder.
            services.AddSingleton<IOnlineUserTracker, NullOnlineUserTracker>();
        }

        var minioSettings = configuration.GetSection("MinioSettings").Get<MinioSettings>() ?? new();
        if (!string.IsNullOrEmpty(minioSettings.Endpoint))
        {
            services.AddMinio(client => client
                .WithEndpoint(minioSettings.Endpoint)
                .WithCredentials(minioSettings.AccessKey, minioSettings.SecretKey)
                .WithSSL(minioSettings.UseSSL)
                .Build());
            services.AddSingleton<IFileStorageService, MinioFileStorageService>();
            FileUrl.ConfigureInternalHost(minioSettings.Endpoint);
        }

        var hangfireEnabled = configuration.GetValue("Hangfire:Enabled", false);
        var pgConn          = configuration.GetConnectionString("PostgreSQL");

        services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IDutyPharmacySyncJob, Nexora.Infrastructure.Services.Scheduled.DutyPharmacySyncJob>();
        // AFAD toplanma alanları: Sultangazi Netcad GIS API (iki operasyon: login + query/GeoJSON).
        services.AddHttpClient<Nexora.Application.Features.EmergencyAreas.IAfadGisClient, Nexora.Infrastructure.Services.EmergencyAreas.AfadGisClient>(c =>
                c.Timeout = TimeSpan.FromSeconds(configuration.GetValue("AfadGis:TimeoutSeconds", 60)))
            .ConfigurePrimaryHttpMessageHandler(() =>
            {
                var handler = new SocketsHttpHandler();
                if (configuration.GetValue("AfadGis:AllowInvalidCertificate", false))
                    handler.SslOptions.RemoteCertificateValidationCallback = (_, _, _, _) => true;
                // AfadGis:ResolveIp: host adını sabit IP'ye bağla (iç ağ 192.168.0.154 vb.); SNI/sertifika host adıyla doğrulanır.
                if (System.Net.IPAddress.TryParse(configuration["AfadGis:ResolveIp"], out var pinnedIp))
                    handler.ConnectCallback = async (ctx, ct) =>
                    {
                        var socket = new System.Net.Sockets.Socket(pinnedIp.AddressFamily, System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp) { NoDelay = true };
                        try { await socket.ConnectAsync(pinnedIp, ctx.DnsEndPoint.Port, ct); }
                        catch { socket.Dispose(); throw; }
                        return new System.Net.Sockets.NetworkStream(socket, ownsSocket: true);
                    };
                return handler;
            });
        services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IAfadGisSyncJob, Nexora.Infrastructure.Services.Scheduled.AfadGisSyncJob>();
        services.AddScoped<Nexora.Infrastructure.Services.Scheduled.ITravelInviteSmsJob, Nexora.Infrastructure.Services.Scheduled.TravelInviteSmsJob>();
        services.AddScoped<Nexora.Infrastructure.Services.Scheduled.ITravelWaitlistPromotionRetryJob, Nexora.Infrastructure.Services.Scheduled.TravelWaitlistPromotionRetryJob>();

        if (hangfireEnabled && !string.IsNullOrEmpty(pgConn))
        {
            try
            {
                services.AddHangfire(cfg => cfg
                    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                    .UseSimpleAssemblyNameTypeSerializer()
                    .UseRecommendedSerializerSettings()
                    .UsePostgreSqlStorage(opts => opts.UseNpgsqlConnection(pgConn)));

                services.AddHangfireServer(opts =>
                {
                    opts.WorkerCount = configuration.GetValue("Hangfire:WorkerCount", 5);
                    opts.ServerName  = "nexora-hangfire";
                });

                services.AddScoped<IAuditLogRetentionJob, AuditLogRetentionJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.ILibraryMaintenanceJob, Nexora.Infrastructure.Services.Scheduled.LibraryMaintenanceJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IFacilityPeriodExpiryJob, Nexora.Infrastructure.Services.Scheduled.FacilityPeriodExpiryJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.ITravelExpiryJob, Nexora.Infrastructure.Services.Scheduled.TravelExpiryJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IEventExpiryJob, Nexora.Infrastructure.Services.Scheduled.EventExpiryJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IOnlineUserSnapshotJob, Nexora.Infrastructure.Services.Scheduled.OnlineUserSnapshotJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IFacilityAttendanceDeadlineJob, Nexora.Infrastructure.Services.Scheduled.FacilityAttendanceDeadlineJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IFacilityAutoCheckoutJob, Nexora.Infrastructure.Services.Scheduled.FacilityAutoCheckoutJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IDailyPlanReminderJob, Nexora.Infrastructure.Services.Scheduled.DailyPlanReminderJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.ISurveyActivationJob, Nexora.Infrastructure.Services.Scheduled.SurveyActivationJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IParticipationSurveyGenerationJob, Nexora.Infrastructure.Services.Scheduled.ParticipationSurveyGenerationJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IParticipantActivitySyncJob, Nexora.Infrastructure.Services.Scheduled.ParticipantActivitySyncJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.ITravelDepartureReminderJob, Nexora.Infrastructure.Services.Scheduled.TravelDepartureReminderJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IFacilitySessionReminderJob, Nexora.Infrastructure.Services.Scheduled.FacilitySessionReminderJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IEventAttendanceReminderJob, Nexora.Infrastructure.Services.Scheduled.EventAttendanceReminderJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.ICitizenSubmissionStatusCheckJob, Nexora.Infrastructure.Services.Scheduled.CitizenSubmissionStatusCheckJob>();
                services.AddScoped<Nexora.Infrastructure.Services.Scheduled.IBirthdayGreetingJob, Nexora.Infrastructure.Services.Scheduled.BirthdayGreetingJob>();
                services.AddHostedService<RecurringJobsBootstrapper>();
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    "Hangfire yapılandırması başarısız oldu; zamanlanmış görevler kaydedilemedi. " +
                    "Hangfire:Enabled kapatılabilir veya ConnectionStrings:PostgreSQL düzeltilebilir.", ex);
            }
        }

        var consulEnabled = configuration.GetValue<bool>("Consul:EnableServiceDiscovery");
        if (consulEnabled)
        {
            services.AddSingleton<IConsulClient>(_ =>
            {
                var addr  = configuration["Consul:Address"]!;
                var token = configuration["Consul:Token"];
                return new ConsulClient(cfg =>
                {
                    cfg.Address = new Uri(addr);
                    if (!string.IsNullOrEmpty(token)) cfg.Token = token;
                });
            });
            services.AddHostedService<ConsulServiceRegistration>();
        }

        return services;
    }

    public static IHealthChecksBuilder AddInfrastructureHealthChecks(
        this IHealthChecksBuilder builder,
        IConfiguration configuration)
    {
        var pg = configuration.GetConnectionString("PostgreSQL");
        if (!string.IsNullOrEmpty(pg))
            builder.AddNpgSql(pg, name: "postgresql", tags: ["db", "ready"]);

        var redis = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrEmpty(redis))
            builder.AddRedis(redis, name: "redis", tags: ["cache", "ready"]);

        var elk = configuration["ElkSettings:Uri"];
        if (!string.IsNullOrEmpty(elk))
            builder.AddElasticsearch(elk, name: "elasticsearch", tags: ["logging", "ready"]);

        var minioEndpoint = configuration["MinioSettings:Endpoint"];
        if (!string.IsNullOrEmpty(minioEndpoint))
            builder.AddCheck<MinioHealthCheck>("minio",
                failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Degraded,
                tags: ["storage", "ready"]);

        return builder;
    }
}
