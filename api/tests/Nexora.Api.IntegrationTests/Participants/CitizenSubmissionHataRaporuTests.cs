using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Domain.Entities.CitizenSubmissions;
using Nexora.Infrastructure.Persistence;
using Xunit;

namespace Nexora.Api.IntegrationTests.Participants;

/// <summary>
/// docs/hata.md #4 (Talep / Şikâyet / Öneri) düzeltmelerinin KABUL testi.
///
/// Vatandaşın gerçekte kullandığı yolu kullanır: GERÇEK hosted API + GERÇEK PostgreSQL
/// üzerinden /api/v1/me/submissions uçlarına HTTP çağrısı. Raporun her maddesi burada
/// ayrı ayrı gözlemlenir:
///   #4.1 talep türü Türkçe dönüyor mu (submissionTypeLabel)
///   #4.2 seçilen öncelik kaydedilip geri dönüyor mu (priority/priorityLabel)
///   #4.3 kayıtlar türe göre doğru ayrışıyor mu (liste sayımı)
///   #4.4 oluşturulmuş bir talep düzenlenebiliyor mu (PUT)
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class CitizenSubmissionHataRaporuTests : IAsyncLifetime
{
    private readonly NexoraApiFactory _factory;
    private HttpClient _citizen = null!;
    private CitizenTestIdentity _identity = null!;

    public CitizenSubmissionHataRaporuTests(ApiTestHost host) => _factory = host.Factory;

    public async Task InitializeAsync()
    {
        _identity = CitizenTestIdentity.Adult(
            Random.Shared.Next(1, int.MaxValue),
            address: "Cumhuriyet Mah. Test Cad. No:12 Sultangazi/İstanbul");
        _citizen = await _factory.CreateCitizenClientAsync(_identity);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static object NewSubmissionBody(string type, string priority, string title) => new
    {
        title,
        description = $"{title} için ayrıntılı açıklama metni.",
        categoryId = "other",
        submissionType = type,
        priority,
        neighborhood = "Cumhuriyet Mahallesi",
        address = "Test Cad. No:12",
        latitude = (double?)null,
        longitude = (double?)null,
        notifyMuhtar = true,
        complaintReason = (string?)null,
        mediaUrls = Array.Empty<string>(),
        addressType = "other",
        scope = "neighborhood",
    };

    private async Task<JsonElement> CreateAsync(string type, string priority, string title)
    {
        var response = await _citizen.PostAsJsonAsync(
            "/api/v1/me/submissions", NewSubmissionBody(type, priority, title));

        response.StatusCode.Should().Be(HttpStatusCode.Created,
            because: await response.Content.ReadAsStringAsync());

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload.GetProperty("data");
    }

    // --- #4.1: "Talep türü İngilizce görünüyor" ---

    [Theory]
    [InlineData("request", "Talep")]
    [InlineData("complaint", "Şikayet")]
    [InlineData("suggestion", "İstek / Öneri")]
    public async Task Talep_turu_kullaniciya_turkce_doner(string type, string expectedLabel)
    {
        var created = await CreateAsync(type, "normal", $"Tür testi {Guid.NewGuid():N}");

        // Ham enum hâlâ mevcut (istemci mantığı için), ama GÖSTERİLECEK metin Türkçe.
        created.GetProperty("submissionType").GetString().Should().Be(type);
        created.GetProperty("submissionTypeLabel").GetString().Should().Be(expectedLabel);
    }

    // --- #4.2: "Öncelik değiştirilse bile Normal olarak görünüyor" ---

    [Theory]
    [InlineData("low", "Düşük")]
    [InlineData("normal", "Normal")]
    [InlineData("high", "Yüksek")]
    [InlineData("urgent", "Acil")]
    public async Task Secilen_oncelik_kaydedilir_ve_detayda_ayni_doner(string priority, string expectedLabel)
    {
        var created = await CreateAsync("request", priority, $"Öncelik testi {Guid.NewGuid():N}");
        var id = created.GetProperty("id").GetGuid();

        created.GetProperty("priority").GetString().Should().Be(priority);

        // Asıl şikayet "kayıt SONRASINDA Normal görünüyor" olduğu için detay ucu ayrıca okunur.
        var detail = await _citizen.GetFromJsonAsync<JsonElement>($"/api/v1/me/submissions/{id}");
        var data = detail.GetProperty("data");
        data.GetProperty("priority").GetString().Should().Be(priority);
        data.GetProperty("priorityLabel").GetString().Should().Be(expectedLabel);

        // Ve veritabanındaki gerçek kayıt da aynı değeri taşımalı.
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.Set<CitizenSubmission>().IgnoreQueryFilters().AsNoTracking()
            .FirstAsync(x => x.Id == id);
        stored.Priority.Should().Be(priority);
    }

    // --- #4.3: "Talep türlerine göre sayaçlar 0 gösteriyor" ---

    [Fact]
    public async Task Kayitlar_turune_gore_dogru_ayrisir()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        await CreateAsync("request", "normal", $"R1 {tag}");
        await CreateAsync("request", "normal", $"R2 {tag}");
        await CreateAsync("request", "normal", $"R3 {tag}");
        await CreateAsync("complaint", "normal", $"C1 {tag}");
        await CreateAsync("complaint", "normal", $"C2 {tag}");
        await CreateAsync("suggestion", "normal", $"S1 {tag}");

        var list = await _citizen.GetFromJsonAsync<JsonElement>("/api/v1/me/submissions?page=1&limit=50");
        var items = list.GetProperty("data").GetProperty("items").EnumerateArray()
            .Where(x => (x.GetProperty("title").GetString() ?? "").EndsWith(tag, StringComparison.Ordinal))
            .ToList();

        items.Should().HaveCount(6, because: "bu koşuda oluşturulan altı kayıt listede dönmeli");

        // Portal sayaçları tam olarak bu alandan türetiliyor; 3/2/1 beklentisi rapordaki örnek.
        items.Count(x => x.GetProperty("submissionType").GetString() == "request").Should().Be(3);
        items.Count(x => x.GetProperty("submissionType").GetString() == "complaint").Should().Be(2);
        items.Count(x => x.GetProperty("submissionType").GetString() == "suggestion").Should().Be(1);

        // Liste yanıtı da Türkçe etiketi taşımalı (rozet listede de gösteriliyor).
        items.Should().OnlyContain(x => !string.IsNullOrWhiteSpace(x.GetProperty("submissionTypeLabel").GetString()));
    }

    // --- #4.4: "Talep düzenlenemiyor" ---

    [Fact]
    public async Task Yeni_talep_duzenlenebilir_ve_degisiklik_kalici_olur()
    {
        var created = await CreateAsync("request", "normal", $"Düzenleme testi {Guid.NewGuid():N}");
        var id = created.GetProperty("id").GetGuid();
        created.GetProperty("canEdit").GetBoolean().Should().BeTrue();

        var response = await _citizen.PutAsJsonAsync($"/api/v1/me/submissions/{id}", new
        {
            title = "Güncellenmiş başlık",
            description = "Güncellenmiş açıklama metni.",
            submissionType = "complaint",
            priority = "urgent",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK,
            because: await response.Content.ReadAsStringAsync());

        var updated = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        updated.GetProperty("title").GetString().Should().Be("Güncellenmiş başlık");
        updated.GetProperty("submissionType").GetString().Should().Be("complaint");
        updated.GetProperty("submissionTypeLabel").GetString().Should().Be("Şikayet");
        updated.GetProperty("priority").GetString().Should().Be("urgent");

        // Yeniden okunduğunda da aynı olmalı (kalıcılık).
        var reread = await _citizen.GetFromJsonAsync<JsonElement>($"/api/v1/me/submissions/{id}");
        reread.GetProperty("data").GetProperty("title").GetString().Should().Be("Güncellenmiş başlık");
        reread.GetProperty("data").GetProperty("priority").GetString().Should().Be("urgent");
    }

    [Fact]
    public async Task Isleme_alinmis_talep_duzenlenemez_ve_neden_aciklanir()
    {
        var created = await CreateAsync("request", "normal", $"Kilit testi {Guid.NewGuid():N}");
        var id = created.GetProperty("id").GetGuid();

        // Belediye başvuruyu incelemeye alır (gerçek durum geçişi).
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var entity = await db.Set<CitizenSubmission>().IgnoreQueryFilters().FirstAsync(x => x.Id == id);
            entity.SetStatus("in_review");
            await db.SaveChangesAsync();
        }

        var detail = await _citizen.GetFromJsonAsync<JsonElement>($"/api/v1/me/submissions/{id}");
        detail.GetProperty("data").GetProperty("canEdit").GetBoolean().Should().BeFalse(
            because: "portal düzenleme butonunu bu alana göre gizler");

        var response = await _citizen.PutAsJsonAsync($"/api/v1/me/submissions/{id}", new
        {
            title = "Olmamalı",
            description = "Olmamalı",
            submissionType = "request",
            priority = "normal",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);

        // Ham gövde yerine çözümlenmiş alanlar okunur: System.Text.Json Türkçe karakterleri
        // \uXXXX olarak kaçırdığı için ham metinde arama yanıltıcıdır.
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("errorCode").GetString().Should().Be("SUBMISSION_NOT_EDITABLE");
        body.GetProperty("message").GetString().Should().Contain("düzenlenemiyor");
    }

    [Fact]
    public async Task Baskasinin_talebi_duzenlenemez()
    {
        var created = await CreateAsync("request", "normal", $"Yetki testi {Guid.NewGuid():N}");
        var id = created.GetProperty("id").GetGuid();

        var other = await _factory.CreateCitizenClientAsync(
            CitizenTestIdentity.Adult(Random.Shared.Next(1, int.MaxValue)));

        var response = await other.PutAsJsonAsync($"/api/v1/me/submissions/{id}", new
        {
            title = "Başkası değiştiremez",
            description = "Başkası değiştiremez",
            submissionType = "request",
            priority = "urgent",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Gecersiz_oncelik_ile_duzenleme_reddedilir()
    {
        var created = await CreateAsync("request", "normal", $"Doğrulama testi {Guid.NewGuid():N}");
        var id = created.GetProperty("id").GetGuid();

        var response = await _citizen.PutAsJsonAsync($"/api/v1/me/submissions/{id}", new
        {
            title = "Geçerli başlık",
            description = "Geçerli açıklama",
            submissionType = "request",
            priority = "ÇOK-ACİL",
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
