using Hangfire;
using Microsoft.Extensions.Logging;
using Nexora.Application.Features.Notifications;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface IBirthdayGreetingJob
{
    Task RunAsync(CancellationToken ct);
}

/// <summary>
/// Kullanıcı isteği (2026-09-07): doğum günü olan vatandaşlara her gün saat 10:00'da otomatik
/// kutlama mesajı gönderilmesi.
///
/// Job her saat başı tetiklenir; gönderimi yapıp yapmayacağına <see cref="IBirthdayGreetingService"/>
/// karar verir (ayarlardaki saat/dakika + "bugün zaten gönderildi mi" kontrolü). Böylece admin
/// gönderim saatini panelden değiştirdiğinde Hangfire cron'unu yeniden kaydetmek gerekmez.
///
/// [DisableConcurrentExecution]: binlerce kişilik gönderim kademeli yapıldığı için uzun sürebilir;
/// bir sonraki saatlik tetikleme paralel başlayıp aynı kişilere ikinci kez mesaj göndermemeli.
/// </summary>
[DisableConcurrentExecution(timeoutInSeconds: 3600)]
public class BirthdayGreetingJob(
    IBirthdayGreetingService service,
    ILogger<BirthdayGreetingJob> logger) : IBirthdayGreetingJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var result = await service.RunAsync(dryRun: false, force: false, ct);
        if (result.Candidates > 0 || result.Message is null)
            logger.LogInformation(
                "Doğum günü job: {Candidates} kişi, {Sms} SMS, {Push} push, {InApp} bildirim",
                result.Candidates, result.SmsSent, result.PushSent, result.InAppCreated);
    }
}
