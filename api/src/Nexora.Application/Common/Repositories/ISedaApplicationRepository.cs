using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Application.Common.Repositories;

public interface ISedaApplicationRepository : IRepository<SedaApplication>
{
    Task<PagedResult<SedaApplication>> GetPagedAsync(SedaApplicationListParams p, IReadOnlyCollection<string>? scopedSchoolNames, CancellationToken ct);
    Task<(int Total, int Approved, int Pending, int Rejected)> GetSummaryAsync(string? schoolName, IReadOnlyCollection<string>? scopedSchoolNames, CancellationToken ct);
    Task<int> NextCodeNumberAsync(CancellationToken ct);
    Task<Dictionary<string, int>> CountBySchoolNamesAsync(List<string> schoolNames, CancellationToken ct);
    Task<int> CountInWindowAsync(DateTime start, DateTime end, CancellationToken ct);
    Task<int> CountByPeriodAsync(Guid periodId, CancellationToken ct);
    /// <summary>
    /// Mevcut başvurularda geçen FARKLI okul adı sayısı. Okul tanım listesinin
    /// doğrulama yapmaya yetecek kadar tam olup olmadığını anlamak için kullanılır
    /// (bkz. MeSedaService.EnsureOptionsAreValidAsync — eksik liste, gerçek
    /// vatandaş başvurusunu bloke etmemeli).
    /// </summary>
    Task<int> CountDistinctSchoolNamesAsync(CancellationToken ct);
    Task<PagedResult<SedaApplication>> GetByUserAsync(Guid citizenUserId, int page, int limit, CancellationToken ct);
    Task<List<SedaApplication>> GetAllFilteredAsync(SedaApplicationListParams p, IReadOnlyCollection<string>? scopedSchoolNames, CancellationToken ct);

    Task<List<Guid>> GetCitizenUserIdsByApplicationsAsync(IReadOnlyCollection<Guid> applicationIds, CancellationToken ct);
    // Düzeltme (2026-09-27, kullanıcı bulgusu — SEDA gerçek siteyle karşılaştırma testi):
    // önceden bu iki metot dönem-bağımsız (global) "hiç aktif başvurusu var mı" kontrolü
    // yapıyordu — bir vatandaş önceki dönemde approved olduktan sonra YENİ bir döneme
    // (2026-2027 bitip 2027-2028 açıldığında) ASLA tekrar başvuramıyordu. Kullanıcı isteği:
    // "her dönem/sene başvuruları ayrı ayrı alınabilecek". Artık periodId verildiğinde
    // yalnızca O DÖNEM içindeki aktif başvuru kontrol edilir; periodId null ise (aktif
    // dönem tanımlı değilse) eski global davranış korunur.
    Task<bool> HasActiveApplicationForCitizenAsync(Guid citizenUserId, Guid? periodId, CancellationToken ct);
    Task<bool> HasActiveApplicationForTcknAsync(string tckn, Guid? periodId, CancellationToken ct);

    // Kullanıcı isteği (2026-10-05): "şuana kadar yıllara göre kaç kişi başvurmuş" raporu —
    // başvuru tarihinin (CreatedAt) yılına göre toplam/onaylı/bekleyen/reddedilen sayıları,
    // ayrıca en çok başvuru alan okullar / sınıf / eğitim türü kırılımları. Hem eski (içe
    // aktarılan) hem bugünden itibaren yapılan yeni başvurular aynı sorguya düşer.
    Task<SedaYearlyReportDto> GetYearlyReportAsync(SedaYearlyReportParams p, IReadOnlyCollection<string>? scopedSchoolNames, CancellationToken ct);
}
