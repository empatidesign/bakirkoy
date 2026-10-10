using Nexora.Application.Features.Travels;

namespace Nexora.Infrastructure.Services.Scheduled;

// Z03: gezi yedek terfisi sırasında aday kimlik kilidi geçici olarak MEŞGULSE, terfi FIFO'yu korumak
// için durur (arkadaki aday öne geçmez). Kilit kısa ömürlüdür ama serbest kalması kendiliğinden yeni
// terfi tetiklemez. Bu job, dış işlem tamamlandıktan kısa süre sonra terfiyi TEKRAR (idempotent) dener:
// güncel kapasite/sıra/kimlik/koltuk/limit yeniden doğrulanır; hâlâ meşgulse sınırlı sayıda yeniden planlanır.
public interface ITravelWaitlistPromotionRetryJob
{
    Task RetryAsync(Guid travelId, Guid candidateId, Guid? freedBusId, string? freedSeat, int attempt, CancellationToken ct = default);
}

public class TravelWaitlistPromotionRetryJob(ITravelApplicationService travelApplications) : ITravelWaitlistPromotionRetryJob
{
    public async Task RetryAsync(Guid travelId, Guid candidateId, Guid? freedBusId, string? freedSeat, int attempt, CancellationToken ct = default)
        => await travelApplications.RetryWaitlistPromotionAsync(travelId, candidateId, freedBusId, freedSeat, attempt, ct);
}
