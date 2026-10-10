using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Application.Common.Repositories;

public interface ILibrarySessionRepository : IRepository<LibrarySession>
{
    Task<PagedResult<LibrarySession>> GetOccupantsPagedAsync(Guid libraryId, OccupantListParams p, CancellationToken ct);
    Task<PagedResult<LibrarySession>> GetExitedPagedAsync(Guid libraryId, DateTime date, ExitedListParams p, CancellationToken ct);
    Task<int> CountInsideAsync(Guid libraryId, CancellationToken ct);
    Task<int> CountOnBreakAsync(Guid libraryId, CancellationToken ct);
    Task<LibrarySession?> GetActiveByParticipantAsync(Guid participantId, CancellationToken ct);
    Task<LibrarySession?> GetActiveByTcknAsync(string tckn, CancellationToken ct);
    Task<int> CountTodayByParticipantLibraryAsync(Guid participantId, Guid libraryId, DateTime dayStart, CancellationToken ct);
    Task<int> CountTodayByTcknLibraryAsync(string tckn, Guid libraryId, DateTime dayStart, CancellationToken ct);
    Task<List<LibrarySession>> GetActiveSessionsAsync(CancellationToken ct);
    Task<List<LibrarySession>> GetActiveByLibraryAsync(Guid libraryId, CancellationToken ct);
    Task<List<LibrarySession>> GetByLibraryEntryRangeAsync(Guid libraryId, DateTime from, DateTime to, CancellationToken ct);
    Task<List<LibrarySession>> GetByParticipantEntryRangeAsync(Guid participantId, DateTime from, DateTime to, CancellationToken ct);
    Task<int> CountAllInsideAsync(CancellationToken ct);
    Task<int> CountAllOnBreakAsync(CancellationToken ct);
    Task<Dictionary<Guid, int>> CountInsideByLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountOnBreakByLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct);
    Task<List<LibrarySession>> GetExpiredExitIntentsAsync(DateTime expiredBefore, CancellationToken ct);
    Task<int> CountTodayExitNoShowsAsync(Guid participantId, Guid libraryId, DateTime dayStart, CancellationToken ct);
    Task<PagedResult<LibrarySession>> GetAllOccupantsPagedAsync(string? statusFilter, AllLibrariesPersonListParams p, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct);

    // Kullanıcı isteği (2026-08-12): katılım sonrası zorunlu anket otomasyonu — her kütüphane için
    // en güncel tamamlanmış (completed) oturumun çıkış zamanını döner.
    Task<Dictionary<Guid, DateTime>> GetMostRecentCompletedExitAtByLibraryAsync(CancellationToken ct);
}

public interface ILibraryQueueRepository : IRepository<LibraryQueueEntry>
{
    Task<PagedResult<LibraryQueueEntry>> GetPagedAsync(Guid libraryId, QueueListParams p, CancellationToken ct);
    Task<LibraryQueueEntry?> GetFrontWaitingAsync(Guid libraryId, CancellationToken ct);
    Task<LibraryQueueEntry?> GetActiveByParticipantAsync(Guid participantId, Guid libraryId, CancellationToken ct);
    Task<LibraryQueueEntry?> GetActiveByParticipantAnyAsync(Guid participantId, CancellationToken ct);
    Task<List<LibraryQueueEntry>> GetActiveOrderedAsync(Guid libraryId, CancellationToken ct);
    Task<bool> HasCalledAsync(Guid libraryId, CancellationToken ct);
    Task<int> CountWaitingAsync(Guid libraryId, CancellationToken ct);
    Task<int> CountAllWaitingAsync(CancellationToken ct);
    Task<Dictionary<Guid, int>> CountWaitingByLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct);
    Task<int> CountTodayNoShowsAsync(Guid participantId, Guid libraryId, DateTime dayStart, CancellationToken ct);
    Task<int> NextQueueSeqAsync(Guid libraryId, DateTime dayStart, CancellationToken ct);
    Task<List<LibraryQueueEntry>> GetExpiredCalledAsync(DateTime now, CancellationToken ct);
    Task<PagedResult<LibraryQueueEntry>> GetAllWaitingPagedAsync(AllLibrariesPersonListParams p, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct);
}

public interface ILibraryBreakRepository : IRepository<LibraryBreak>
{
    Task<PagedResult<LibraryBreak>> GetActivePagedAsync(Guid libraryId, BreakListParams p, CancellationToken ct);
    Task<int> CountActiveAsync(Guid libraryId, CancellationToken ct);
    Task<LibraryBreak?> GetActiveBySessionAsync(Guid sessionId, CancellationToken ct);
    Task<int> CountTodayBySessionTypeAsync(Guid sessionId, string type, DateTime dayStart, CancellationToken ct);
    Task<int> CountTodayBySessionAsync(Guid sessionId, DateTime dayStart, CancellationToken ct);
    Task<DateTime?> GetLastBreakStartTodayAsync(Guid sessionId, DateTime dayStart, CancellationToken ct);
    Task<DateTime?> GetLastBreakStartByTypeTodayAsync(Guid sessionId, string type, DateTime dayStart, CancellationToken ct);
    Task<List<LibraryBreak>> GetBySessionAsync(Guid sessionId, CancellationToken ct);
    Task<List<LibraryBreak>> GetExpiredGraceAsync(DateTime now, CancellationToken ct);
    Task<List<LibraryBreak>> GetActiveBreaksAsync(CancellationToken ct);
}

public interface ILibraryReservationRepository : IRepository<LibraryReservation>
{
    Task<LibraryReservation?> GetActiveHoldByParticipantAsync(Guid participantId, CancellationToken ct);
    Task<List<LibraryReservation>> GetActiveHoldsByLibraryAsync(Guid libraryId, CancellationToken ct);
    /// <summary>
    /// Bulgu (2026-09-23): "yer ayır" (walk-in/rezervasyon) ile oluşan "held" kayıtları hiçbir
    /// yerde doluluk sayımına girmiyordu — vatandaş bir koltuk ayırttığında liste/detay
    /// ekranındaki inside/free/occupancyRate hep aynı kalıyordu (yalnızca fiziksel
    /// check-in/LibrarySessions sayılıyordu). Kütüphane bazlı toplu "held" sayısı için.
    /// </summary>
    Task<Dictionary<Guid, int>> CountHeldByLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct);
    Task<LibraryReservation?> GetActiveHoldByTcknAsync(string tckn, CancellationToken ct);
    Task<LibraryReservation?> GetHeldByTcknLibraryAsync(string tckn, Guid libraryId, CancellationToken ct);
    Task<int> CountTodayByParticipantLibraryAsync(Guid participantId, Guid libraryId, DateTime dayStart, CancellationToken ct);
    Task<int> CountTodayNoShowsAsync(Guid participantId, Guid libraryId, DateTime dayStart, CancellationToken ct);
    Task<int> CountForfeitedByParticipantAsync(Guid participantId, Guid libraryId, DateTime? since, CancellationToken ct);
    Task<int> CountForfeitedByTcknAsync(string tckn, Guid libraryId, DateTime? since, CancellationToken ct);
    Task<List<LibraryReservation>> GetExpiredHoldsAsync(DateTime now, CancellationToken ct);
    Task<List<LibraryReservation>> GetActiveHoldsAsync(CancellationToken ct);
    Task<PagedResult<LibraryReservation>> GetByParticipantAsync(Guid participantId, string? status, int page, int limit, CancellationToken ct, string? search = null);
}
