namespace Nexora.Application.Features.CitizenSubmissions.Dtos;

/// <summary>
/// Kullanıcı isteği (2026-08-28): "çözüldüğünde veya bilgi geldiğinde kişiye bildirim gelmeli
/// olayın ne olduğu" — <see cref="Note"/> vatandaşa gönderilen bildirimde ve süreç zaman
/// çizelgesinde görünen açıklamadır (opsiyonel).
/// </summary>
public record UpdateSubmissionStatusRequest(string Status, string? Note = null);
