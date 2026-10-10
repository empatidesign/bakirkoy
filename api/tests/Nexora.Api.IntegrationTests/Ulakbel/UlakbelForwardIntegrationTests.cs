using Microsoft.EntityFrameworkCore;
using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.Integrations;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Nvi;
using Nexora.Domain.Entities.CitizenSubmissions;
using Nexora.Infrastructure.Persistence;
using Nexora.Infrastructure.Persistence.Repositories;
using Nexora.Infrastructure.Services;
using Npgsql;
using StackExchange.Redis;
using Xunit;

namespace Nexora.Api.IntegrationTests.Ulakbel;

// GERÇEK PostgreSQL + GERÇEK Redis ile Ulakbel gönderim dayanıklılığı (ULAK-03 A–F) kabul testleri.
// Dış Ulakbel HTTP'si kontrollü bir çift (BarrierUlakbelForwardService) ile temsil edilir; gerçek
// başvuru oluşturulmaz. Eşzamanlılık Task.Delay yerine TaskCompletionSource barrier'larıyla kurulur.
// Her senaryo bağımsız DbContext/servis scope'u kullanır; kalıcılık ayrı bir DbContext'ten okunarak
// doğrulanır (repository'nin aynı nesneyi döndürmesi kalıcılık sayılmaz).
[Collection(UlakbelItCollection.Name)]
public sealed class UlakbelForwardIntegrationTests(UlakbelItFixture fx)
{
    private static CitizenSubmission NewSubmission() => CitizenSubmission.Create(
        "Ali Veli", "5551112233", "12345678901", "Cumhuriyet Mahallesi", "2350 Sk. No:1",
        "genel", "request", "normal", "Kaldırım bozuk", "Açıklama");

    private async Task<Guid> SeedAsync(Action<CitizenSubmission>? mutate = null)
    {
        await using var db = fx.NewDb();
        var s = NewSubmission();
        s.SetTrackingNo($"SUB-IT-{Guid.NewGuid():N}"[..20]);
        mutate?.Invoke(s);
        db.Add(s);
        await db.SaveChangesAsync();
        return s.Id;
    }

    private (CitizenSubmissionService Service, AppDbContext Db) BuildService(
        IRedisService redis, IUlakbelForwardService forward, int? lockTtlSeconds = null)
    {
        var db = fx.NewDb();
        var uow = new UnitOfWork(db);

        var configValues = new Dictionary<string, string?>();
        if (lockTtlSeconds is int ttl)
            configValues["CitizenSubmissionSettings:ForwardLockTtlSeconds"] = ttl.ToString();
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(configValues).Build();

        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.LogAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var current = new Mock<ICurrentUser>();
        current.SetupGet(c => c.Id).Returns(Guid.NewGuid());

        var scope = new Mock<IUserScopeService>();
        scope.Setup(s => s.GetScopedNamesAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((HashSet<string>?)null);

        var integration = new Mock<IIntegrationSettingsService>();
        integration.Setup(s => s.ShouldNotifyCitizenOnUlakbelUpdateAsync(It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var service = new CitizenSubmissionService(
            uow, audit.Object, current.Object, scope.Object,
            new Mock<IScopedStaffService>().Object, forward, integration.Object,
            new Mock<INotificationService>().Object, new Mock<INotificationDispatcher>().Object,
            new Mock<IModuleNotificationSettingsService>().Object, new Mock<ISubmissionContentAnalyzer>().Object,
            new Mock<INviService>().Object, new Mock<IFileStorageService>().Object,
            new Mock<ISmsService>().Object, new Mock<ISmsGovernanceService>().Object, redis, config,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<CitizenSubmissionService>.Instance);
        return (service, db);
    }

    private async Task<string?> ForwardStateAsync(Guid id)
    {
        await using var db = fx.NewDb();
        var s = await db.CitizenSubmissions.AsNoTracking().FirstAsync(x => x.Id == id);
        return s.UlakbelForwardState;
    }

    private async Task<CitizenSubmission> ReadAsync(Guid id)
    {
        await using var db = fx.NewDb();
        return await db.CitizenSubmissions.AsNoTracking().FirstAsync(x => x.Id == id);
    }

    // IT-01: aynı başvuruya paralel iki ilk forward → gerçek Redis kilidi ile yalnız bir dış POST,
    // diğer istek ULAKBEL_FORWARD_IN_PROGRESS.
    [Fact]
    public async Task IT01_paralel_iki_forward_tek_POST_uretir()
    {
        var id = await SeedAsync();
        var redis = new RedisService(fx.Redis);
        var forward = new BarrierUlakbelForwardService { Result = Delivered("REMOTE-01") };

        var (svcA, _) = BuildService(redis, forward);
        var (svcB, _) = BuildService(redis, forward);

        var taskA = svcA.ForwardAsync(id, CancellationToken.None);
        await forward.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));

        var exB = await Assert.ThrowsAsync<ConflictException>(() => svcB.ForwardAsync(id, CancellationToken.None));
        Assert.Equal("ULAKBEL_FORWARD_IN_PROGRESS", exB.ErrorCode);
        Assert.Equal(1, forward.CallCount);

        forward.Release.TrySetResult();
        await taskA;

        var saved = await ReadAsync(id);
        Assert.Equal("REMOTE-01", saved.UlakbelTrackingNo);
        Assert.Null(saved.UlakbelForwardState);
        Assert.Equal("forwarded", saved.Status);
    }

    // IT-02: HTTP başlamadan önce "sending" intent'i AYRI bir DbContext'ten görünür.
    [Fact]
    public async Task IT02_sending_intent_ayri_dbcontextten_gorunur()
    {
        var id = await SeedAsync();
        var redis = new RedisService(fx.Redis);
        var forward = new BarrierUlakbelForwardService { Result = Delivered("REMOTE-02") };
        var (svc, _) = BuildService(redis, forward);

        var task = svc.ForwardAsync(id, CancellationToken.None);
        await forward.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));

        Assert.Equal("sending", await ForwardStateAsync(id));

        forward.Release.TrySetResult();
        await task;

        Assert.Null(await ForwardStateAsync(id));
    }

    // IT-03: uzak kabul sonrası caller iptali → durum kilitli kalır (sending); ikinci forward yeni POST atmaz.
    [Fact]
    public async Task IT03_caller_iptali_sonrasi_durum_kilitli_kalir()
    {
        var id = await SeedAsync();
        var redis = new RedisService(fx.Redis);
        var forward = new BarrierUlakbelForwardService();
        var (svc, _) = BuildService(redis, forward);

        using var cts = new CancellationTokenSource();
        var task = svc.ForwardAsync(id, cts.Token);
        await forward.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => task);
        Assert.Equal("sending", await ForwardStateAsync(id));

        var forward2 = new BarrierUlakbelForwardService { Result = Delivered("REMOTE-03") };
        var (svc2, _) = BuildService(redis, forward2);
        var ex = await Assert.ThrowsAsync<ConflictException>(() => svc2.ForwardAsync(id, CancellationToken.None));
        Assert.Equal("ULAKBEL_OUTCOME_UNKNOWN", ex.ErrorCode);
        Assert.Equal(0, forward2.CallCount);
    }

    // IT-05 (kalıcılık dalı): sözleşme-dışı sonuç Unknown → "unknown" kalıcı yazılır; yeni scope'tan tekrar engellenir.
    [Fact]
    public async Task IT05_unknown_sonuc_kalici_yazilir_ve_tekrari_engeller()
    {
        var id = await SeedAsync();
        var redis = new RedisService(fx.Redis);
        var forward = new BarrierUlakbelForwardService { Result = Unknown() };
        var (svc, _) = BuildService(redis, forward);

        forward.Release.TrySetResult();
        var ex = await Assert.ThrowsAsync<ConflictException>(() => svc.ForwardAsync(id, CancellationToken.None));
        Assert.Equal("ULAKBEL_OUTCOME_UNKNOWN", ex.ErrorCode);
        Assert.Equal("unknown", await ForwardStateAsync(id));

        var forward2 = new BarrierUlakbelForwardService { Result = Delivered("X") };
        var (svc2, _) = BuildService(redis, forward2);
        await Assert.ThrowsAsync<ConflictException>(() => svc2.ForwardAsync(id, CancellationToken.None));
        Assert.Equal(0, forward2.CallCount);
    }

    // IT-06: reset, çalışan forward ile AYNI kilidi paylaşır — aktif gönderim varken reset reddedilir,
    // başarı bilgisi ezilmez.
    [Fact]
    public async Task IT06_reset_calisan_forward_ile_yarismaz()
    {
        var id = await SeedAsync();
        var redis = new RedisService(fx.Redis);
        var forward = new BarrierUlakbelForwardService { Result = Delivered("REMOTE-06") };
        var (svcFwd, _) = BuildService(redis, forward);
        var (svcReset, _) = BuildService(redis, forward);

        var taskA = svcFwd.ForwardAsync(id, CancellationToken.None);
        await forward.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));

        var ex = await Assert.ThrowsAsync<ConflictException>(
            () => svcReset.ResetUlakbelForwardStateAsync(id, "Ulakbell'de kayıt bulunamadı.", CancellationToken.None));
        Assert.Equal("ULAKBEL_FORWARD_IN_PROGRESS", ex.ErrorCode);

        forward.Release.TrySetResult();
        await taskA;

        var saved = await ReadAsync(id);
        Assert.Equal("REMOTE-06", saved.UlakbelTrackingNo);
        Assert.Null(saved.UlakbelForwardState);
    }

    // IT-06b: lease yenileme — etkin TTL (floor 10 sn) gerçekten uzatılır ve BAŞLANGIÇ expiry'si aşılır;
    // yenileme olmasaydı kilit düşerdi. Aktif gönderim TTL'den sonra da reset/ikinci forward'ı engeller.
    [Fact]
    public async Task IT06b_lease_yenileme_baslangic_ttlsini_asar_ve_engeli_surdurur()
    {
        var id = await SeedAsync();
        var redis = new RedisService(fx.Redis);
        var forward = new BarrierUlakbelForwardService { Result = Delivered("REMOTE-06B") };
        var (svcFwd, _) = BuildService(redis, forward, lockTtlSeconds: 10);
        var (svcReset, _) = BuildService(redis, forward, lockTtlSeconds: 10);

        var taskA = svcFwd.ForwardAsync(id, CancellationToken.None);
        await forward.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));

        var key = $"ulakbel:forward:{id}";
        var initialTtl = await redis.GetTtlSecondsAsync(key, CancellationToken.None);
        Assert.InRange(initialTtl, 1, 10);

        // Yenileme aralığı ~3.3 sn; 7 sn sonra en az iki kez uzatma olmalı → kalan TTL yenilenmemişe (≈3) göre yüksek.
        await Task.Delay(TimeSpan.FromSeconds(7));
        var midTtl = await redis.GetTtlSecondsAsync(key, CancellationToken.None);
        Assert.True(midTtl > 5, $"Lease yenilenmemiş görünüyor (kalan TTL={midTtl}); yenileme çalışmıyor olabilir.");

        // Başlangıç 10 sn'yi belirgin biçimde aş: yenileme olmasaydı kilit çoktan düşerdi.
        await Task.Delay(TimeSpan.FromSeconds(5));
        var exReset = await Assert.ThrowsAsync<ConflictException>(
            () => svcReset.ResetUlakbelForwardStateAsync(id, "kontrol edildi", CancellationToken.None));
        Assert.Equal("ULAKBEL_FORWARD_IN_PROGRESS", exReset.ErrorCode);

        forward.Release.TrySetResult();
        await taskA;

        var saved = await ReadAsync(id);
        Assert.Equal("REMOTE-06B", saved.UlakbelTrackingNo);
        Assert.Null(saved.UlakbelForwardState);
    }

    // IT-A: iletim alanları korunur — okumadan SONRA teslim commit edilse bile, eski snapshot'la yapılan
    // bildirim/durum yazımı (tam-satır Update() olmadan) trackingNo/state/attempt-id'yi EZMEZ.
    [Fact]
    public async Task ITA_ilgisiz_yazim_iletim_alanlarini_ezmez()
    {
        var id = await SeedAsync();

        // T: kaydı ESKİ haliyle (trackingNo null) okuyup izler.
        await using var dbT = fx.NewDb();
        var sT = await dbT.CitizenSubmissions.FirstAsync(x => x.Id == id);
        Assert.Null(sT.UlakbelTrackingNo);

        // F: başka bir scope'ta gönderimi tamamlar → trackingNo yazılır.
        var redis = new RedisService(fx.Redis);
        var fwd = new BarrierUlakbelForwardService { Result = Delivered("REMOTE-A") };
        fwd.Release.TrySetResult();
        var (svcFwd, _) = BuildService(redis, fwd);
        await svcFwd.ForwardAsync(id, CancellationToken.None);

        // T: yalnız bildirim tercihini değiştirip kaydeder (servis tam-satır Update() KULLANMAZ → kısmi UPDATE).
        sT.ToggleNotifyMuhtar();
        await dbT.SaveChangesAsync();

        var saved = await ReadAsync(id);
        Assert.Equal("REMOTE-A", saved.UlakbelTrackingNo);
        Assert.Equal("forwarded", saved.Status);
        Assert.Null(saved.UlakbelForwardState);
        Assert.True(saved.NotifyMuhtar);
    }

    // IT-A2: GERÇEK SLA job'u ile yarış — job kaydı ESKİ snapshot'la (trackingNo null) okuduktan sonra forward
    // teslim etse bile, job'un SLA işareti yazımı (dar ExecuteUpdate) trackingNo'yu EZMEZ. Eski tam-satır
    // Update() ile bu test trackingNo'yu kaybederdi.
    [Fact]
    public async Task ITA2_gercek_sla_job_stale_snapshotla_trackingno_ezmez()
    {
        var id = await SeedAsync(s => s.SetStatus("in_review"));
        // SLA bildirimi için eşleşen Participant + geçmiş SubmittedAt (aşım) gerekir.
        await using (var setup = fx.NewDb())
        {
            var sub = await setup.CitizenSubmissions.FirstAsync(x => x.Id == id);
            typeof(Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission).GetProperty("SubmittedAt")!
                .SetValue(sub, DateTime.UtcNow.AddHours(-300));
            var participant = Nexora.Domain.Entities.Participants.Participant.Create(
                sub.CitizenTc, "Ali Veli", new DateTime(1990, 1, 1), Nexora.Domain.Enums.Gender.Male, false,
                "hash", null, "5551112233", null, null, "adres");
            setup.Add(participant);
            await setup.SaveChangesAsync();
        }

        // Job'un DbContext'i kaydı ESKİ haliyle (trackingNo null) izler.
        var jobDb = fx.NewDb();
        var stale = await jobDb.CitizenSubmissions.FirstAsync(x => x.Id == id);
        Assert.Null(stale.UlakbelTrackingNo);

        // Forward başka scope'ta tamamlanır → DB trackingNo = REMOTE-SLA.
        var fwd = new BarrierUlakbelForwardService { Result = Delivered("REMOTE-SLA") };
        fwd.Release.TrySetResult();
        var (svcFwd, _) = BuildService(new RedisService(fx.Redis), fwd);
        await svcFwd.ForwardAsync(id, CancellationToken.None);

        // Gerçek job, jobDb'deki eski snapshot'ı bulur; SLA aşım bildirimi + dar ExecuteUpdate ile işaretler.
        var notification = new Mock<INotificationService>();
        notification.Setup(n => n.CreateAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var audit = new Mock<IAuditService>();
        audit.Setup(a => a.LogAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        var job = new Nexora.Infrastructure.Services.Scheduled.CitizenSubmissionStatusCheckJob(
            new UnitOfWork(jobDb), new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build(),
            audit.Object, notification.Object,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<Nexora.Infrastructure.Services.Scheduled.CitizenSubmissionStatusCheckJob>.Instance);

        await job.RunAsync(CancellationToken.None);

        var saved = await ReadAsync(id);
        Assert.Equal("REMOTE-SLA", saved.UlakbelTrackingNo);
        Assert.Equal("forwarded", saved.Status);
        Assert.NotNull(saved.SlaBreachNotifiedAt);
        await jobDb.DisposeAsync();
    }

    // IT-B: reset attempt-id CAS — gecikmiş bir reset (yanlış/eski attempt-id) yeni denemeyi temizleyemez.
    [Fact]
    public async Task ITB_reset_yanlis_attempt_id_ile_yeni_denemeyi_temizleyemez()
    {
        await using var db = fx.NewDb();
        var repo = new CitizenSubmissionRepository(db);
        var s = NewSubmission();
        db.Add(s);
        await db.SaveChangesAsync();

        // B denemesi başlar (gerçek attempt-id).
        var attemptB = await repo.TryBeginForwardAttemptAsync(s.Id, CancellationToken.None);
        Assert.NotNull(attemptB);

        // Gecikmiş R1, A'nın (mevcut olmayan/eski) attempt-id'siyle sıfırlamaya çalışır → 0 satır.
        var staleReset = await repo.TryResetForwardStateAsync(s.Id, Guid.NewGuid(), CancellationToken.None);
        Assert.False(staleReset);
        var afterStale = await repo.GetByIdFreshAsync(s.Id, CancellationToken.None);
        Assert.Equal("sending", afterStale!.UlakbelForwardState);
        Assert.Equal(attemptB, afterStale.UlakbelForwardAttemptId);

        // Doğru attempt-id ile sıfırlama başarılı.
        var correctReset = await repo.TryResetForwardStateAsync(s.Id, attemptB, CancellationToken.None);
        Assert.True(correctReset);
        Assert.Null((await repo.GetByIdFreshAsync(s.Id, CancellationToken.None))!.UlakbelForwardState);
    }

    // IT-C: başlangıç sahiplenmesi koşullu — yalnız iletilmemiş+askıda-değil kayıt yeni deneme başlatabilir.
    [Fact]
    public async Task ITC_kosullu_baslangic_sahiplenmesi()
    {
        await using var db = fx.NewDb();
        var repo = new CitizenSubmissionRepository(db);

        var clean = NewSubmission();
        var forwarded = NewSubmission();
        forwarded.RecordUlakbelForward("Fen İşleri", "REMOTE-DONE");
        var pending = NewSubmission();
        pending.MarkForwardOutcomeUnknown();
        db.AddRange(clean, forwarded, pending);
        await db.SaveChangesAsync();

        Assert.NotNull(await repo.TryBeginForwardAttemptAsync(clean.Id, CancellationToken.None));
        Assert.Null(await repo.TryBeginForwardAttemptAsync(forwarded.Id, CancellationToken.None));
        Assert.Null(await repo.TryBeginForwardAttemptAsync(pending.Id, CancellationToken.None));

        // clean artık sending; ikinci başlangıç da reddedilir (idempotent değil, koşullu).
        Assert.Null(await repo.TryBeginForwardAttemptAsync(clean.Id, CancellationToken.None));
    }

    // IT-06c: kilit KAYBI (Redis anahtarı silinir) + araya reset → attempt-id fence sayesinde eski A'nın
    // gecikmiş teslim yazımı yeni kararı EZEMEZ (delivered UPDATE 0 satır); A OUTCOME_UNKNOWN alır.
    [Fact]
    public async Task IT06c_kilit_kaybinda_bayat_teslim_reset_kararini_ezemez()
    {
        var id = await SeedAsync();
        var redis = new RedisService(fx.Redis);
        var forward = new BarrierUlakbelForwardService { Result = Delivered("REMOTE-06C") };
        var (svcFwd, _) = BuildService(redis, forward, lockTtlSeconds: 90);
        var (svcReset, _) = BuildService(redis, forward, lockTtlSeconds: 90);

        var taskA = svcFwd.ForwardAsync(id, CancellationToken.None);
        await forward.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));

        // Kilit kaybını simüle et: A'nın anahtarını doğrudan sil (renewal yeniden yaratmaz — token yok).
        await fx.Redis.GetDatabase().KeyDeleteAsync($"ulakbel:forward:{id}");

        // Reset artık kilidi alabilir; sending'i temizler + attempt-id'yi sıfırlar (fence bump).
        await svcReset.ResetUlakbelForwardStateAsync(id, "Ulakbell'de kayıt bulunamadı.", CancellationToken.None);
        Assert.Null(await ForwardStateAsync(id));

        // A tamamlanır; teslim yazımı fence'e takılır (attempt-id artık eşleşmez) → OUTCOME_UNKNOWN.
        forward.Release.TrySetResult();
        var ex = await Assert.ThrowsAsync<ConflictException>(() => taskA);
        Assert.Equal("ULAKBEL_OUTCOME_UNKNOWN", ex.ErrorCode);

        // Bayat teslim reset kararını EZMEDİ: trackingNo hâlâ boş, durum temiz.
        var saved = await ReadAsync(id);
        Assert.Null(saved.UlakbelTrackingNo);
        Assert.Null(saved.UlakbelForwardState);
    }

    // IT-07: kira süresi dolduktan sonra eski sahibin release'i yeni sahibin kilidini SİLMEZ.
    [Fact]
    public async Task IT07_lease_suresi_dolunca_eski_sahip_yeni_kilidi_silemez()
    {
        var redis = new RedisService(fx.Redis);
        var key = $"it:lock:{Guid.NewGuid():N}";

        var tokenA = await redis.TryAcquireLockAsync(key, TimeSpan.FromSeconds(1), CancellationToken.None);
        Assert.NotNull(tokenA);

        await Task.Delay(TimeSpan.FromMilliseconds(1500));

        var tokenB = await redis.TryAcquireLockAsync(key, TimeSpan.FromSeconds(30), CancellationToken.None);
        Assert.NotNull(tokenB);

        await redis.ReleaseLockAsync(key, tokenA!, CancellationToken.None);

        var tokenC = await redis.TryAcquireLockAsync(key, TimeSpan.FromSeconds(1), CancellationToken.None);
        Assert.Null(tokenC);

        await redis.ReleaseLockAsync(key, tokenB!, CancellationToken.None);
    }

    // IT-08: normal kira: acquire → release (token ile) → tekrar acquire başarılı; koşulsuz DEL yok.
    [Fact]
    public async Task IT08_normal_kira_release_sonrasi_tekrar_alinabilir()
    {
        var redis = new RedisService(fx.Redis);
        var key = $"it:lock:{Guid.NewGuid():N}";

        var tokenA = await redis.TryAcquireLockAsync(key, TimeSpan.FromSeconds(30), CancellationToken.None);
        Assert.NotNull(tokenA);
        var blocked = await redis.TryAcquireLockAsync(key, TimeSpan.FromSeconds(30), CancellationToken.None);
        Assert.Null(blocked);

        await redis.ReleaseLockAsync(key, tokenA!, CancellationToken.None);

        var tokenB = await redis.TryAcquireLockAsync(key, TimeSpan.FromSeconds(30), CancellationToken.None);
        Assert.NotNull(tokenB);
        await redis.ReleaseLockAsync(key, tokenB!, CancellationToken.None);
    }

    // IT-09: gerçek TrackingNo unique index ihlalinde sınırlı yeniden üretim + insert retry → ikinci kayıt
    // farklı numarayla saklanır (üç kanalın da kullandığı ortak TrackingNoRetry mekanizması).
    [Fact]
    public async Task IT09_tracking_cakismasinda_retry_ile_ikinci_kayit_farkli_numarayla_saklanir()
    {
        var dup = $"SUB-DUP-{Guid.NewGuid():N}"[..24];
        var firstId = await SeedAsync(s => s.SetTrackingNo(dup));

        await using var db = fx.NewDb();
        var uow = new UnitOfWork(db);
        var s2 = NewSubmission();
        s2.SetTrackingNo(dup);
        await uow.CitizenSubmissions.AddAsync(s2, CancellationToken.None);

        var unique = $"SUB-UNQ-{Guid.NewGuid():N}"[..24];
        await TrackingNoRetry.SaveWithRetryAsync(uow, () => s2.SetTrackingNo(unique), CancellationToken.None);

        Assert.Equal(unique, s2.TrackingNo);

        await using var check = fx.NewDb();
        Assert.True(await check.CitizenSubmissions.AnyAsync(x => x.Id == firstId && x.TrackingNo == dup));
        Assert.True(await check.CitizenSubmissions.AnyAsync(x => x.Id == s2.Id && x.TrackingNo == unique));
    }

    // IT-10a: TrackingNo dışı unique ihlali (PK) yeniden DENENMEZ → tek denemede kontrollü hata, yeni numara üretilmez.
    [Fact]
    public async Task IT10_baska_unique_ihlali_yeniden_denenmez()
    {
        var existingId = await SeedAsync();

        await using var db = fx.NewDb();
        var uow = new UnitOfWork(db);
        var clash = NewSubmission();
        clash.Id = existingId;
        clash.SetTrackingNo($"SUB-PK-{Guid.NewGuid():N}"[..24]);
        await uow.CitizenSubmissions.AddAsync(clash, CancellationToken.None);

        var regenerations = 0;
        await Assert.ThrowsAsync<DbUpdateException>(() =>
            TrackingNoRetry.SaveWithRetryAsync(uow, () => regenerations++, CancellationToken.None));
        Assert.Equal(0, regenerations);
    }

    // IT-10b: sürekli tracking çakışmasında sınırlı deneme sonunda kontrollü hata; DB'de çift kayıt yok.
    [Fact]
    public async Task IT10_surekli_cakismada_sinirli_deneme_sonunda_hata()
    {
        var dup = $"SUB-DUP-{Guid.NewGuid():N}"[..24];
        await SeedAsync(s => s.SetTrackingNo(dup));

        await using var db = fx.NewDb();
        var uow = new UnitOfWork(db);
        var s2 = NewSubmission();
        s2.SetTrackingNo(dup);
        await uow.CitizenSubmissions.AddAsync(s2, CancellationToken.None);

        var regenerations = 0;
        await Assert.ThrowsAsync<DbUpdateException>(() =>
            TrackingNoRetry.SaveWithRetryAsync(uow, () => { regenerations++; s2.SetTrackingNo(dup); }, CancellationToken.None, maxAttempts: 3));
        Assert.Equal(2, regenerations);

        await using var check = fx.NewDb();
        Assert.Equal(1, await check.CitizenSubmissions.CountAsync(x => x.TrackingNo == dup));
    }

    // IT-11: reset gerekçe/durum kuralları — boş gerekçe, zaten iletilmiş kayıt reddedilir; geçerli mutabakat
    // kararı askıdaki durumu temizler.
    [Fact]
    public async Task IT11_reset_bos_gerekce_reddeder()
    {
        var id = await SeedAsync(s => s.MarkForwardOutcomeUnknown());
        var redis = new RedisService(fx.Redis);
        var (svc, _) = BuildService(redis, new BarrierUlakbelForwardService());

        var ex = await Assert.ThrowsAsync<ConflictException>(
            () => svc.ResetUlakbelForwardStateAsync(id, "   ", CancellationToken.None));
        Assert.Equal("RESET_REASON_REQUIRED", ex.ErrorCode);
    }

    [Fact]
    public async Task IT11_reset_zaten_iletilmis_kaydi_reddeder()
    {
        var id = await SeedAsync(s => s.RecordUlakbelForward("Fen İşleri", "REMOTE-DONE"));
        var redis = new RedisService(fx.Redis);
        var (svc, _) = BuildService(redis, new BarrierUlakbelForwardService());

        var ex = await Assert.ThrowsAsync<ConflictException>(
            () => svc.ResetUlakbelForwardStateAsync(id, "kontrol edildi", CancellationToken.None));
        Assert.Equal("ALREADY_FORWARDED", ex.ErrorCode);
    }

    [Fact]
    public async Task IT11_reset_gecerli_gerekce_ile_askidaki_durumu_temizler()
    {
        var id = await SeedAsync(s => s.MarkForwardOutcomeUnknown());
        var redis = new RedisService(fx.Redis);
        var (svc, _) = BuildService(redis, new BarrierUlakbelForwardService());

        await svc.ResetUlakbelForwardStateAsync(id, "Ulakbell panelinde kayıt bulunamadı.", CancellationToken.None);

        Assert.Null(await ForwardStateAsync(id));
    }

    private static UlakbelForwardResult Delivered(string trackingNo) =>
        new(false, trackingNo, true, null, UlakbelForwardOutcome.Delivered);

    private static UlakbelForwardResult Unknown() =>
        new(false, "", false, "belirsiz", UlakbelForwardOutcome.Unknown);
}

internal sealed class BarrierUlakbelForwardService : IUlakbelForwardService
{
    public readonly TaskCompletionSource Entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public readonly TaskCompletionSource Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int _callCount;
    public int CallCount => Volatile.Read(ref _callCount);
    public UlakbelForwardResult Result { get; set; } = new(false, "REMOTE", true, null, UlakbelForwardOutcome.Delivered);

    public async Task<UlakbelForwardResult> ForwardAsync(UlakbelForwardRequest request, CancellationToken ct)
    {
        Interlocked.Increment(ref _callCount);
        Entered.TrySetResult();
        await Release.Task.WaitAsync(ct);
        return Result;
    }
}
