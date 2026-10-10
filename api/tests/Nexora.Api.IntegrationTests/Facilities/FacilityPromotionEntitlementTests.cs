using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Facilities;
using Nexora.Infrastructure.Persistence;
using Xunit;

namespace Nexora.Api.IntegrationTests.Facilities;

// docs/devamsizlik-yedek-kisisel-hak-katilim-siniri-incelemesi-2026-09-27.md
// D01: yedekten asıla terfi edene programın TAM kişisel süresi asıla geçince verilir
//      (recurring=personal_duration → bugün + PeriodMonths); manuel ve otomatik terfi AYNI hakkı üretir.
// D02: terfi sonrası kalan yedekler kararlı sırayla yeniden numaralandırılır.
// D07: pasifleştirilmiş grupta asıl çıkarılınca yedek OTOMATİK terfi etmez.
[Collection(ApiCollection.Name)]
public sealed class FacilityPromotionEntitlementTests : IAsyncLifetime
{
    private const string Module = "sports";
    private readonly NexoraApiFactory _factory;
    private HttpClient _admin = null!;
    private FacilityScenario.Base _base = null!;

    public FacilityPromotionEntitlementTests(ApiTestHost host) => _factory = host.Factory;

    public async Task InitializeAsync()
    {
        _admin = await _factory.CreateClientAsync(
            TestIdentity.SuperAdmin(Guid.NewGuid(), $"promo-{Guid.NewGuid():N}@nexora.local"));
        _base = await FacilityScenario.CreateBaseAsync(_admin, Module, Guid.NewGuid().ToString("N")[..6]);
    }

    public async Task DisposeAsync() => await FacilityScenario.CleanupAsync(_admin, _base);

    private static FacilityScenario.GroupOptions RecurringOptions(int capacity = 1) => new()
    {
        AutoApprove = true,
        Capacity = capacity,
        ReserveCapacity = 3,
        PeriodType = "recurring",
        PeriodMonths = 3,
        PeriodStart = DateTime.UtcNow.Date.AddDays(1),
        PeriodEnd = DateTime.UtcNow.Date.AddMonths(12),
        ApplicationStartDate = DateTime.UtcNow.Date,
        ApplicationEndDate = DateTime.UtcNow.Date.AddDays(30),
        Schedule = [new FacilityScenario.ScheduleSlot("monday", "09:00", "10:00")],
    };

    private async Task<Guid> CreateActiveRecurringGroupAsync(string tag, int capacity = 1)
    {
        var groupId = await FacilityScenario.CreateGroupAsync(_admin, _base, tag, RecurringOptions(capacity));
        // Recurring dönemin AKTİF olması için başlangıcı geçmişe çek (create geçmiş tarihi reddeder).
        await FacilityScenario.BackdateAsync(_admin, _base, groupId,
            applicationStartDate: DateTime.UtcNow.Date.AddDays(-5),
            applicationEndDate: DateTime.UtcNow.Date.AddDays(30),
            periodStart: DateTime.UtcNow.Date.AddDays(-10),
            periodEnd: DateTime.UtcNow.Date.AddMonths(12));
        return groupId;
    }

    private async Task<Guid> RegisterAsync(Guid groupId, string fullName, DateTime? membershipDate = null)
    {
        var res = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations", new
        {
            groupId,
            applicationId = (Guid?)null,
            participantId = (Guid?)null,
            fullName,
            tckn = FacilityScenario.NewTckn(Random.Shared),
            phone = "05320000000",
            birthDate = new DateTime(1998, 5, 5),
            guardianPhone = (string?)null,
            membershipDate,
        });
        res.StatusCode.Should().Be(HttpStatusCode.Created, because: await res.Content.ReadAsStringAsync());
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("data").GetProperty("id").GetGuid();
    }

    private async Task<T> WithDbAsync<T>(Func<AppDbContext, Task<T>> query)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await query(db);
    }

    private Task<FacilityRegistration> RegAsync(Guid id)
        => WithDbAsync(db => db.Set<FacilityRegistration>().AsNoTracking().FirstAsync(r => r.Id == id));

    [Fact]
    public async Task Otomatik_terfi_kisisel_tam_sure_verir_bugunden_periodMonths()
    {
        var group = await CreateActiveRecurringGroupAsync("auto");
        var a = await RegisterAsync(group, "Asil Bir");
        var b = await RegisterAsync(group, "Yedek Bir");
        var c = await RegisterAsync(group, "Yedek Iki");

        (await RegAsync(a)).Kind.Should().Be("main");
        (await RegAsync(b)).Kind.Should().Be("reserve");

        var remove = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{a}/remove", new { reason = "Test" });
        remove.StatusCode.Should().Be(HttpStatusCode.OK, because: await remove.Content.ReadAsStringAsync());

        var promoted = await RegAsync(b);
        var today = TurkeyTime.TodayDate();
        promoted.Kind.Should().Be("main");
        promoted.MembershipStart!.Value.Date.Should().Be(today);
        promoted.PeriodEnd!.Value.Date.Should().Be(today.AddMonths(3),
            because: "kişisel süre asıla geçince başlar ve programda tanımlı PeriodMonths kadardır (D01)");

        // D02: kalan yedek kararlı sırayla yeniden numaralandırılır.
        (await RegAsync(c)).WaitlistOrder.Should().Be(1);
    }

    [Fact]
    public async Task Manuel_terfi_otomatikle_ayni_kisisel_hak_araligini_uretir()
    {
        var group = await CreateActiveRecurringGroupAsync("manual");
        var main = await RegisterAsync(group, "Asil Manuel");
        var reserve = await RegisterAsync(group, "Yedek Manuel");
        (await RegAsync(reserve)).Kind.Should().Be("reserve");

        // Asıl yedeğe alınınca yer açılır (D04 demote); yedek manuel terfi edilir (D01/D04 kapasite kontrolü).
        var demote = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{main}/demote", new { });
        demote.StatusCode.Should().Be(HttpStatusCode.OK, because: await demote.Content.ReadAsStringAsync());

        var promote = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{reserve}/promote", new { });
        promote.StatusCode.Should().Be(HttpStatusCode.OK, because: await promote.Content.ReadAsStringAsync());

        var promoted = await RegAsync(reserve);
        var today = TurkeyTime.TodayDate();
        promoted.Kind.Should().Be("main");
        promoted.MembershipStart!.Value.Date.Should().Be(today);
        promoted.PeriodEnd!.Value.Date.Should().Be(today.AddMonths(3),
            because: "manuel terfi otomatik terfiyle AYNI kişisel hak aralığını üretmeli (D01)");
    }

    [Fact]
    public async Task Dolu_gruba_manuel_terfi_kapasite_asamaz_D04()
    {
        var group = await CreateActiveRecurringGroupAsync("full");
        await RegisterAsync(group, "Asil Dolu");
        var reserve = await RegisterAsync(group, "Yedek Dolu");
        (await RegAsync(reserve)).Kind.Should().Be("reserve");

        // Kapasite 1 ve asıl dolu; manuel terfi kapasiteyi aşmamalı → QUOTA_FULL.
        var promote = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{reserve}/promote", new { });
        promote.StatusCode.Should().Be(HttpStatusCode.Conflict, because: await promote.Content.ReadAsStringAsync());
        (await RegAsync(reserve)).Kind.Should().Be("reserve", because: "dolu grupta manuel terfi reddedilmeli (D04)");
    }

    [Fact]
    public async Task Yedek_kontenjani_doluyken_asil_yedege_alinamaz_V02()
    {
        var group = await FacilityScenario.CreateGroupAsync(_admin, _base, "demofull", RecurringOptions() with { ReserveCapacity = 1 });
        await FacilityScenario.BackdateAsync(_admin, _base, group,
            applicationStartDate: DateTime.UtcNow.Date.AddDays(-5), applicationEndDate: DateTime.UtcNow.Date.AddDays(30),
            periodStart: DateTime.UtcNow.Date.AddDays(-10), periodEnd: DateTime.UtcNow.Date.AddMonths(12));

        var main = await RegisterAsync(group, "Asil DemoFull");
        var reserve = await RegisterAsync(group, "Yedek DemoFull");
        (await RegAsync(reserve)).Kind.Should().Be("reserve");

        // Yedek kontenjanı (1) dolu; asıl yedeğe alınamaz → QUOTA_FULL.
        var demote = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{main}/demote", new { });
        demote.StatusCode.Should().Be(HttpStatusCode.Conflict, because: await demote.Content.ReadAsStringAsync());
        (await RegAsync(main)).Kind.Should().Be("main", because: "yedek dolu olduğundan demote reddedilmeli (V02)");
    }

    private Task<FacilityGroup> GroupAsync(Guid id)
        => WithDbAsync(db => db.Set<FacilityGroup>().AsNoTracking().FirstAsync(g => g.Id == id));

    [Fact]
    public async Task Yedek_sayaci_ve_compaction_birlesik_kuyruk_V03()
    {
        var group = await CreateActiveRecurringGroupAsync("v03");
        await RegisterAsync(group, "Asil V03");
        var r1 = await RegisterAsync(group, "Yedek V03-1");
        var r2 = await RegisterAsync(group, "Yedek V03-2");
        var r3 = await RegisterAsync(group, "Yedek V03-3");

        (await RegAsync(r1)).WaitlistOrder.Should().Be(1);
        (await RegAsync(r2)).WaitlistOrder.Should().Be(2);
        (await RegAsync(r3)).WaitlistOrder.Should().Be(3);
        (await GroupAsync(group)).WaitlistCount.Should().Be(3,
            because: "grup yedek sayacı TÜM aktif yedekleri sayar — carry ile birleşik kuyruk (V03)");

        var remove = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{r2}/remove", new { reason = "Test" });
        remove.StatusCode.Should().Be(HttpStatusCode.OK, because: await remove.Content.ReadAsStringAsync());

        (await RegAsync(r1)).WaitlistOrder.Should().Be(1);
        (await RegAsync(r3)).WaitlistOrder.Should().Be(2,
            because: "ortadaki yedek çıkınca kalan yedekler global kararlı sırayla 1'den yeniden numaralandırılır (V03)");
        (await GroupAsync(group)).WaitlistCount.Should().Be(2);
    }

    [Fact]
    public async Task Yedek_kapasitesi_sifir_iken_dolu_gruba_kayit_reddedilir_V02_1()
    {
        var group = await FacilityScenario.CreateGroupAsync(_admin, _base, "zeroreg", RecurringOptions() with { ReserveCapacity = 0 });
        await FacilityScenario.BackdateAsync(_admin, _base, group,
            applicationStartDate: DateTime.UtcNow.Date.AddDays(-5), applicationEndDate: DateTime.UtcNow.Date.AddDays(30),
            periodStart: DateTime.UtcNow.Date.AddDays(-10), periodEnd: DateTime.UtcNow.Date.AddMonths(12));

        await RegisterAsync(group, "Asil Zero");

        // Kapasite 1 dolu + yedek kapasitesi 0 (GERÇEK sıfır, sınırsız değil) → ikinci kayıt yedeğe düşmez, reddedilir.
        var second = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations", new
        {
            groupId = group, applicationId = (Guid?)null, participantId = (Guid?)null,
            fullName = "Ikinci Zero", tckn = FacilityScenario.NewTckn(Random.Shared),
            phone = "05320000001", birthDate = new DateTime(1998, 5, 5), guardianPhone = (string?)null,
        });
        second.StatusCode.Should().Be(HttpStatusCode.Conflict,
            because: "yedek kapasitesi 0 iken dolu gruba kayıt yedeğe alınmamalı (V02.1)");
    }

    [Fact]
    public async Task Yedek_kapasitesi_sifir_iken_asil_yedege_alinamaz_V02_1()
    {
        var group = await FacilityScenario.CreateGroupAsync(_admin, _base, "zerodem", RecurringOptions() with { ReserveCapacity = 0 });
        await FacilityScenario.BackdateAsync(_admin, _base, group,
            applicationStartDate: DateTime.UtcNow.Date.AddDays(-5), applicationEndDate: DateTime.UtcNow.Date.AddDays(30),
            periodStart: DateTime.UtcNow.Date.AddDays(-10), periodEnd: DateTime.UtcNow.Date.AddMonths(12));

        var main = await RegisterAsync(group, "Asil ZeroDemote");

        // Yedek kapasitesi 0 → asıl yedeğe alınamaz (yedek listesine yer yok) → QUOTA_FULL.
        var demote = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{main}/demote", new { });
        demote.StatusCode.Should().Be(HttpStatusCode.Conflict,
            because: "yedek kapasitesi 0 iken demote reddedilmeli (V02.1)");
        (await RegAsync(main)).Kind.Should().Be("main");
    }

    [Fact]
    public async Task Pasif_grupta_asil_cikinca_yedek_otomatik_terfi_etmez()
    {
        var group = await CreateActiveRecurringGroupAsync("inactive");
        var a = await RegisterAsync(group, "Asil Pasif");
        var b = await RegisterAsync(group, "Yedek Pasif");
        (await RegAsync(b)).Kind.Should().Be("reserve");

        // Grubu pasifleştir (D07: kapanan/pasif programa otomatik terfi yapılmamalı).
        await WithDbAsync(async db =>
        {
            var g = await db.Set<FacilityGroup>().FirstAsync(x => x.Id == group);
            g.Deactivate();
            await db.SaveChangesAsync();
            return true;
        });

        var remove = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{a}/remove", new { reason = "Test" });
        remove.StatusCode.Should().Be(HttpStatusCode.OK, because: await remove.Content.ReadAsStringAsync());

        (await RegAsync(b)).Kind.Should().Be("reserve",
            because: "pasif grupta boşalan asıl yerine yedek otomatik alınmamalı (D07)");
    }

    [Fact]
    public async Task Manuel_terfi_pasif_grupta_reddedilir_Y07()
    {
        var group = await CreateActiveRecurringGroupAsync("manualinactive");
        var a = await RegisterAsync(group, "Asil MI");
        var b = await RegisterAsync(group, "Yedek MI");
        (await RegAsync(b)).Kind.Should().Be("reserve");

        // Grubu pasifleştir → asıl çıkınca D07 ile otomatik terfi olmaz, yedek reserve kalır (yer boşalsa da).
        await WithDbAsync(async db =>
        {
            var g = await db.Set<FacilityGroup>().FirstAsync(x => x.Id == group);
            g.Deactivate();
            await db.SaveChangesAsync();
            return true;
        });
        var remove = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{a}/remove", new { reason = "Test" });
        remove.StatusCode.Should().Be(HttpStatusCode.OK, because: await remove.Content.ReadAsStringAsync());
        (await RegAsync(b)).Kind.Should().Be("reserve");

        // MANUEL terfi: yer boş olsa bile pasif grupta reddedilmeli (Y07 — otomatik yolla simetrik guard).
        var promote = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{b}/promote", new { });
        promote.StatusCode.Should().Be(HttpStatusCode.Conflict,
            because: "pasif grupta manuel terfi de reddedilmeli (Y07)");
        (await RegAsync(b)).Kind.Should().Be("reserve");
    }

    [Fact]
    public async Task Otomatik_terfi_ileri_donem_doluysa_tam_araligi_kontrol_eder_Z02()
    {
        // Kapasite 1, 3 aylık dönemler; pStart = bugün-10 (CreateActiveRecurringGroupAsync backdate).
        // A dönem-0'a HİZALI (pStart'ta başlar → dönem-1'e taşmaz), C dönem-1 başında asıl. B bugün yedek.
        // A çıkınca B'ye verilecek TAM kişisel süre (bugün..bugün+3ay) dönem-1'e 10 gün taşar; dönem-1 C ile
        // dolu → otomatik terfi B'yi ALMAMALI (Z02: tam-aralık kapasite kontrolü otomatik yola da bağlı).
        var pStart = DateTime.UtcNow.Date.AddDays(-10);
        var group = await CreateActiveRecurringGroupAsync("z02");
        var a = await RegisterAsync(group, "Asil A Z02", membershipDate: pStart);
        var c = await RegisterAsync(group, "Asil C Z02", membershipDate: pStart.AddMonths(3));
        var b = await RegisterAsync(group, "Yedek B Z02");

        (await RegAsync(a)).Kind.Should().Be("main");
        (await RegAsync(c)).Kind.Should().Be("main", because: "ileri dönemde (dönem-1) kapasite boş, C asıl olur");
        (await RegAsync(b)).Kind.Should().Be("reserve");

        var remove = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/{a}/remove", new { reason = "Test" });
        remove.StatusCode.Should().Be(HttpStatusCode.OK, because: await remove.Content.ReadAsStringAsync());

        (await RegAsync(b)).Kind.Should().Be("reserve",
            because: "B'nin tam kişisel süresi ileri dönem-1'e taşıyor ve orası C ile dolu → otomatik terfi kapasite aşmamalı (Z02)");
    }

    [Fact]
    public async Task Toplu_import_ikinci_satir_kendi_transactionunda_islenir_Y01()
    {
        var group = await CreateActiveRecurringGroupAsync("import");
        var t1 = FacilityScenario.NewTckn(Random.Shared);
        var t2 = FacilityScenario.NewTckn(Random.Shared);

        // Kapasite 1: ilk satır asıl (registered), ikinci satır yedek (waitlisted). İkinci satırın da
        // BAŞARILI işlenmesi, ilk satır commit olduktan sonra ikinci satırın KENDİ transaction'ını
        // açabildiğini kanıtlar (Y01: commit sonrası _transaction null'lanmasaydı ikinci satır patlardı).
        var res = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/bulk-import", new
        {
            groupId = group,
            rows = new[] { new { tckn = t1 }, new { tckn = t2 } },
        });
        res.StatusCode.Should().Be(HttpStatusCode.OK, because: await res.Content.ReadAsStringAsync());
        var data = (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        data.GetProperty("registered").GetInt32().Should().Be(1);
        data.GetProperty("waitlisted").GetInt32().Should().Be(1);
        data.GetProperty("failed").GetInt32().Should().Be(0,
            because: "ikinci satır kendi transaction'ında sorunsuz işlenmeli (Y01)");
    }

    [Fact]
    public async Task Import_kisa_hak_suresi_ileri_donem_dolusundan_etkilenmez_Z04()
    {
        // Kapasite 1. İleri dönem-1'de asıl C var; dönem-0 boş. İçe aktarılan satırın hakkı KISA
        // (bugün..bugün+1ay, yalnız dönem-0). Kapasite kontrolü gerçek kısa bitişle yapılmalı → dönem-0
        // boş → asıl (registered). Eski `max(periodEnd, mEnd)` genişletmesi dönem-1'i de kontrol edip
        // C yüzünden yanlışlıkla dolu sayıyordu (Z04).
        var group = await CreateActiveRecurringGroupAsync("z04");
        var c = await RegisterAsync(group, "Asil C Z04", membershipDate: DateTime.UtcNow.Date.AddMonths(3).AddDays(5));
        (await RegAsync(c)).Kind.Should().Be("main");

        var res = await _admin.PostAsJsonAsync($"/api/v1/{Module}/registrations/bulk-import", new
        {
            groupId = group,
            rows = new[]
            {
                new { tckn = FacilityScenario.NewTckn(Random.Shared), periodEnd = DateTime.UtcNow.Date.AddMonths(1) },
            },
        });
        res.StatusCode.Should().Be(HttpStatusCode.OK, because: await res.Content.ReadAsStringAsync());
        var data = (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        data.GetProperty("registered").GetInt32().Should().Be(1,
            because: "kısa hak yalnız boş dönem-0'ı kapsar; ileri dönem-1'in doluluğu import'u engellememeli (Z04)");
        data.GetProperty("waitlisted").GetInt32().Should().Be(0);
        data.GetProperty("failed").GetInt32().Should().Be(0);
    }
}
