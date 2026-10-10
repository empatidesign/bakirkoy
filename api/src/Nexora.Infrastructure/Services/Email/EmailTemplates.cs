using System.Net;

namespace Nexora.Infrastructure.Services.Email;

public readonly record struct EmailContent(string Subject, string HtmlBody);

public static class EmailTemplates
{
    private const string Brand = "Bakırköy Belediyesi";
    private const string Accent = "#005da3";
    private const string AccentSoft = "#eef5fa";

    public static EmailContent VerificationCode(string? fullName, string code, int validitySeconds)
    {
        var validity = validitySeconds >= 120 ? $"{validitySeconds / 60} dakika" : $"{validitySeconds} saniye";
        var body = $"""
            <p style="margin:0 0 14px">{Greeting(fullName)}</p>
            <p style="margin:0 0 18px">Hesabınıza ait bir işlemi doğrulamak için aşağıdaki tek kullanımlık kodu ekrandaki alana giriniz.</p>
            {CodeBox(code)}
            <p style="margin:18px 0 6px;color:#555">Kod {validity} boyunca geçerlidir ve yalnızca bir kez kullanılabilir.</p>
            <p style="margin:0;color:#555">Bu işlemi siz başlatmadıysanız kodu kimseyle paylaşmayın ve dikkate almayın.</p>
            """;
        return new(Subject("Doğrulama kodu"), Layout("Doğrulama Kodu", body, "Tek kullanımlık doğrulama kodunuz"));
    }

    public static EmailContent Notification(string? fullName, string message)
    {
        var body = $"""
            <p style="margin:0 0 14px">{Greeting(fullName)}</p>
            <p style="margin:0;white-space:pre-line">{Esc(message)}</p>
            """;
        var preview = message.Length > 90 ? message[..90] : message;
        return new(Subject("Bilgilendirme"), Layout("Bilgilendirme", body, preview));
    }

    public static EmailContent PasswordChanged(string? fullName)
    {
        var body = $"""
            <p style="margin:0 0 14px">{Greeting(fullName)}</p>
            <p style="margin:0 0 14px">Hesabınızın şifresi az önce güncellendi. Bu işlemi siz yaptıysanız yapmanız gereken başka bir şey yok.</p>
            <p style="margin:0;color:#555">Bu değişikliği siz yapmadıysanız, lütfen en kısa sürede yöneticinizle iletişime geçin.</p>
            """;
        return new(Subject("Şifreniz değiştirildi"), Layout("Şifre Değişikliği", body, "Hesap şifreniz güncellendi"));
    }

    public static EmailContent AdminCredentials(string? fullName, string email, string tempPassword, string loginUrl)
    {
        var body = $"""
            <p style="margin:0 0 14px">{Greeting(fullName)}</p>
            <p style="margin:0 0 18px">Bakırköy Belediyesi yönetim paneline erişiminiz tanımlandı. İlk girişinizde sizden güvenliğiniz için yeni bir şifre belirlemeniz istenecektir.</p>
            {CredBox(("Kullanıcı adı", email), ("Geçici şifre", tempPassword))}
            {Button("Yönetim Paneline Git", loginUrl)}
            <p style="margin:18px 0 0;color:#555">Geçici şifrenizi kimseyle paylaşmayın. İlk giriş sonrası bu şifre geçersiz olur.</p>
            """;
        return new(Subject("Yönetim paneli erişim bilgileriniz"), Layout("Panel Erişimi", body, "Yönetim paneli hesabınız hazır"));
    }

    public static EmailContent CompanyCredentials(string companyName, string email, string tempPassword, string loginUrl)
    {
        var body = $"""
            <p style="margin:0 0 14px">Sayın <strong>{Esc(companyName)}</strong> yetkilisi,</p>
            <p style="margin:0 0 18px">Firmanız Bakırköy Belediyesi firma portalına kaydedildi. Aşağıdaki bilgilerle giriş yapıp kampanya ve hizmetlerinizi yönetmeye başlayabilirsiniz. İlk girişte yeni bir şifre belirlemeniz gerekir.</p>
            {CredBox(("Kullanıcı adı", email), ("Geçici şifre", tempPassword))}
            {Button("Firma Portalına Giriş", loginUrl)}
            <p style="margin:18px 0 0;color:#555">Bu bilgiler yalnızca firmanız içindir; üçüncü kişilerle paylaşmayınız.</p>
            """;
        return new(Subject("Firma portalı giriş bilgileriniz"), Layout("Firma Portalı", body, "Firma hesabınız oluşturuldu"));
    }

    public static EmailContent ParticipantCredentials(string? fullName, string loginId, string tempPassword, string loginUrl)
    {
        var body = $"""
            <p style="margin:0 0 14px">{Greeting(fullName)}</p>
            <p style="margin:0 0 18px">Bakırköy Belediyesi hizmet portalındaki hesabınız hazır. Etkinlik, kurs ve başvurularınızı buradan takip edebilirsiniz. Güvenliğiniz için ilk girişte şifrenizi yenilemeniz istenecektir.</p>
            {CredBox(("Giriş bilgisi", loginId), ("Geçici şifre", tempPassword))}
            {Button("Hesabıma Giriş Yap", loginUrl)}
            <p style="margin:18px 0 0;color:#555">Bu e-posta size özeldir; giriş bilgilerinizi başkalarıyla paylaşmayın.</p>
            """;
        return new(Subject("Hesap giriş bilgileriniz"), Layout("Hesabınız Hazır", body, "Hizmet portalı hesabınız oluşturuldu"));
    }

    private static string Layout(string heading, string bodyHtml, string preheader)
    {
        return $"""
            <!doctype html>
            <html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{Esc(heading)}</title></head>
            <body style="margin:0;padding:0;background:#f2f4f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b2b2b">
              <span style="display:none;max-height:0;overflow:hidden;opacity:0">{Esc(preheader)}</span>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f6;padding:24px 12px">
                <tr><td align="center">
                  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:6px;overflow:hidden;border:1px solid #e4e8ec">
                    <tr><td style="background:{Accent};padding:22px 28px">
                      <div style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.3px">{Brand}</div>
                      <div style="color:#c7d6e6;font-size:12px;margin-top:3px">{Esc(heading)}</div>
                    </td></tr>
                    <tr><td style="padding:28px 28px 22px;font-size:15px;line-height:1.6">{bodyHtml}</td></tr>
                    <tr><td style="padding:18px 28px;background:#f7f9fb;border-top:1px solid #e4e8ec;font-size:12px;color:#8a939c;line-height:1.6">
                      Bu e-posta {Brand} sistemleri tarafından otomatik olarak gönderilmiştir; lütfen yanıtlamayınız.<br>
                      İletişim: <a href="https://www.bakirkoy.bel.tr" style="color:{Accent};text-decoration:none">www.bakirkoy.bel.tr</a>
                    </td></tr>
                  </table>
                  <div style="color:#aab2ba;font-size:11px;margin-top:14px">© {Brand}</div>
                </td></tr>
              </table>
            </body></html>
            """;
    }

    private static string CodeBox(string code) =>
        $"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0"><tr><td style="background:{AccentSoft};border:1px solid #d5e1ee;border-radius:6px;padding:16px 28px;font-size:28px;font-weight:700;letter-spacing:8px;color:{Accent}">{Esc(code)}</td></tr></table>""";

    private static string CredBox(params (string Label, string Value)[] rows)
    {
        var trs = string.Concat(rows.Select(r =>
            $"""<tr><td style="padding:8px 0;color:#6b747c;width:130px">{Esc(r.Label)}</td><td style="padding:8px 0;font-weight:600;color:#1f2b36">{Esc(r.Value)}</td></tr>"""));
        return $"""<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:{AccentSoft};border:1px solid #d5e1ee;border-radius:6px;padding:6px 18px;margin:4px 0 8px;font-size:14px">{trs}</table>""";
    }

    private static string Button(string text, string url) =>
        string.IsNullOrWhiteSpace(url) ? "" :
        $"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px"><tr><td style="border-radius:6px;background:{Accent}"><a href="{Esc(url)}" style="display:inline-block;padding:12px 26px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">{Esc(text)}</a></td></tr></table>""";

    private static string Greeting(string? name) =>
        string.IsNullOrWhiteSpace(name) ? "Merhaba," : $"Sayın {Esc(name.Trim())},";

    private static string Subject(string s) => $"{s} · {Brand}";

    private static string Esc(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);
}
