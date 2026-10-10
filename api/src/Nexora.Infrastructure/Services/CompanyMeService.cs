using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Extensions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.CompanyMe;
using Nexora.Application.Features.CompanyStaffAuth;
using Nexora.Application.Features.CompanyStaffAuth.Dtos;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class CompanyMeService(
    IUnitOfWork uow,
    IAuditService audit,
    ICompanyService companyService,
    IServiceCategoryService serviceCategoryService,
    IQrTokenService qrTokenService,
    IRedisService redis,
    ICompanyStaffAuthService companyStaffAuth,
    IConfiguration config) : ICompanyMeService
{
    private const string Module = "Companies";

    private int RotationSeconds => config.GetValue("QrSettings:RotationSeconds", 60);
    private DateTime LocalToday => DateTime.UtcNow.AddMinutes(config.GetValue("FacilitySettings:LocalTimeZoneOffsetMinutes", 180)).Date;

    public async Task<CompanyDto> GetProfileAsync(Guid companyId, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        return await BuildCompanyDtoAsync(company, ct);
    }

    public async Task<CompanyDto> UpdateProfileAsync(Guid companyId, UpdateCompanyRequest req, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);

        if (await uow.Companies.ExistsByPhoneAsync(req.Phone, companyId, ct))
            throw new ConflictException("Bu telefon numarası ile kayıtlı firma var.", "DUPLICATE_PHONE");

        if (!string.IsNullOrWhiteSpace(req.Email) && await uow.Companies.ExistsByEmailAsync(req.Email, companyId, ct))
            throw new ConflictException("Bu e-posta ile kayıtlı firma var.", "DUPLICATE_EMAIL");

        var before = JsonSerializer.Serialize(Snapshot(company));
        company.UpdateProfile(req.Name, req.Phone, req.Email, req.Address, req.District ?? company.District,
            req.Logo, req.BannerImage, req.Description, req.Website, MapSocial(req.SocialMedia),
            req.Latitude, req.Longitude, req.GalleryImages, req.ServiceDescription, req.BannerImageMobile);
        if (req.ServiceCategoryId.HasValue)
            company.SetServiceCategory(req.ServiceCategoryId.Value);
        uow.Companies.Update(company);
        await uow.SaveChangesAsync(ct);

        if (req.ServiceCategoryId.HasValue)
            company = await LoadCompanyAsync(companyId, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Firma profilini güncelledi: {company.Name}",
            OldValues = before,
            NewValues = JsonSerializer.Serialize(Snapshot(company)),
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);

        return await BuildCompanyDtoAsync(company, ct);
    }

    public Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
        => companyService.UploadImageAsync(stream, fileName, contentType, ct);

    public async Task<PagedResult<CampaignDto>> GetMyCampaignsAsync(Guid companyId, CampaignListParams p, CancellationToken ct)
    {
        var scoped = p with { CompanyId = companyId };
        var paged = await uow.Campaigns.GetPagedAsync(scoped, ct);
        return new PagedResult<CampaignDto>
        {
            Items = paged.Items.Select(MapDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public Task<PagedResult<CompanyCampaignUsageDto>> GetMyCampaignUsagesAsync(Guid companyId, CompanyCampaignUsageListParams p, CancellationToken ct)
        => uow.DiscountUsages.GetCompanyUsagesAsync(companyId, p, ct);

    public async Task<CampaignDto> CreateCampaignAsync(Guid companyId, CreateMyCampaignRequest req, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        company.EnsureApproved();

        var campaign = Campaign.Create(
            companyId,
            req.Name,
            MapDiscountType(req.DiscountType),
            req.DiscountValue,
            req.PerUserLimit,
            req.TotalUsageLimit,
            req.MinOrderAmount,
            req.StartDate,
            req.EndDate,
            ParseCategory(req.Category),
            req.ImageUrl,
            req.Description,
            req.Rules,
            req.KvkkText);

        campaign.SyncProducts(MapProducts(req.Products));

        await uow.Campaigns.AddAsync(campaign, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Campaign",
            EntityId = campaign.Id,
            Module = Module,
            Description = $"Firma kampanya oluşturdu: {campaign.Name}",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);

        campaign = await uow.Campaigns.GetByIdWithCompanyAsync(campaign.Id, ct) ?? campaign;
        return MapDto(campaign);
    }

    public async Task<CampaignDto> UpdateCampaignAsync(Guid companyId, Guid campaignId, UpdateCampaignRequest req, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        company.EnsureApproved();

        var campaign = await uow.Campaigns.GetByIdWithCompanyAsync(campaignId, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        EnsureOwner(campaign, companyId);

        campaign.Update(
            req.Name,
            MapDiscountType(req.DiscountType),
            req.DiscountValue,
            req.PerUserLimit,
            req.TotalUsageLimit,
            req.MinOrderAmount,
            req.StartDate,
            req.EndDate,
            ParseCategory(req.Category),
            req.ImageUrl,
            req.Description,
            req.Rules,
            req.KvkkText);

        campaign.SyncProducts(MapProducts(req.Products));

        uow.Campaigns.Update(campaign);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Campaign",
            EntityId = campaign.Id,
            Module = Module,
            Description = $"Firma kampanya güncelledi: {campaign.Name}",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);

        return MapDto(campaign);
    }

    public async Task DeleteCampaignAsync(Guid companyId, Guid campaignId, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);

        var campaign = await uow.Campaigns.GetByIdAsync(campaignId, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        EnsureOwner(campaign, companyId);

        uow.Campaigns.Delete(campaign);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "Campaign",
            EntityId = campaign.Id,
            Module = Module,
            Description = $"Firma kampanya sildi: {campaign.Name}",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);
    }

    public async Task<CampaignDto> ToggleCampaignAsync(Guid companyId, Guid campaignId, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);

        var campaign = await uow.Campaigns.GetByIdWithCompanyAsync(campaignId, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

        EnsureOwner(campaign, companyId);

        campaign.SetStatus(campaign.Status == CampaignStatus.Active ? CampaignStatus.Passive : CampaignStatus.Active);
        uow.Campaigns.Update(campaign);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Campaign",
            EntityId = campaign.Id,
            Module = Module,
            Description = $"Firma kampanya durumunu değiştirdi: {campaign.Name} → {campaign.Status}",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);

        return MapDto(campaign);
    }

    public async Task<List<ServiceCategoryRefDto>> GetServiceCategoryOptionsAsync(CancellationToken ct)
        => await serviceCategoryService.GetOptionsAsync(ct);

    public async Task<ServiceCategoryRefDto> CreateServiceCategoryAsync(Guid companyId, string name, CancellationToken ct)
    {
        _ = await LoadCompanyAsync(companyId, ct);
        return await serviceCategoryService.CreateOrGetByNameAsync(name, ct);
    }

    public async Task<CompanyDto> SetServiceCategoryAsync(Guid companyId, Guid? categoryId, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        company.SetServiceCategory(categoryId);
        uow.Companies.Update(company);
        await uow.SaveChangesAsync(ct);

        company = await LoadCompanyAsync(companyId, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Firma hizmet kategorisi güncelledi: {company.Name}",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);

        return await BuildCompanyDtoAsync(company, ct);
    }

    public async Task<CampaignRedeemResultDto> RedeemByQrAsync(Guid companyId, string token, decimal? orderAmount, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);

        if (string.IsNullOrWhiteSpace(token) || !qrTokenService.IsRotatingToken(token))
            throw new ConflictException("Geçersiz QR kodu.", "INVALID_QR");

        if (!qrTokenService.TryParseSubjectId(token, out var participantId)
            || !qrTokenService.TryParseContext(token, out var context)
            || !context.StartsWith("campaign:", StringComparison.Ordinal)
            || !Guid.TryParse(context["campaign:".Length..], out var campaignId))
            throw new ConflictException("Geçersiz QR kodu.", "INVALID_QR");

        if (!qrTokenService.Verify(token, participantId, context, RotationSeconds))
            throw new ConflictException("QR kodu geçersiz veya süresi dolmuş. Tekrar deneyin.", "QR_INVALID_OR_EXPIRED");

        // DÜZELTME (2026-09-27, KAPSAMLI KAMPANYA TESTİ — P1 güvenlik bulgusu): QrTokenService
        // saf HMAC+zaman-penceresi doğrulaması yapıyor, tek kullanımlık (nonce/jti) takibi yok.
        // Canlı testte kanıtlandı: aynı rotasyon penceresi içinde (60sn + 1 tolerans penceresi,
        // pratikte ~60-120sn) AYNI QR görüntüsü art arda okutulduğunda her seferinde yeni bir
        // DiscountUsage kaydı oluşuyordu — personelin ekranı yanlışlıkla iki kez okutması veya
        // ekran görüntüsünün art arda ibraz edilmesiyle perUserLimit'in bir kısmı (veya tamamı,
        // limit>1 ise) TEK fiziksel ziyarette tüketilebiliyordu. Redis SETNX ile token'ın kendisi
        // artık ilk başarılı doğrulamadan sonra tüketilmiş sayılıyor (TTL = rotasyon penceresi ile
        // aynı, token zaten o süre sonunda geçersiz oluyor).
        var consumeKey = $"qr-campaign-consumed:{token}";
        if (!await redis.TrySetIfNotExistsAsync(consumeKey, TimeSpan.FromSeconds(RotationSeconds * 2), ct))
            throw new ConflictException("Bu QR kodu az önce kullanıldı. Vatandaştan güncel QR kodunu tekrar isteyin.", "QR_ALREADY_CONSUMED");

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kayıtlı kullanıcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        try
        {
            return await RecordUsageAsync(company, campaignId, participant, "QR", orderAmount, DateTime.UtcNow, ct);
        }
        catch
        {
            // İş kuralı hatasında (MIN_ORDER_NOT_MET, CAMPAIGN_LIMIT_REACHED vb.) gerçek bir
            // kullanım oluşmadı — tüketim kilidini geri al ki personel aynı QR penceresinde
            // (ör. tutarı düzeltip) tekrar deneyebilsin. Yalnızca GERÇEK bir DiscountUsage
            // kaydı oluşan başarı durumunda token tüketilmiş sayılır.
            await redis.RemoveAsync(consumeKey, ct);
            throw;
        }
    }

    public async Task<CampaignRedeemResultDto> RedeemManualAsync(Guid companyId, Guid campaignId, string? tckn, string? phone, decimal? orderAmount, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);

        var normalizedTckn = tckn?.Trim();
        var normalizedPhone = phone?.Trim();

        Participant? participant = null;
        if (!string.IsNullOrWhiteSpace(normalizedTckn))
            participant = await uow.Participants.GetByTcknAsync(normalizedTckn, ct);
        else if (!string.IsNullOrWhiteSpace(normalizedPhone))
            participant = await uow.Participants.GetByPhoneAsync(normalizedPhone, ct);
        else
            throw new ConflictException("TC kimlik no veya telefon numarası giriniz.", "IDENTIFIER_REQUIRED");

        if (participant is null)
            throw new ConflictException("Bu TC/telefon ile kayıtlı kullanıcı bulunamadı. Yalnızca uygulamaya üye kullanıcılar kampanyayı kullanabilir.", "PARTICIPANT_NOT_MEMBER");

        return await RecordUsageAsync(company, campaignId, participant, "MANUAL", orderAmount, null, ct);
    }

    // IDN-İşletme (2026-09-11): BusinessValidateScreen'in "önce ara, sonra doğrula"
    // akışı için — SearchParticipantAsync hiçbir kayıt oluşturmaz (salt-okunur
    // önizleme); gerçek kullanım kaydı yalnızca ValidateParticipantAsync
    // çağrıldığında (RedeemManualAsync üzerinden) oluşur.
    public async Task<ParticipantPreviewDto> SearchParticipantAsync(Guid companyId, Guid campaignId, SearchParticipantRequest req, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        var campaign = await uow.Campaigns.GetByIdAsync(campaignId, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");
        EnsureOwner(campaign, companyId);

        var tckn = req.Tckn?.Trim();
        var phone = req.Phone?.Trim();

        Participant? participant = null;
        if (!string.IsNullOrWhiteSpace(tckn))
            participant = await uow.Participants.GetByTcknAsync(tckn, ct);
        else if (!string.IsNullOrWhiteSpace(phone))
            participant = await uow.Participants.GetByPhoneAsync(phone, ct);
        else
            throw new ConflictException("TC kimlik no veya telefon numarası giriniz.", "IDENTIFIER_REQUIRED");

        if (participant is null)
            throw new NotFoundException(
                "Bu TC/telefon ile kayıtlı kullanıcı bulunamadı. Yalnızca uygulamaya üye kullanıcılar kampanyayı kullanabilir.",
                "PARTICIPATION_NOT_FOUND");

        return new ParticipantPreviewDto(
            participant.Id, participant.FullName, participant.Phone, participant.Tckn,
            campaign.Name, "Joined");
    }

    public async Task<CampaignRedeemResultDto> ValidateParticipantAsync(Guid companyId, Guid campaignId, Guid participantId, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "PARTICIPATION_NOT_FOUND");
        return await RedeemManualAsync(companyId, campaignId, participant.Tckn, participant.Phone, null, ct);
    }

    // IDN-İşletme (2026-09-11): mobil BusinessServiceFormScreen'in CRUD yaptığı
    // hizmet kataloğu (CompanyOffering). Campaign'den ayrı bir domain kavramı.
    public async Task<List<CompanyOfferingDto>> GetOfferingsAsync(Guid companyId, string? category, bool? isActive, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        var offerings = await uow.CompanyOfferings.FindAsync(o => o.CompanyId == companyId, ct);
        var query = offerings.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(o => string.Equals(o.Category, category, StringComparison.OrdinalIgnoreCase));
        if (isActive.HasValue)
            query = query.Where(o => o.IsActive == isActive.Value);
        return query.OrderByDescending(o => o.CreatedAt).Select(o => MapOfferingDto(o, company.Name)).ToList();
    }

    public async Task<CompanyOfferingStatsDto> GetOfferingStatsAsync(Guid companyId, CancellationToken ct)
    {
        var offerings = await uow.CompanyOfferings.FindAsync(o => o.CompanyId == companyId, ct);
        var categories = offerings.Select(o => o.Category).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(c => c).ToList();
        return new CompanyOfferingStatsDto(
            Total: offerings.Count,
            Popular: offerings.Count(o => o.IsPopular),
            CategoryCount: categories.Count,
            Categories: categories);
    }

    public async Task<CompanyOfferingDto> GetOfferingAsync(Guid companyId, Guid offeringId, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        var offering = await GetOwnedOfferingAsync(companyId, offeringId, ct);
        return MapOfferingDto(offering, company.Name);
    }

    public async Task<CompanyOfferingDto> CreateOfferingAsync(Guid companyId, CreateCompanyOfferingRequest req, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        ValidateOfferingInput(req.Name, req.Category, req.MinPrice, req.MaxPrice, req.MinDurationMinutes, req.MaxDurationMinutes);

        var offering = CompanyOffering.Create(
            companyId, req.Name, req.Description, req.Category,
            req.MinPrice, req.MaxPrice, req.MinDurationMinutes, req.MaxDurationMinutes,
            req.ImageUrl, req.IsPopular);
        await uow.CompanyOfferings.AddAsync(offering, ct);
        await uow.SaveChangesAsync(ct);
        return MapOfferingDto(offering, company.Name);
    }

    public async Task<CompanyOfferingDto> UpdateOfferingAsync(Guid companyId, Guid offeringId, UpdateCompanyOfferingRequest req, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        var offering = await GetOwnedOfferingAsync(companyId, offeringId, ct);
        ValidateOfferingInput(req.Name, req.Category, req.MinPrice, req.MaxPrice, req.MinDurationMinutes, req.MaxDurationMinutes);

        offering.Update(
            req.Name, req.Description, req.Category,
            req.MinPrice, req.MaxPrice, req.MinDurationMinutes, req.MaxDurationMinutes,
            req.ImageUrl, req.IsPopular, req.IsActive);
        uow.CompanyOfferings.Update(offering);
        await uow.SaveChangesAsync(ct);
        return MapOfferingDto(offering, company.Name);
    }

    public async Task DeleteOfferingAsync(Guid companyId, Guid offeringId, CancellationToken ct)
    {
        var offering = await GetOwnedOfferingAsync(companyId, offeringId, ct);
        uow.CompanyOfferings.Delete(offering);
        await uow.SaveChangesAsync(ct);
    }

    private async Task<CompanyOffering> GetOwnedOfferingAsync(Guid companyId, Guid offeringId, CancellationToken ct)
    {
        var offering = await uow.CompanyOfferings.GetByIdAsync(offeringId, ct)
            ?? throw new NotFoundException("Hizmet bulunamadı.", "OFFERING_NOT_FOUND");
        if (offering.CompanyId != companyId)
            throw new ForbiddenException("Bu hizmet size ait değil.", "NOT_OWNER");
        return offering;
    }

    private static void ValidateOfferingInput(string name, string category, decimal minPrice, decimal maxPrice, int minDuration, int maxDuration)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ConflictException("Hizmet adı zorunludur.", "OFFERING_NAME_REQUIRED");
        if (string.IsNullOrWhiteSpace(category))
            throw new ConflictException("Kategori zorunludur.", "OFFERING_CATEGORY_REQUIRED");
        if (minPrice < 0 || maxPrice < minPrice)
            throw new ConflictException("Fiyat aralığı geçersiz.", "OFFERING_PRICE_INVALID");
        if (minDuration < 0 || maxDuration < minDuration)
            throw new ConflictException("Süre aralığı geçersiz.", "OFFERING_DURATION_INVALID");
    }

    private static CompanyOfferingDto MapOfferingDto(CompanyOffering o, string companyName) => new(
        o.Id, o.CompanyId, companyName, o.Name, o.Description ?? string.Empty, o.Category,
        o.MinPrice, o.MaxPrice, o.MinDurationMinutes, o.MaxDurationMinutes, o.ImageUrl,
        o.IsPopular, o.IsActive, o.CreatedAt);

    public async Task<List<CompanyStaffDto>> GetStaffAsync(Guid companyId, CancellationToken ct)
    {
        var staff = await uow.CompanyStaffs.GetByCompanyIdAsync(companyId, ct);
        return staff.Select(MapStaffDto).ToList();
    }

    public async Task<CompanyStaffDto> CreateStaffAsync(Guid companyId, CreateCompanyStaffRequest req, CancellationToken ct)
    {
        var company = await LoadCompanyAsync(companyId, ct);
        company.EnsureApproved();

        // Personel telefonla giriş yapar: tek biçimde (0XXXXXXXXXX) saklanır.
        var phone = Nexora.Application.Common.Security.LoginIdentifier.NormalizeTrPhone(req.Phone);
        if (string.IsNullOrWhiteSpace(req.FullName))
            throw new ConflictException("Ad soyad zorunludur.", "STAFF_NAME_REQUIRED");
        if (string.IsNullOrWhiteSpace(phone))
            throw new ConflictException("Telefon numarası zorunludur.", "STAFF_PHONE_REQUIRED");
        Nexora.Infrastructure.Security.PasswordPolicy.EnsureValid(req.Password ?? "", "password");

        if (await uow.CompanyStaffs.ExistsByPhoneAsync(companyId, phone, null, ct))
            throw new ConflictException("Bu telefon numarasıyla kayıtlı bir personel zaten var.", "STAFF_DUPLICATE_PHONE");

        var staff = CompanyStaff.Create(companyId, req.FullName, phone, req.Email, Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(req.Password));
        staff.SetCanRedeem(req.CanRedeem);
        staff.SetCanManageCampaigns(req.CanManageCampaigns);

        await uow.CompanyStaffs.AddAsync(staff, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "CompanyStaff",
            EntityId = staff.Id,
            Module = Module,
            Description = $"Firma personeli eklendi: {staff.FullName} ({staff.Phone})",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);

        return MapStaffDto(staff);
    }

    public async Task<CompanyStaffDto> UpdateStaffAsync(Guid companyId, Guid staffId, UpdateCompanyStaffRequest req, CancellationToken ct)
    {
        var staff = await GetOwnedStaffAsync(companyId, staffId, ct);

        var phone = Nexora.Application.Common.Security.LoginIdentifier.NormalizeTrPhone(req.Phone);
        if (string.IsNullOrWhiteSpace(req.FullName))
            throw new ConflictException("Ad soyad zorunludur.", "STAFF_NAME_REQUIRED");
        if (string.IsNullOrWhiteSpace(phone))
            throw new ConflictException("Telefon numarası zorunludur.", "STAFF_PHONE_REQUIRED");
        if (await uow.CompanyStaffs.ExistsByPhoneAsync(companyId, phone, staffId, ct))
            throw new ConflictException("Bu telefon numarasıyla kayıtlı başka bir personel var.", "STAFF_DUPLICATE_PHONE");

        var permissionsChanged = staff.CanRedeem != req.CanRedeem || staff.CanManageCampaigns != req.CanManageCampaigns;

        staff.UpdateInfo(req.FullName, phone, req.Email);
        staff.SetCanRedeem(req.CanRedeem);
        staff.SetCanManageCampaigns(req.CanManageCampaigns);
        uow.CompanyStaffs.Update(staff);
        await uow.SaveChangesAsync(ct);

        if (permissionsChanged)
            await companyStaffAuth.TerminateSessionsAsync(staff.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "CompanyStaff",
            EntityId = staff.Id,
            Module = Module,
            Description = $"Firma personeli güncellendi: {staff.FullName}",
        }, ct);

        return MapStaffDto(staff);
    }

    public async Task<ResetCompanyStaffPasswordResultDto> ResetStaffPasswordAsync(Guid companyId, Guid staffId, CancellationToken ct)
    {
        var staff = await GetOwnedStaffAsync(companyId, staffId, ct);

        var useMock = config.GetValue("SmsSettings:UseMockMode", false);
        var length = config.GetValue<int>("PasswordPolicy:GeneratedLength");
        var newPassword = Nexora.Infrastructure.Security.PasswordGenerator.Generate(length, useMock);
        staff.CompletePasswordChange(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(newPassword));
        uow.CompanyStaffs.Update(staff);
        await uow.SaveChangesAsync(ct);

        await companyStaffAuth.TerminateSessionsAsync(staff.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordReset,
            EntityType = "CompanyStaff",
            EntityId = staff.Id,
            Module = Module,
            Description = $"Firma personeli şifresi sıfırlandı: {staff.FullName}",
        }, ct);

        return new ResetCompanyStaffPasswordResultDto(newPassword);
    }

    public async Task SetStaffPasswordAsync(Guid companyId, Guid staffId, SetStaffPasswordRequest req, CancellationToken ct)
    {
        var staff = await GetOwnedStaffAsync(companyId, staffId, ct);

        Nexora.Infrastructure.Security.PasswordPolicy.EnsureValid(req.NewPassword ?? "", "newPassword");

        staff.CompletePasswordChange(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(req.NewPassword));
        uow.CompanyStaffs.Update(staff);
        await uow.SaveChangesAsync(ct);

        await companyStaffAuth.TerminateSessionsAsync(staff.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordChange,
            EntityType = "CompanyStaff",
            EntityId = staff.Id,
            Module = Module,
            Description = $"Firma personeli şifresi elle belirlendi: {staff.FullName}",
        }, ct);
    }

    public async Task<CompanyStaffDto> SetStaffActiveAsync(Guid companyId, Guid staffId, bool isActive, CancellationToken ct)
    {
        var staff = await GetOwnedStaffAsync(companyId, staffId, ct);
        if (isActive) staff.Activate(); else staff.Deactivate();
        uow.CompanyStaffs.Update(staff);
        await uow.SaveChangesAsync(ct);

        if (!isActive)
            await companyStaffAuth.TerminateSessionsAsync(staff.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "CompanyStaff",
            EntityId = staff.Id,
            Module = Module,
            Description = isActive
                ? $"Firma personeli aktifleştirildi: {staff.FullName}"
                : $"Firma personeli pasife alındı: {staff.FullName}",
        }, ct);

        return MapStaffDto(staff);
    }

    public async Task DeleteStaffAsync(Guid companyId, Guid staffId, CancellationToken ct)
    {
        var staff = await GetOwnedStaffAsync(companyId, staffId, ct);
        uow.CompanyStaffs.Delete(staff);
        await uow.SaveChangesAsync(ct);

        await companyStaffAuth.TerminateSessionsAsync(staff.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "CompanyStaff",
            EntityId = staff.Id,
            Module = Module,
            Description = $"Firma personeli silindi: {staff.FullName}",
        }, ct);
    }

    private async Task<CompanyStaff> GetOwnedStaffAsync(Guid companyId, Guid staffId, CancellationToken ct)
    {
        var staff = await uow.CompanyStaffs.GetByIdAsync(staffId, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");
        if (staff.CompanyId != companyId)
            throw new ForbiddenException("Bu personel size ait değil.", "NOT_OWNER");
        return staff;
    }

    private static CompanyStaffDto MapStaffDto(CompanyStaff s)
        => new(s.Id, s.CompanyId, s.FullName, s.Phone, s.Email, s.IsActive, s.CanRedeem, s.CanManageCampaigns, s.LastLoginAt, s.CreatedAt);

    private async Task<CampaignRedeemResultDto> RecordUsageAsync(Company company, Guid campaignId, Participant participant, string code, decimal? orderAmount, DateTime? qrScannedAt, CancellationToken ct)
    {
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            var result = await RecordUsageCoreAsync(company, campaignId, participant, code, orderAmount, qrScannedAt, ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
            return result;
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }
    }

    private static long CampaignLockKey(Guid campaignId) => BitConverter.ToInt64(campaignId.ToByteArray(), 0);

    private async Task<CampaignRedeemResultDto> RecordUsageCoreAsync(Company company, Guid campaignId, Participant participant, string code, decimal? orderAmount, DateTime? qrScannedAt, CancellationToken ct)
    {
        // DÜZELTME (2026-08-26, KAPSAMLI SİSTEM TESTİ, madde CMP-02 — P0 regresyon, önceki
        // #1/#6 fix'inin tamamlanmamış hali): CreateCampaignAsync/UpdateCampaignAsync onay
        // kontrolü yapıyordu ama redeem (kampanya KULLANDIRMA, hem manuel hem QR — ikisi de
        // buraya geliyor) hiç kontrol etmiyordu. Canlı testte kanıtlandı: reddedilmiş bir firma,
        // admin panelinden alınan bypass-code ile yeniden oturum açıp kampanya kullandırmaya
        // devam edebiliyordu. Artık redeem de onay durumunu zorunlu kılıyor.
        if (!company.IsApproved)
            throw new ForbiddenException("Firmanız aktif değil. Kampanya kullandıramazsınız.", "COMPANY_NOT_APPROVED");

        await uow.AcquireAdvisoryLockAsync(CampaignLockKey(campaignId), ct);

        var campaign = await uow.Campaigns.GetByIdWithCompanyAsync(campaignId, ct)
            ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");
        EnsureOwner(campaign, company.Id);

        if (!campaign.IsRedeemableOn(LocalToday))
            throw new ConflictException("Bu kampanya artık geçerli değil.", "CAMPAIGN_NOT_REDEEMABLE");

        if (campaign.MinOrderAmount > 0 && (orderAmount is null || orderAmount < campaign.MinOrderAmount))
            throw new ConflictException($"Bu kampanya en az {campaign.MinOrderAmount:0.##} ₺ alışverişte geçerlidir.", "MIN_ORDER_NOT_MET");

        var usedCount = await uow.DiscountUsages.CountUserUsageAsync(campaign.Id, participant.Id, ct)
            + await uow.CampaignRedemptions.CountByParticipantAndCampaignAsync(participant.Id, campaign.Id, ct);
        if (usedCount >= campaign.PerUserLimit)
            throw new ConflictException($"{participant.FullName} bu kampanya için kullanım hakkını ({campaign.PerUserLimit}) doldurmuş.", "CAMPAIGN_LIMIT_REACHED");

        var usage = DiscountUsage.Create(company.Id, campaign.Id, participant.Id, participant.FullName,
            participant.Phone, code, orderAmount, qrScannedAt);
        await uow.DiscountUsages.AddAsync(usage, ct);

        campaign.IncrementUsage();
        uow.Campaigns.Update(campaign);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.QrScan,
            EntityType = "DiscountUsage",
            EntityId = usage.Id,
            Module = Module,
            Description = $"Kampanya kullandırıldı: {campaign.Name} → {participant.FullName} ({(qrScannedAt.HasValue ? "QR" : "manuel")})",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);

        var newUsed = usedCount + 1;
        return new CampaignRedeemResultDto(
            campaign.Id,
            campaign.Name,
            company.Name,
            participant.FullName,
            campaign.DiscountType == DiscountType.Percentage ? "percentage" : "fixed",
            campaign.DiscountValue,
            campaign.PerUserLimit,
            newUsed,
            Math.Max(0, campaign.PerUserLimit - newUsed));
    }

    private async Task<Company> LoadCompanyAsync(Guid companyId, CancellationToken ct)
        => await uow.Companies.GetByIdWithServiceCategoryAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

    private static void EnsureApproved(Company company)
    {
        if (!company.IsApproved)
            throw new ForbiddenException("Firmanız henüz onaylanmadı. Kampanya oluşturamazsınız.", "COMPANY_NOT_APPROVED");
    }

    private static void EnsureOwner(Campaign campaign, Guid companyId)
    {
        if (campaign.CompanyId != companyId)
            throw new ForbiddenException("Bu kampanya size ait değil.", "NOT_OWNER");
    }

    private async Task<CompanyDto> BuildCompanyDtoAsync(Company company, CancellationToken ct)
    {
        var totalCampaigns = await uow.Companies.CountCampaignTotalsAsync(company.Id, ct);
        var totalUsages = await uow.Companies.CountUsageTotalsAsync(company.Id, ct);
        return MapCompanyDto(company, totalCampaigns, totalUsages);
    }

    private static DiscountType MapDiscountType(string type)
        => type == "percentage" ? DiscountType.Percentage : DiscountType.Fixed;

    private static CampaignCategory ParseCategory(string? category)
        => Enum.TryParse<CampaignCategory>(category, true, out var c) ? c : CampaignCategory.Other;

    private static IEnumerable<(Guid?, string, string?, decimal?, int)> MapProducts(List<CampaignProductInput>? products)
        => (products ?? [])
            .Where(p => !string.IsNullOrWhiteSpace(p.Name))
            .Select((p, i) => (p.Id, p.Name, p.ImageUrl, p.Price, p.SortOrder > 0 ? p.SortOrder : i));

    private static CompanySocialMedia? MapSocial(CompanySocialMediaDto? dto)
        => dto is null ? null : new CompanySocialMedia
        {
            Facebook = dto.Facebook,
            Instagram = dto.Instagram,
            Twitter = dto.Twitter,
            Linkedin = dto.Linkedin,
        };

    private static CompanySocialMediaDto? MapSocialDto(CompanySocialMedia? social)
        => social is null ? null : new CompanySocialMediaDto(social.Facebook, social.Instagram, social.Twitter, social.Linkedin);

    private static CampaignDto MapDto(Campaign c)
        => new(
            c.Id, c.CompanyId, c.Company?.Name ?? "",
            c.Name, c.DiscountType == DiscountType.Percentage ? "percentage" : "fixed", c.DiscountValue,
            c.PerUserLimit, c.TotalUsageLimit, c.MinOrderAmount, c.StartDate, c.EndDate,
            c.UsageCount, c.Status.ToString(), c.Category.ToString(),
            c.IsRedeemable,
            c.TotalUsageLimit.HasValue && c.UsageCount >= c.TotalUsageLimit.Value,
            c.Company?.ServiceCategory is not null ? new ServiceCategoryRefDto(c.Company.ServiceCategory.Id, c.Company.ServiceCategory.Name, c.Company.ServiceCategory.Color) : null,
            c.CreatedAt, c.UpdatedAt, c.ImageUrl, c.Description, c.Rules, c.KvkkText,
            c.Products.OrderBy(p => p.SortOrder).Select(p => new CampaignProductDto(p.Id, p.Name, p.ImageUrl, p.Price, p.SortOrder)).ToList());

    private static CompanyDto MapCompanyDto(Company c, int totalCampaigns, int totalUsages)
        => new(
            c.Id, c.Name, c.TaxNumber, c.Phone, c.Email, c.Address, c.District,
            c.Status.ToString(), c.EmailVerified, c.PhoneVerified,
            c.Logo, c.BannerImage, c.BannerImageMobile, c.Description, c.Website, MapSocialDto(c.SocialMedia),
            c.Latitude, c.Longitude, c.RejectReason,
            c.ServiceCategory is not null ? new ServiceCategoryRefDto(c.ServiceCategory.Id, c.ServiceCategory.Name, c.ServiceCategory.Color) : null,
            totalCampaigns, totalUsages, c.CreatedAt, c.UpdatedAt, c.GalleryImages, c.ServiceDescription,
            c.KvkkAcceptedAt.HasValue, c.NotificationConsentAcceptedAt.HasValue);

    private static object Snapshot(Company c) => new
    {
        c.Name,
        c.Email,
        c.Phone,
        c.Address,
    };
}
