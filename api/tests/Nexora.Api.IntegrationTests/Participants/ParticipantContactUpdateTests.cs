using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Persistence;
using Xunit;

namespace Nexora.Api.IntegrationTests.Participants;

/// <summary>
/// Kullanıcı bulgusu (2026-09-23): "üye düzenle dediğinde cep telefonu tekrar eksik diye
/// istiyor". Kök neden: KVKK maskeleme (ParticipantSettings:MaskIdentity, varsayılan true)
/// açıkken liste/detay uçları telefonu maskelenmiş döndürür ("532****33"); admin panel bu
/// değeri düzenleme formuna dolduruyor, PhoneInput yıldızları silince bozuk bir numara
/// kalıyor ve admin telefona HİÇ dokunmasa bile bu bozuk değer PUT ile GERÇEK numaranın
/// üzerine yazılıyordu (kalıcı veri kaybı).
///
/// Bu testler GERÇEK hosted API + GERÇEK PostgreSQL üzerinden PUT /api/v1/participants/{id}
/// uç noktasını çağırır ve veritabanındaki gerçek kaydın korunduğunu doğrular.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class ParticipantContactUpdateTests : IAsyncLifetime
{
    private readonly NexoraApiFactory _factory;
    private HttpClient _admin = null!;

    public ParticipantContactUpdateTests(ApiTestHost host) => _factory = host.Factory;

    public async Task InitializeAsync()
        => _admin = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), $"pc-{Guid.NewGuid():N}@nexora.local"));

    public Task DisposeAsync() => Task.CompletedTask;

    private static string NewTckn(Random rnd)
    {
        // TcKimlikValidator'ı geçen sentetik ama kurallara uygun bir numara üretir.
        while (true)
        {
            var d = new int[11];
            d[0] = rnd.Next(1, 10);
            for (var i = 1; i < 9; i++) d[i] = rnd.Next(0, 10);
            var oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
            var evenSum = d[1] + d[3] + d[5] + d[7];
            d[9] = ((oddSum * 7) - evenSum) % 10;
            if (d[9] < 0) d[9] += 10;
            d[10] = (d.Take(10).Sum()) % 10;
            var s = string.Concat(d);
            if (Nexora.Application.Common.TcKimlikValidator.IsValid(s)) return s;
        }
    }

    private async Task<Guid> SeedParticipantAsync(string phone, string email)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var p = Participant.Create(
            NewTckn(new Random()), "Telefon Testi", new DateTime(1990, 1, 1), Gender.Male,
            isMinor: false, passwordHash: "x", email: email, phone: phone,
            guardianPhone: null, guardianEmail: null, address: null);
        await db.Set<Participant>().AddAsync(p);
        await db.SaveChangesAsync();
        return p.Id;
    }

    private async Task<(string? Phone, string? Email)> ReadFromDbAsync(Guid id)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var p = await db.Set<Participant>().IgnoreQueryFilters().AsNoTracking()
            .FirstAsync(x => x.Id == id);
        return (p.Phone, p.Email);
    }

    [Fact]
    public async Task Update_with_empty_phone_preserves_the_real_stored_number()
    {
        var id = await SeedParticipantAsync("05321112233", "gercek@example.com");

        // Admin panel artık maskelenmiş değeri forma koymaz; telefona dokunulmadığında
        // alan boş gider. Gerçek numara korunmalı.
        var response = await _admin.PutAsJsonAsync($"/api/v1/participants/{id}",
            new { phone = (string?)null, email = (string?)null });

        response.IsSuccessStatusCode.Should().BeTrue(await response.Content.ReadAsStringAsync());

        var (phone, email) = await ReadFromDbAsync(id);
        phone.Should().Be("05321112233", "telefona dokunulmadığında gerçek numara korunmalı");
        email.Should().Be("gercek@example.com");
    }

    [Fact]
    public async Task Update_with_masked_looking_phone_is_rejected_and_never_corrupts_the_stored_number()
    {
        var id = await SeedParticipantAsync("05321112233", "gercek@example.com");

        // Gerçek API davranışı (2026-09-23 entegrasyon koşusunda gözlendi):
        // UpdateParticipantRequestValidator maskelenmiş değeri 400 VALIDATION_ERROR ile
        // reddediyor — istek servis katmanına hiç ulaşmıyor. Bu, veri bozulmasına karşı
        // ilk savunma hattı; servisteki LooksMasked kontrolü ikinci (derinlemesine
        // savunma) katman olarak kalıyor. Her iki durumda da DB'deki gerçek numara
        // DEĞİŞMEMELİ — asıl güvence budur.
        var response = await _admin.PutAsJsonAsync($"/api/v1/participants/{id}",
            new { phone = "532****33", email = "ge***@example.com" });

        response.StatusCode.Should().Be(System.Net.HttpStatusCode.BadRequest);

        var (phone, email) = await ReadFromDbAsync(id);
        phone.Should().Be("05321112233", "reddedilen istek gerçek numarayı bozmamalı");
        email.Should().Be("gercek@example.com");
    }

    [Fact]
    public async Task Update_with_a_real_new_phone_actually_changes_it()
    {
        var id = await SeedParticipantAsync("05321112233", "gercek@example.com");

        var response = await _admin.PutAsJsonAsync($"/api/v1/participants/{id}",
            new { phone = "05339998877", email = "yeni@example.com" });

        response.IsSuccessStatusCode.Should().BeTrue(await response.Content.ReadAsStringAsync());

        var (phone, email) = await ReadFromDbAsync(id);
        phone.Should().Be("05339998877", "gerçek bir yeni numara verildiğinde güncellenmeli");
        email.Should().Be("yeni@example.com");
    }
}
