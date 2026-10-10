using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda;

public interface ISedaPeriodService
{
    Task<PagedResult<SedaPeriodDto>> GetPagedAsync(SedaPeriodListParams p, CancellationToken ct);
    Task<SedaPeriodDto> CreateAsync(CreateSedaPeriodRequest req, CancellationToken ct);
    Task<SedaPeriodDto> UpdateAsync(Guid id, UpdateSedaPeriodRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<SedaPeriodDto> ActivateAsync(Guid id, CancellationToken ct);
    // Kullanıcı isteği (2026-08-12): "hangi tarihler aralığında alınacak dediğinde zaten
    // başlangıç ve bitiş yılı dönemi verecek bize" — Kazananlar Excel import'unda admin önce
    // ayrı bir "Dönemler" ekranına gitmeden, sadece bir tarih aralığı vererek dönemi bulur/
    // yoksa oluşturur. Sadece kazananlar (SedaEducationRecord) tarafı için — SedaApplication
    // başvuru akışındaki kota/tarih-penceresi iş kuralları buna dahil DEĞİL (ayrı analiz gerekir,
    // bkz. docs/superpowers/specs/2026-08-12-seda-kazananlar-esnek-excel-telefon-sorgu-design.md §6b).
    Task<SedaPeriodDto> FindOrCreateByDateRangeAsync(DateTime startDate, DateTime endDate, CancellationToken ct);
}
