namespace Nexora.Application.Common.Interfaces;

public interface INotificationDispatcher
{
    // Denetim bulgusu (2026-09-20, kullanıcı raporu: "şuan localde çalıştığı için gerçek
    // sunucu olmadan sms gitmez" — canlı test doğruladı: SMS gateway kimlik bilgileri
    // yapılandırılmamışken ISmsService.SendOneAsync sessizce false dönüyordu ama BURADAKİ
    // Task (bool değil) imza, o sonucu görmezden geliyordu — tüm çağıranlar "gönderim
    // yapıldı" sanıp smsSent sayacını artırıyordu, kullanıcıya YANLIŞ başarı raporu
    // gösteriliyordu). Artık gerçek gönderim sonucu (true/false) dışarı taşınıyor.
    Task<bool> SendSmsAsync(string phone, string message, CancellationToken ct = default);
    Task SendEmailAsync(string email, string subject, string htmlBody, CancellationToken ct = default);
    Task SendPushAsync(string recipient, string title, string message, CancellationToken ct = default);
}
