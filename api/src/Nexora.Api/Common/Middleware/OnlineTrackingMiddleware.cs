using Nexora.Application.Common.Interfaces;

namespace Nexora.Api.Common.Middleware;

/// <summary>
/// Kimliği doğrulanmış her istekte kullanıcıyı "online" olarak işaretler.
/// Kullanıcı isteği (2026-09-07): giriş yapmış kullanıcılar 5 dakikalık pencerede
/// online sayılsın, sistem performansı etkilenmesin.
/// <para>
/// Maliyet: <see cref="IOnlineUserTracker"/> kullanıcı başına dakikada en fazla bir
/// Redis komutu çalıştırır (gerisi süreç içi bellekten döner). Redis erişilemezse
/// istek <b>kesilmez</b> — online takibi kritik olmayan bir özelliktir.
/// </para>
/// </summary>
public class OnlineTrackingMiddleware(RequestDelegate next, ILogger<OnlineTrackingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context, ICurrentUser currentUser, IOnlineUserTracker tracker)
    {
        if (currentUser.Id is Guid userId)
        {
            try
            {
                await tracker.TouchAsync(userId, currentUser.UserType ?? "admin", currentUser.Platform, context.RequestAborted);
            }
            catch (Exception ex)
            {
                // Takip hatası isteği düşürmemeli.
                logger.LogDebug(ex, "[ONLINE] Kullanıcı aktifliği işaretlenemedi.");
            }
        }

        await next(context);
    }
}
