using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Popups;
using Nexora.Application.Features.Popups.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Enums;
using Nexora.Domain.Entities.Popups;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class PopupService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IActivityLogger log,
    IAuditService audit,
    IServiceProvider serviceProvider,
    IOptionsMonitor<MinioSettings> minioOptions) : IPopupService
{
    public async Task<PagedResult<PopupCampaignDto>> GetPagedAsync(PopupListParams p, CancellationToken ct)
    {
        var paged = await uow.Popups.GetPagedAsync(p, ct);
        return new PagedResult<PopupCampaignDto>
        {
            Items = paged.Items.Select(ToDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<PopupSummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var (total, active, mandatory) = await uow.Popups.GetSummaryCountsAsync(ct);
        return new PopupSummaryDto(total, active, mandatory);
    }

    public async Task<PopupCampaignDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var popup = await uow.Popups.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Popup bulunamadı.", "POPUP_NOT_FOUND");
        return ToDto(popup);
    }

    public async Task<PopupCampaignDto> CreateAsync(UpsertPopupRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Title, req.TriggerType });

        var popup = PopupCampaign.Create(ToData(req), currentUser.Name);
        await uow.Popups.AddAsync(popup, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = nameof(PopupCampaign),
            EntityId = popup.Id,
            Module = "Popup",
            Description = $"Popup oluşturuldu: {popup.Title}" + (popup.IsMandatory ? " (zorunlu)" : string.Empty),
        }, ct);

        return ToDto(popup);
    }

    public async Task<PopupCampaignDto> UpdateAsync(Guid id, UpsertPopupRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id, req.Title });

        var popup = await uow.Popups.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Popup bulunamadı.", "POPUP_NOT_FOUND");

        var oldTitle = popup.Title;
        popup.Update(ToData(req), currentUser.Name);
        uow.Popups.Update(popup);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(PopupCampaign),
            EntityId = popup.Id,
            Module = "Popup",
            Description = $"Popup güncellendi: {oldTitle} → {popup.Title}",
        }, ct);

        return ToDto(popup);
    }

    public async Task<PopupCampaignDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var popup = await uow.Popups.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Popup bulunamadı.", "POPUP_NOT_FOUND");

        if (popup.IsActive) popup.Deactivate(); else popup.Activate();
        uow.Popups.Update(popup);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = nameof(PopupCampaign),
            EntityId = popup.Id,
            Module = "Popup",
            Description = $"Popup {(popup.IsActive ? "aktif edildi" : "pasife alındı")}: {popup.Title}",
        }, ct);

        return ToDto(popup);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var popup = await uow.Popups.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Popup bulunamadı.", "POPUP_NOT_FOUND");

        uow.Popups.Delete(popup);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = nameof(PopupCampaign),
            EntityId = popup.Id,
            Module = "Popup",
            Description = $"Popup silindi: {popup.Title}",
        }, ct);
    }

    public async Task<string> UploadMediaAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var storage = serviceProvider.GetService<IFileStorageService>()
            ?? throw new ConflictException("Dosya depolama servisi yapılandırılmamış.", "STORAGE_NOT_CONFIGURED");

        var bucket = minioOptions.CurrentValue.PublicBucket;
        var result = await storage.UploadAsync(stream, fileName, contentType, bucket, ct, keyPrefix: "popup-media");
        return result.Url;
    }

    // --- Vatandaş ---

    public async Task<CitizenPopupDto?> GetNextForTriggerAsync(string triggerType, string? moduleKey, CancellationToken ct)
    {
        if (!currentUser.Id.HasValue) return null;
        var participantId = currentUser.Id.Value;

        var now = DateTime.UtcNow; // UAT 2026-09-24: alan UTC saklanır; duvar saati (UTC+3) ile kıyas pencereyi 3 saat kaydırıyordu
        var candidates = await uow.Popups.GetEligibleForTriggerAsync(triggerType, moduleKey, now, ct);
        if (candidates.Count == 0) return null;

        var views = await uow.Popups.GetViewsForParticipantAsync(candidates.Select(c => c.Id).ToList(), participantId, ct);

        foreach (var popup in candidates)
        {
            views.TryGetValue(popup.Id, out var view);

            // first_login: bu vatandaş için DAHA ÖNCE hiç gösterilmemiş olmalı (tek seferlik).
            if (popup.TriggerType == PopupTriggerTypes.FirstLogin && view is not null)
                continue;

            if (view is not null)
            {
                // Zorunlu popup onaylanana kadar HER zaman tekrar gösterilir (RepeatIntervalHours yok sayılır).
                if (popup.IsMandatory)
                {
                    if (view.AcknowledgedAt.HasValue) continue;
                }
                else
                {
                    if (view.DismissedForever) continue;
                    if (view.AcknowledgedAt.HasValue && popup.RepeatIntervalHours <= 0) continue;
                    if (view.AcknowledgedAt.HasValue && popup.RepeatIntervalHours > 0)
                    {
                        var nextEligible = view.AcknowledgedAt.Value.AddHours(popup.RepeatIntervalHours);
                        if (DateTime.UtcNow < nextEligible) continue;
                    }
                }
            }

            // Uygun popup bulundu — gösterim kaydı düş (view sayaç/son gösterim zamanı).
            if (view is null)
            {
                view = PopupView.Create(popup.Id, participantId);
                await uow.Popups.AddViewAsync(view, ct);
            }
            else
            {
                view.RecordShown();
                uow.Popups.UpdateView(view);
            }
            popup.IncrementViewCount();
            uow.Popups.Update(popup);
            await uow.SaveChangesAsync(ct);

            return ToCitizenDto(popup);
        }

        return null;
    }

    public async Task AcknowledgeAsync(Guid popupId, PopupAcknowledgeRequest req, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var popup = await uow.Popups.GetByIdAsync(popupId, ct)
            ?? throw new NotFoundException("Popup bulunamadı.", "POPUP_NOT_FOUND");

        var existingView = await uow.Popups.GetViewAsync(popupId, actorId, ct);
        var view = existingView ?? PopupView.Create(popupId, actorId);

        // Zorunlu popup'ta "bir daha gösterme" seçeneği anlamsızdır — okundu onayı yeterlidir,
        // domain katmanında zaten AllowDismissForever=false olarak zorlanır (bkz. PopupCampaign.Apply).
        if (req.DismissForever && popup.AllowDismissForever)
            view.DismissForever();
        else
            view.Acknowledge();

        if (existingView is null)
            await uow.Popups.AddViewAsync(view, ct);
        else
            uow.Popups.UpdateView(view);

        popup.IncrementAcknowledgeCount();
        uow.Popups.Update(popup);

        await uow.SaveChangesAsync(ct);
    }

    private static PopupCampaignData ToData(UpsertPopupRequest r)
        => new(r.Title, r.IsMandatory, r.AllowDismissForever, r.RepeatIntervalHours, r.TriggerType, r.TriggerModuleKey,
            r.StartDate, r.EndDate, r.MinDisplaySeconds, r.IsActive, r.Priority,
            r.MediaItems.Select(m => new PopupMediaItem { Type = m.Type, Url = m.Url, Text = m.Text }).ToList());

    private static PopupCampaignDto ToDto(PopupCampaign p)
        => new(p.Id, p.Title, p.IsMandatory, p.AllowDismissForever, p.RepeatIntervalHours, p.TriggerType, p.TriggerModuleKey,
            p.StartDate, p.EndDate, p.MinDisplaySeconds, p.IsActive, p.Priority, p.ViewCount, p.AcknowledgeCount,
            p.MediaItems.OrderBy(m => m.Order).Select(m => new PopupMediaItemDto(m.Order, m.Type, m.Url, m.Text)).ToList(),
            p.CreatedAt, p.UpdatedAt);

    private static CitizenPopupDto ToCitizenDto(PopupCampaign p)
        => new(p.Id, p.Title, p.IsMandatory, p.AllowDismissForever, p.MinDisplaySeconds,
            p.MediaItems.OrderBy(m => m.Order).Select(m => new CitizenPopupMediaDto(m.Order, m.Type, m.Url, m.Text)).ToList());
}
