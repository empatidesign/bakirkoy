using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;

namespace Nexora.Application.Common.Repositories;

public interface IEventApplicationRepository : IRepository<EventApplication>
{
    Task<PagedResult<EventApplication>> GetPagedAsync(ApplicationListParams p, IReadOnlyCollection<Guid>? scopedEventIds, CancellationToken ct);
    Task<PagedResult<EventApplication>> GetByParticipantsAsync(List<Guid> participantIds, string? status, string? period, int page, int limit, CancellationToken ct);
    Task<List<Guid>> GetParticipantIdsBySessionsAsync(IReadOnlyCollection<Guid> sessionIds, CancellationToken ct);
    Task<List<Guid>> GetParticipantIdsByEventsAsync(IReadOnlyCollection<Guid> eventIds, CancellationToken ct);
    Task<(int Total, int Approved, int Pending, int Rejected, int Reviewing, int Waitlist)> GetSummaryAsync(Guid? eventId, Guid? sessionId, CancellationToken ct);
    Task<int> CountByEventAndStatusAsync(Guid eventId, string status, CancellationToken ct);
    Task<int> GetWaitlistPositionAsync(Guid eventId, Guid? sessionId, Guid applicationId, CancellationToken ct);
    Task<(int Approved, int Pending, int Waitlist)> CountByScopeAsync(Guid eventId, Guid? sessionId, CancellationToken ct);
    Task<List<EventApplication>> GetWaitlistOrderedAsync(Guid eventId, Guid? sessionId, CancellationToken ct);
    Task<int> CountActiveByParticipantInWindowAsync(Guid eventId, Guid participantId, DateTime start, DateTime end, Guid? excludeId, CancellationToken ct);
    Task<bool> IsSeatTakenAsync(Guid eventId, Guid? sessionId, string seatNumber, Guid? excludeId, CancellationToken ct);
    Task<Dictionary<Guid, (int Approved, int Pending, int Waitlist)>> CountByEventsAsync(List<Guid> eventIds, CancellationToken ct);
    Task<int> CountByStatusAsync(string status, CancellationToken ct);
    Task<int> NextCodeNumberAsync(CancellationToken ct);

    /// <summary>
    /// Kullanıcı bulgusu (2026-08-09): katılımcı listesinde "Etkinlik" sütunu her zaman 0
    /// gösteriyordu — ParticipantManagementService.MapDto'da EventCount pozisyonel alanına
    /// sabit 0 geçiliyordu, gerçek katılım geçmişinden hiç hesaplanmıyordu (ChildrenCount/
    /// GuardianCount/ActivityCount gibi diğer sayaçların aksine). Bu metod, CountActivitiesForAsync
    /// ile aynı toplu-sorgu deseniyle, verilen katılımcıların her biri için gerçek etkinlik
    /// başvurusu sayısını tek seferde hesaplar (N+1 sorgu yerine).
    /// </summary>
    Task<Dictionary<Guid, int>> CountForParticipantsAsync(IReadOnlyList<Guid> participantIds, CancellationToken ct);
}
