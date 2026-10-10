using Microsoft.Extensions.Configuration;
using Moq;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Application.Features.Notifications;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Denetim bulgusu 2026-09-01 (e-posta/SMTP turu, programci_eposta_2026-09-01.md):
// LibraryNotificationService.TrySendMemberWarnEmailAsync önceden libraryName ve
// (personelin serbest metin girdiği, hiçbir HTML-artefakt validasyonu olmayan)
// message parametrelerini kaçışsız $"<p>...</p>" HTML gövdesine gömüyordu. Bir
// personel WarnAsync üzerinden mesaj metnine "<img src=x onerror=alert(1)>" gibi bir
// değer yazarsa, bu markup vatandaşın e-posta istemcisinde (HTML render eden herhangi
// bir istemcide) YORUMLANIYORDU (stored HTML injection). Bu test, dispatcher'a giden
// HTML gövdesinin artık WebUtility.HtmlEncode ile kaçışlandığını ve ham "<img" gibi
// bir markup'ın asla çıkışa sızmadığını kilitler. Testi geçici olarak eski (kaçışsız)
// koda geri alıp ÇALIŞTIRDIM: test gerçekten kırılıyor (ham "<img" gövdede bulunuyor) —
// bkz. rapor. Ardından düzeltme geri getirildi.
public class LibraryNotificationServiceEmailHtmlEscapeTests
{
    private readonly Mock<INotificationDispatcher> _dispatcher = new();
    private readonly Mock<Nexora.Application.Features.Notifications.INotificationService> _notifications = new();
    private readonly Mock<INotificationRealtimeNotifier> _realtime = new();
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ILibrarySettingsService> _settings = new();
    private readonly Mock<ISmsService> _sms = new();
    private readonly Mock<ISmsGovernanceService> _smsGovernance = new();
    private readonly Mock<IConfiguration> _config = new();
    private readonly Mock<IParticipantRepository> _participants = new();

    private readonly LibraryNotificationService _service;

    public LibraryNotificationServiceEmailHtmlEscapeTests()
    {
        _uow.SetupGet(x => x.Participants).Returns(_participants.Object);
        _config.SetupGet(c => c[It.IsAny<string>()]).Returns((string?)null);

        _service = new LibraryNotificationService(
            _dispatcher.Object,
            _notifications.Object,
            _realtime.Object,
            _uow.Object,
            _settings.Object,
            _sms.Object,
            _config.Object,
            _smsGovernance.Object);
    }

    [Fact]
    public async Task NotifyMemberWarnAsync_EscapesHtmlInMessageAndLibraryName_BeforeSendingEmail()
    {
        var participantId = Guid.NewGuid();
        var libraryId = Guid.NewGuid();

        var participant = Participant.Create(
            tckn: "10000000214",
            fullName: "Ayşe <b>Yılmaz</b>",
            birthDate: new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            gender: Gender.Female,
            isMinor: false,
            passwordHash: "hash",
            email: "citizen@example.com",
            phone: "05551234567",
            guardianPhone: null,
            guardianEmail: null,
            address: null);

        _participants.Setup(x => x.GetByIdAsync(participantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);

        _settings.Setup(x => x.GetAsync(libraryId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LibrarySettingsDto { MemberWarnEmailEnabled = true });

        const string maliciousMessage = "<img src=x onerror=alert(1)>Molanız bitmek üzere";
        const string maliciousLibraryName = "Kıraathane <script>evil()</script>";

        string? capturedHtml = null;
        _dispatcher
            .Setup(x => x.SendEmailAsync(
                "citizen@example.com",
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, string, string, CancellationToken>((_, _, html, _) => capturedHtml = html)
            .Returns(Task.CompletedTask);

        // "manual" event key: settings mock'unda NotificationTemplates boş olduğu için
        // TryRenderTemplateAsync null döner, dispatcher'a doğrudan ham "message" gider —
        // tam da savunmasız kod yolu.
        await _service.NotifyMemberWarnAsync(
            libraryId, maliciousLibraryName, "manual", participantId, phone: null,
            memberName: participant.FullName, message: maliciousMessage, ct: CancellationToken.None);

        Assert.NotNull(capturedHtml);
        Assert.DoesNotContain("<img", capturedHtml);
        Assert.DoesNotContain("<script>", capturedHtml);
        Assert.DoesNotContain("<b>", capturedHtml);
        Assert.Contains("&lt;img", capturedHtml);
        Assert.Contains("&lt;script&gt;", capturedHtml);
        Assert.Contains("&lt;b&gt;", capturedHtml);
        // Görünen metin kaybolmamalı, yalnızca markup olarak yorumlanamamalı
        // (WebUtility.HtmlEncode Türkçe karakterleri de sayısal entity'e çevirir,
        // "üzere" -> "&#252;zere" olur — bu beklenen ve zararsızdır, tarayıcı/e-posta
        // istemcisi doğru render eder; ASCII kısmı ham metinde aranır).
        Assert.Contains("bitmek", capturedHtml);
        Assert.Contains("alert(1)", capturedHtml);
    }
}
