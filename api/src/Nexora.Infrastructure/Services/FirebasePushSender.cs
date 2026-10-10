using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;

namespace Nexora.Infrastructure.Services;

public class FirebasePushSender(
    IUnitOfWork uow,
    IConfiguration config,
    ILogger<FirebasePushSender> logger) : IPushSender
{
    private static readonly SemaphoreSlim InitLock = new(1, 1);
    private static bool _initialized;

    public async Task SendToParticipantAsync(
        Guid participantId,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data,
        CancellationToken ct = default)
    {
        if (!config.GetValue("Push:Enabled", true))
            return;

        var messaging = await ResolveMessagingAsync(ct);
        if (messaging is null)
            return;

        var permission = await uow.ParticipantDevicePermissions.GetByParticipantAsync(participantId, ct);
        var token = permission?.PushToken;
        if (string.IsNullOrWhiteSpace(token))
            return;

#pragma warning disable CS0618
        var message = new Message
        {
            Token = token,
            Notification = new Notification { Title = title, Body = body },
            Data = data?.ToDictionary(x => x.Key, x => x.Value),
            Android = new AndroidConfig { Priority = Priority.High },
            Apns = new ApnsConfig
            {
                Aps = new Aps { Sound = "default", ContentAvailable = true },
            },
        };
#pragma warning restore CS0618

        try
        {
            await messaging.SendAsync(message, ct);
        }
        catch (FirebaseMessagingException ex) when (
            ex.MessagingErrorCode is MessagingErrorCode.Unregistered or MessagingErrorCode.InvalidArgument)
        {
            // Cihaz uygulamayı silmiş ya da token geçersizleşmiş. Saklamaya
            // devam etmek her bildirimde boşuna istek üretir; temizlenir ve
            // uygulama tekrar açıldığında yeni token yazılır.
            permission!.SetNotification("denied", null, permission.DevicePlatform);
            permission.ClearPushToken();
            uow.ParticipantDevicePermissions.Update(permission);
            await uow.SaveChangesAsync(ct);
            logger.LogInformation("Push token geçersiz, temizlendi. ParticipantId: {ParticipantId}", participantId);
        }
        catch (Exception ex)
        {
            // Bildirim gönderimi çağıran iş akışını (başvuru, iptal vb.)
            // düşürmemelidir; hata loglanıp yutulur.
            logger.LogError(ex, "Push gönderilemedi. ParticipantId: {ParticipantId}", participantId);
        }
    }

    private async Task<FirebaseMessaging?> ResolveMessagingAsync(CancellationToken ct)
    {
        if (_initialized)
            return FirebaseMessaging.DefaultInstance;

        await InitLock.WaitAsync(ct);
        try
        {
            if (_initialized)
                return FirebaseMessaging.DefaultInstance;

            if (FirebaseApp.DefaultInstance is not null)
            {
                _initialized = true;
                return FirebaseMessaging.DefaultInstance;
            }

            var credentialPath = config["Push:ServiceAccountPath"];
            if (string.IsNullOrWhiteSpace(credentialPath) || !File.Exists(credentialPath))
            {
                logger.LogWarning(
                    "Push devre dışı: service account dosyası bulunamadı ({Path}).", credentialPath);
                return null;
            }

#pragma warning disable CS0618
            FirebaseApp.Create(new AppOptions
            {
                Credential = GoogleCredential.FromFile(credentialPath),
            });
#pragma warning restore CS0618
            _initialized = true;
            return FirebaseMessaging.DefaultInstance;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Firebase başlatılamadı; push gönderimi devre dışı.");
            return null;
        }
        finally
        {
            InitLock.Release();
        }
    }
}
