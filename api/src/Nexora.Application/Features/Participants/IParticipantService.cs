using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Participants.Dtos;

namespace Nexora.Application.Features.Participants;

public interface IParticipantService
{
    Task<PagedResult<ParticipantDto>> GetPagedAsync(ParticipantListParams p, CancellationToken ct);
    Task<ParticipantSummaryDto> GetSummaryAsync(ParticipantListParams p, CancellationToken ct);
    Task<ParticipantDetailDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<NviLookupResultDto> NviLookupAsync(NviLookupRequest req, CancellationToken ct);
    Task<ParticipantLookupResultDto> LookupByTcknAsync(string tckn, CancellationToken ct);
    Task<ParticipantDto> CreateAsync(CreateParticipantRequest req, CancellationToken ct);
    Task<ParticipantDto> UpdateAsync(Guid id, UpdateParticipantRequest req, CancellationToken ct);
    Task<ParticipantDto> RefreshFromNviAsync(Guid id, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<ParticipantDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<ParticipantDto> SetStatusAsync(Guid id, SetStatusRequest req, CancellationToken ct);
    Task SendPasswordResetAsync(Guid id, SendPasswordResetRequest req, CancellationToken ct);
    Task SetManualPasswordAsync(Guid id, SetManualPasswordRequest req, CancellationToken ct);
    Task UpdateAdminNotesAsync(Guid id, string? notes, CancellationToken ct);
    // Kullanıcı isteği (2026-08-05): AdminUser'daki manuel kilit kaldırma özelliğinin aynısı
    // katılımcılar için de eklendi (bkz. AdminUserManagementService.UnlockAsync).
    Task<ParticipantDto> UnlockAsync(Guid id, CancellationToken ct);

    // Kullanıcı isteği (2026-09-28): randevu sistemi giriş anahtarı (bkz. Participant.AppointmentKey).
    Task<AppointmentKeyDto> GetAppointmentKeyAsync(Guid id, CancellationToken ct);
    Task<AppointmentKeyDto> GenerateAppointmentKeyAsync(Guid id, CancellationToken ct);
    Task RevokeAppointmentKeyAsync(Guid id, CancellationToken ct);
    /// <summary>Vatandaşın kendi anahtarı (admin kapsam kontrolü yok; yalnız /me ucu çağırır).</summary>
    Task<AppointmentKeyDto> GetOwnAppointmentKeyAsync(Guid participantId, CancellationToken ct);

    // Kullanıcı isteği (2026-08-05): katılımcı detayındaki "Anketler" sekmesi gerçek veriye
    // bağlansın — bu kişinin katıldığı anketler ve verdiği cevaplar (anonim anketler hariç,
    // bkz. ISurveyRepository.GetResponsesForParticipantAsync).
    Task<List<ParticipantSurveyResponseDto>> GetSurveyHistoryAsync(Guid id, CancellationToken ct);

    // Kullanıcı isteği (2026-08-05): katılımcı detayında bu kişiye gönderilmiş bildirim/mesaj
    // geçmişi görüntülensin (bkz. INotificationRepository.GetPagedByRecipientAsync).
    Task<PagedResult<ParticipantNotificationDto>> GetNotificationsAsync(Guid id, ParticipantNotificationListParams p, CancellationToken ct);
}
