using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Extensions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.QrSystem;
using Nexora.Application.Features.QrSystem.Dtos;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class QrSystemService(
    IUnitOfWork uow,
    IQrTokenService qrTokenService,
    IConfiguration config,
    IMemoryCache cache,
    IActivityLogger log) : IQrSystemService
{
    private int CitizenTokenWindowSeconds
        => config.GetValue("QrSettings:CitizenTokenWindowSeconds", 30);

    private static string ScanGrantKey(Guid companyId, Guid participantId) => $"qr-scan-grant:{companyId}:{participantId}";
    private static readonly TimeSpan ScanGrantTtl = TimeSpan.FromMinutes(5);

    public async Task<CitizenQrTokenDto> GenerateCitizenTokenAsync(Guid participantId, CancellationToken ct)
    {
        log.LogStep(nameof(GenerateCitizenTokenAsync), new { participantId });

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Vatandaş bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var context = $"citizen:{participantId}";
        var windowSeconds = CitizenTokenWindowSeconds;
        var token = qrTokenService.Generate(participantId, context, windowSeconds);

        log.LogStepResult(nameof(GenerateCitizenTokenAsync), new { participantId });

        return new CitizenQrTokenDto(token, windowSeconds, DateTime.UtcNow);
    }

    public async Task<ScanCitizenQrResultDto> ScanCitizenQrAsync(string token, Guid companyId, CancellationToken ct)
    {
        log.LogStep(nameof(ScanCitizenQrAsync), new { companyId });

        if (!qrTokenService.IsRotatingToken(token))
            throw new ConflictException("Geçersiz QR kodu formatı.", "INVALID_QR_FORMAT");

        if (!qrTokenService.TryParseSubjectId(token, out var participantId))
            throw new ConflictException("QR kodu okunamadı.", "QR_PARSE_ERROR");

        var context = $"citizen:{participantId}";
        if (!qrTokenService.Verify(token, participantId, context, CitizenTokenWindowSeconds))
            throw new ConflictException("QR kodun süresi dolmuş veya geçersiz.", "QR_EXPIRED_OR_INVALID");

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Vatandaş bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var campaigns = await uow.Campaigns.FindAsync(
            c => c.CompanyId == companyId && !c.IsDeleted, ct);

        var activeCampaigns = await FilterRedeemableForParticipantAsync(campaigns.Where(c => c.IsRedeemable).ToList(), participantId, ct);

        log.LogStepResult(nameof(ScanCitizenQrAsync), new { participantId, activeCampaignCount = activeCampaigns.Count });

        cache.Set(ScanGrantKey(companyId, participantId), true, ScanGrantTtl);

        return new ScanCitizenQrResultDto(
            participant.Id,
            participant.FullName,
            participant.PhotoUrl,
            activeCampaigns);
    }

    public async Task<RedemptionDto> RedeemCampaignAsync(Guid companyId, RedeemCampaignRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(RedeemCampaignAsync), new { companyId, req.ParticipantId, req.CampaignId });

        var grantKey = ScanGrantKey(companyId, req.ParticipantId);
        if (!cache.TryGetValue(grantKey, out _))
            throw new ConflictException("Bu kullanım için önce vatandaşın QR kodunu okutmanız gerekiyor.", "SCAN_REQUIRED_BEFORE_REDEEM");
        cache.Remove(grantKey);

        return await RedeemCampaignCoreAsync(companyId, req, ct);
    }

    private async Task<RedemptionDto> RedeemCampaignCoreAsync(Guid companyId, RedeemCampaignRequest req, CancellationToken ct)
    {
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            var result = await RedeemCampaignCoreLockedAsync(companyId, req, ct);
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

    private async Task<RedemptionDto> RedeemCampaignCoreLockedAsync(Guid companyId, RedeemCampaignRequest req, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(req.ParticipantId, ct)
            ?? throw new NotFoundException("Vatandaş bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        company.EnsureApproved();

        Campaign? campaign = null;
        if (req.CampaignId.HasValue)
        {
            await uow.AcquireAdvisoryLockAsync(CampaignLockKey(req.CampaignId.Value), ct);

            campaign = await uow.Campaigns.GetByIdWithCompanyAsync(req.CampaignId.Value, ct)
                ?? throw new NotFoundException("Kampanya bulunamadı.", "CAMPAIGN_NOT_FOUND");

            if (campaign.CompanyId != companyId)
                throw new ForbiddenException("Bu kampanya sizin firmanıza ait değil.", "CAMPAIGN_NOT_OWNED");

            if (!campaign.IsRedeemable)
                throw new ConflictException("Kampanya şu an aktif değil veya süresi dolmuş.", "CAMPAIGN_NOT_REDEEMABLE");

            if (campaign.MinOrderAmount > 0 && (req.OrderAmount is null || req.OrderAmount < campaign.MinOrderAmount))
                throw new ConflictException($"Bu kampanya en az {campaign.MinOrderAmount:0.##} ₺ alışverişte geçerlidir.", "MIN_ORDER_NOT_MET");

            var usageCount = await uow.CampaignRedemptions.CountByParticipantAndCampaignAsync(
                req.ParticipantId, req.CampaignId.Value, ct)
                + await uow.DiscountUsages.CountUserUsageAsync(req.CampaignId.Value, req.ParticipantId, ct);

            if (usageCount >= campaign.PerUserLimit)
                throw new ConflictException("Bu vatandaş kampanya kullanım limitine ulaştı.", "CAMPAIGN_USER_LIMIT_EXCEEDED");

            campaign.IncrementUsage();
            uow.Campaigns.Update(campaign);
        }

        var redemption = CampaignRedemption.Create(
            req.ParticipantId,
            companyId,
            req.CampaignId,
            RedemptionType.QrScan,
            req.Notes);

        await uow.CampaignRedemptions.AddAsync(redemption, ct);
        await uow.SaveChangesAsync(ct);

        log.LogStepResult(nameof(RedeemCampaignAsync), new { redemption.Id, redemption.RedemptionCode });

        return new RedemptionDto(
            redemption.Id,
            redemption.RedemptionCode,
            redemption.RedemptionType,
            participant.Id,
            participant.FullName,
            company.Id,
            company.Name,
            campaign?.Id,
            campaign?.Name,
            redemption.Notes,
            redemption.RedeemedAt);
    }

    public async Task<RedemptionDto> RedeemCampaignByStaticCodeAsync(string staticCode, RedeemCampaignRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(RedeemCampaignByStaticCodeAsync), new { req.ParticipantId, req.CampaignId });

        var qrCode = await uow.CompanyQrCodes.GetByStaticCodeAsync(staticCode, ct)
            ?? throw new NotFoundException("QR kod bulunamadı.", "QR_NOT_FOUND");

        if (!qrCode.IsActive)
            throw new ConflictException("Bu QR kod artık aktif değil.", "QR_INACTIVE");

        if (qrCode.ValidUntil.HasValue && qrCode.ValidUntil.Value < DateTime.UtcNow)
            throw new ConflictException("Bu QR kodun geçerlilik süresi dolmuş.", "QR_EXPIRED");

        return await RedeemCampaignCoreAsync(qrCode.CompanyId, req, ct);
    }

    public async Task<CompanyQrCodeDto> GenerateCompanyQrAsync(Guid companyId, GenerateCompanyQrRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(GenerateCompanyQrAsync), new { companyId });

        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");
        _ = company;

        var existing = await uow.CompanyQrCodes.GetActiveByCompanyIdAsync(companyId, ct);
        if (existing is not null)
        {
            if (req.ValidUntil == null && req.Purpose == null)
            {
                log.LogStepResult(nameof(GenerateCompanyQrAsync), new { existing.Id, reused = true });
                return MapToDto(existing);
            }
            existing.Deactivate();
        }

        var qrCode = CompanyQrCode.Create(companyId, req.Purpose, req.ValidUntil);
        await uow.CompanyQrCodes.AddAsync(qrCode, ct);
        await uow.SaveChangesAsync(ct);

        log.LogStepResult(nameof(GenerateCompanyQrAsync), new { qrCode.Id, qrCode.StaticCode });

        return MapToDto(qrCode);
    }

    public async Task<ScanCompanyQrResultDto> ScanCompanyQrAsync(string staticCode, Guid participantId, CancellationToken ct)
    {
        log.LogStep(nameof(ScanCompanyQrAsync), new { participantId });

        var qrCode = await uow.CompanyQrCodes.GetByStaticCodeAsync(staticCode, ct)
            ?? throw new NotFoundException("QR kod bulunamadı.", "QR_NOT_FOUND");

        if (!qrCode.IsActive)
            throw new ConflictException("Bu QR kod artık aktif değil.", "QR_INACTIVE");

        if (qrCode.ValidUntil.HasValue && qrCode.ValidUntil.Value < DateTime.UtcNow)
            throw new ConflictException("Bu QR kodun geçerlilik süresi dolmuş.", "QR_EXPIRED");

        qrCode.Company.EnsureApproved();

        var campaigns = await uow.Campaigns.FindAsync(
            c => c.CompanyId == qrCode.CompanyId && !c.IsDeleted, ct);

        var activeCampaigns = await FilterRedeemableForParticipantAsync(campaigns.Where(c => c.IsRedeemable).ToList(), participantId, ct);

        log.LogStepResult(nameof(ScanCompanyQrAsync), new { companyId = qrCode.CompanyId, activeCampaignCount = activeCampaigns.Count });

        return new ScanCompanyQrResultDto(
            qrCode.Company.Id,
            qrCode.Company.Name,
            qrCode.Company.Logo,
            activeCampaigns);
    }

    public async Task DeactivateCompanyQrAsync(Guid qrCodeId, Guid companyId, CancellationToken ct)
    {
        log.LogStep(nameof(DeactivateCompanyQrAsync), new { qrCodeId, companyId });

        var qrCode = await uow.CompanyQrCodes.GetByIdAsync(qrCodeId, ct)
            ?? throw new NotFoundException("QR kod bulunamadı.", "QR_NOT_FOUND");

        if (qrCode.CompanyId != companyId)
            throw new ForbiddenException("Bu QR kod sizin firmanıza ait değil.", "QR_NOT_OWNED");

        qrCode.Deactivate();
        await uow.SaveChangesAsync(ct);

        log.LogStepResult(nameof(DeactivateCompanyQrAsync), new { qrCodeId });
    }

    public async Task<List<RedemptionDto>> GetCompanyRedemptionsAsync(Guid companyId, CancellationToken ct)
    {
        var redemptions = await uow.CampaignRedemptions.GetByCompanyIdAsync(companyId, ct);
        return redemptions.Select(r => new RedemptionDto(
            r.Id,
            r.RedemptionCode,
            r.RedemptionType,
            r.Participant.Id,
            r.Participant.FullName,
            r.Company?.Id ?? companyId,
            r.Company?.Name ?? "",
            r.Campaign?.Id,
            r.Campaign?.Name,
            r.Notes,
            r.RedeemedAt)).ToList();
    }

    public async Task<List<RedemptionDto>> GetParticipantRedemptionsAsync(Guid participantId, CancellationToken ct)
    {
        var redemptions = await uow.CampaignRedemptions.GetByParticipantIdAsync(participantId, ct);
        return redemptions.Select(r => new RedemptionDto(
            r.Id,
            r.RedemptionCode,
            r.RedemptionType,
            participantId,
            r.Participant?.FullName ?? "",
            r.Company.Id,
            r.Company.Name,
            r.Campaign?.Id,
            r.Campaign?.Name,
            r.Notes,
            r.RedeemedAt)).ToList();
    }

    private static CompanyQrCodeDto MapToDto(CompanyQrCode q)
        => new(q.Id, q.CompanyId, q.StaticCode, q.IsActive, q.ValidUntil, q.Purpose, q.CreatedAt);

    private async Task<List<ActiveCampaignDto>> FilterRedeemableForParticipantAsync(List<Campaign> campaigns, Guid participantId, CancellationToken ct)
    {
        if (campaigns.Count == 0) return [];

        var campaignIds = campaigns.Select(c => c.Id).ToList();
        var discountUsageCounts = await uow.DiscountUsages.GetUserUsageCountsByCampaignsAsync(participantId, campaignIds, ct);
        var redemptionCounts = await uow.CampaignRedemptions.GetParticipantCountsByCampaignsAsync(participantId, campaignIds, ct);

        return campaigns
            .Where(c =>
            {
                var used = discountUsageCounts.GetValueOrDefault(c.Id, 0) + redemptionCounts.GetValueOrDefault(c.Id, 0);
                return used < c.PerUserLimit;
            })
            .Select(c => new ActiveCampaignDto(
                c.Id,
                c.Name,
                c.DiscountType,
                c.DiscountValue,
                c.EndDate,
                c.Description,
                c.MinOrderAmount))
            .ToList();
    }
}
