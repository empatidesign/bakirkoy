using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Extensions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Specialized;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class SmsGovernanceService(
    IUnitOfWork uow,
    IOtpService otpService,
    ICurrentUser currentUser) : ISmsGovernanceService
{
    public async Task EnsureCanSendAsync(string module, string? description, int recipientCount, string? otpCode, CancellationToken ct)
    {
        var adminUserId = currentUser.Id;

        // Sistem/arka plan bağlamında (currentUser boşsa, ör. zamanlanmış job) bu kontrol
        // uygulanmaz — bu servis yalnızca admin-tetikli manuel gönderimler için tasarlandı.
        if (adminUserId is null)
            return;

        var admin = await uow.AdminUsers.GetByIdAsync(adminUserId.Value, ct);

        // Kullanıcı isteği (2026-10-04): "toplu sms gönderme sistemi kişilere veya yetki
        // gruplarında sms gönderme yetkisinin kimde olacağı tanımlanmalı" — modül bazlı
        // "{module}.edit" izni yeterli SAYILMAZ; TÜM manuel SMS gönderim akışlarının ortak
        // kapısı burasıdır (her SendManualMessageAsync EnsureCanSendAsync'i çağırır). Bu kontrol
        // OTP'den ÖNCE yapılır: yetkisi olmayan bir kullanıcı gereksiz yere OTP akışına girmesin.
        if (!currentUser.IsSuperAdmin && !await uow.HasPermissionWithOverrideAsync(adminUserId.Value, "sms-send.send", ct))
        {
            await LogAsync(adminUserId.Value, admin, module, description, recipientCount,
                wasBlocked: true, blockReason: "SMS gönderme yetkisi yok (sms-send.send).", ct);
            throw new ForbiddenException("SMS gönderme yetkiniz bulunmuyor. Yetki ataması için sistem yöneticinize başvurun.", "SMS_SEND_PERMISSION_DENIED");
        }

        if (string.IsNullOrWhiteSpace(otpCode))
        {
            await LogAsync(adminUserId.Value, admin, module, description, recipientCount,
                wasBlocked: true, blockReason: "SMS doğrulama kodu girilmedi.", ct);
            throw new ConflictException(
                "SMS göndermek için telefonunuza gönderilecek doğrulama kodunu isteyin ve girin.",
                "SMS_VERIFICATION_REQUIRED");
        }

        // Not (2026-09-20): bazı gönderim ekranları (ör. TravelSendMessageModal çoklu sefer
        // seçiminde) TEK kullanıcı eylemi için ARKA ARKAYA birden fazla SendManualMessageAsync
        // çağrısı yapıyor — her biri ayrı bir EnsureCanSendAsync tetikler. OTP'yi ilk çağrıda
        // tüketirsek (TryConsumeAsync) ikinci çağrı "OTP_EXPIRED" ile başarısız olurdu. Bu yüzden
        // OTP burada TÜKETİLMEDEN doğrulanır. Güvenlik OTP'nin kısa TTL'i (ValiditySeconds,
        // varsayılan 60sn) ve deneme/kilitlenme sınırlarıyla korunuyor.
        try
        {
            await otpService.VerifyWithoutConsumingAsync(adminUserId.Value, OtpPurpose.SmsSendConfirmation, otpCode, ct);
        }
        catch (ConflictException ex)
        {
            await LogAsync(adminUserId.Value, admin, module, description, recipientCount,
                wasBlocked: true, blockReason: $"OTP doğrulaması başarısız: {ex.ErrorCode}", ct);
            throw;
        }

        await LogAsync(adminUserId.Value, admin, module, description, recipientCount,
            wasBlocked: false, blockReason: null, ct);
    }

    private async Task LogAsync(
        Guid adminUserId, Domain.Entities.Auth.AdminUser? admin, string module, string? description,
        int recipientCount, bool wasBlocked, string? blockReason, CancellationToken ct)
    {
        var log = SmsSendLog.Create(
            adminUserId,
            currentUser.Name ?? admin?.FullName ?? "Bilinmeyen",
            admin?.Department,
            module,
            description,
            recipientCount,
            usedPinOverride: false,
            usedOtp: !wasBlocked,
            wasBlocked: wasBlocked,
            blockReason: blockReason,
            currentUser.IpAddress);

        await uow.SmsSendLogs.AddAsync(log, ct);
        await uow.SaveChangesAsync(ct);
    }
}
