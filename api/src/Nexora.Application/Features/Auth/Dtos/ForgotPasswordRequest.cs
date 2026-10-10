namespace Nexora.Application.Features.Auth.Dtos;

/// <summary>
/// Şifre sıfırlama başlatma isteği. Kullanıcı isteği (2026-09-07): akış artık yalnız
/// e-posta ile değil, telefon numarasıyla da başlatılabiliyor.
/// <para>
/// <see cref="Identifier"/> yeni alandır (e-posta veya telefon). Eski istemciler
/// hâlâ yalnız <see cref="Email"/> gönderebildiği için o alan korunuyor;
/// <see cref="Value"/> ikisinden dolu olanı verir.
/// </para>
/// </summary>
public record ForgotPasswordRequest(string? Email, string? Identifier = null)
{
    public string Value => string.IsNullOrWhiteSpace(Identifier) ? (Email ?? "") : Identifier;
}

public record ForgotPasswordResponse(bool Sent, string Channel, string? MaskedTarget);
