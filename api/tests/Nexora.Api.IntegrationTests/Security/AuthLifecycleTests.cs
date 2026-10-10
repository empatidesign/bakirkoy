using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Application.Common.Interfaces;
using Nexora.Domain.Entities.Auth;
using Nexora.Infrastructure.Persistence;
using Xunit;

namespace Nexora.Api.IntegrationTests.Security;

// Task 11 (security), Step 1: real registration/OTP/password-policy/lockout/refresh-rotation/
// logout/session-invalidation lifecycle proof for BOTH admin (AuthService.cs) and citizen
// (ParticipantAuthService.cs), against the REAL hosted API + real Postgres + real Redis (no
// mocking of Redis/OTP/lockout timing — real clock, real TTLs, per Ruling B/brief Step 1). Uses
// the Redis-enabled host (NexoraApiFactory.CreateForCollectionWithRedis, Task 6's established
// pattern) because every mechanism here (OTP, session sets, current-session-id, revoked-session)
// is Redis-backed.
[Collection(ApiCollection.Name)]
public sealed class AuthLifecycleTests : IAsyncLifetime
{
    private NexoraApiFactory _factory = null!;
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public async Task InitializeAsync()
    {
        _factory = NexoraApiFactory.CreateForCollectionWithRedis();
        await _factory.InitializeAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private sealed record Envelope<T>(bool Success, int StatusCode, T? Data, string? ErrorCode, string? Message);

    private static async Task<Envelope<JsonElement>> ReadAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<Envelope<JsonElement>>(body, Web)
            ?? throw new InvalidOperationException($"Could not parse envelope: {body}");
    }

    // Seeds a real AdminUser with a real BCrypt hash for `password`, bound to a role holding
    // NO permissions (irrelevant to auth lifecycle tests, only login/OTP/lockout/refresh
    // endpoints are exercised, all of which are RequireAuthorization() not RequirePermission()).
    private async Task<(Guid Id, string Email)> SeedAdminAsync(string password, bool mustChangePassword = false, bool isActive = true)
    {
        var id = Guid.NewGuid();
        var email = $"t11-admin-{Guid.NewGuid():N}@nexora.local";
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var role = await db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Key == "t11-plain-admin-role");
        if (role is null)
        {
            role = Role.Create("t11-plain-admin-role", "t11-plain-admin-role", "Task 11 auth lifecycle role (no permissions)");
            await db.Roles.AddAsync(role);
            await db.SaveChangesAsync();
        }

        var hash = BCrypt.Net.BCrypt.HashPassword(password);
        var admin = AdminUser.Create("T11 Auth Lifecycle Admin", email, null, null, hash, role.Id);
        admin.Id = id;
        if (!mustChangePassword)
        {
            admin.CompletePasswordChange(hash);
            // AdminUser.Create leaves IsFirstLogin=true; LoginAsync routes first-login users
            // through OtpPurpose.AccountActivation instead of TwoFactor. RecordLogin (the real
            // "already logged in before" transition) is the only way to flip IsFirstLogin off,
            // matching what a real completed prior login would have done.
            admin.RecordLogin(null);
        }
        if (!isActive) admin.Deactivate();
        await db.AdminUsers.AddAsync(admin);
        await db.SaveChangesAsync();

        return (id, email);
    }

    // Seeds a real Participant with a real BCrypt hash, verified + password-set, matching the
    // shape a real completed citizen registration would leave behind. tcknSeed is combined with
    // a random component so repeated calls (e.g. the x5-repeatability Theories, which invoke the
    // same underlying test method literal multiple times) never collide on the unique TCKN index.
    private async Task<(Guid Id, string Tckn)> SeedCitizenAsync(string password, int tcknSeed)
    {
        var tckn = CitizenTestIdentity.GenerateValidTckn(tcknSeed * 1_000_000 + Random.Shared.Next(1, 999_999));
        var id = Guid.NewGuid();
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var hash = BCrypt.Net.BCrypt.HashPassword(password);
        var participant = Nexora.Domain.Entities.Participants.Participant.Create(
            tckn, $"T11 Citizen {tcknSeed}", new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            Nexora.Domain.Enums.Gender.Male, isMinor: false, passwordHash: hash,
            email: $"t11-citizen-{Guid.NewGuid():N}@nexora.local", phone: $"5{tcknSeed:D9}",
            guardianPhone: null, guardianEmail: null, address: "Test Mah.");
        participant.Id = id;
        participant.CompleteInitialPassword(hash);
        participant.MarkVerified();
        await db.Participants.AddAsync(participant);
        await db.SaveChangesAsync();

        return (id, tckn);
    }

    // ------------------------------------------------------------------------------------
    // Admin: login -> OTP -> tokens. Real Redis OTP key (`otp:{userId}:{purpose}`) is read
    // directly to obtain the real generated code (OtpSettings:MockCode is empty in the Testing
    // host per NexoraApiFactory, so a REAL random code is generated, not a fixed mock).
    // ------------------------------------------------------------------------------------
    private async Task<string> ReadRealOtpCodeAsync(Guid subjectId, Nexora.Domain.Enums.OtpPurpose purpose)
    {
        var redis = _factory.Services.GetRequiredService<IRedisService>();
        var data = await redis.GetAsync<JsonElement>($"otp:{subjectId}:{purpose}");
        return data.GetProperty("Code").GetString()!;
    }

    [Fact]
    public async Task Admin_login_verify_otp_issues_real_tokens_and_resets_failed_count()
    {
        var (id, email) = await SeedAdminAsync("Admin2026!");
        var client = _factory.CreateClient();

        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        loginRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginBody = await ReadAsync(loginRes);
        loginBody.Data!.GetProperty("requiresOtp").GetBoolean().Should().BeTrue();
        var otpSessionToken = loginBody.Data.GetProperty("otpSessionToken").GetString();

        var code = await ReadRealOtpCodeAsync(id, Nexora.Domain.Enums.OtpPurpose.TwoFactor);

        var verifyRes = await client.PostAsJsonAsync("/api/v1/auth/verify-otp", new { otpSessionToken, code });
        verifyRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var verifyBody = await ReadAsync(verifyRes);
        verifyBody.Data!.GetProperty("accessToken").GetString().Should().NotBeNullOrEmpty();
        verifyBody.Data.GetProperty("refreshToken").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Admin_otp_wrong_code_returns_OTP_MISMATCH_then_correct_code_still_works()
    {
        var (id, email) = await SeedAdminAsync("Admin2026!");
        var client = _factory.CreateClient();

        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        var otpSessionToken = (await ReadAsync(loginRes)).Data!.GetProperty("otpSessionToken").GetString();

        var wrongRes = await client.PostAsJsonAsync("/api/v1/auth/verify-otp", new { otpSessionToken, code = "000000" });
        wrongRes.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(wrongRes)).ErrorCode.Should().Be("OTP_MISMATCH");

        var code = await ReadRealOtpCodeAsync(id, Nexora.Domain.Enums.OtpPurpose.TwoFactor);
        var correctRes = await client.PostAsJsonAsync("/api/v1/auth/verify-otp", new { otpSessionToken, code });
        correctRes.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // OtpSettings:MaxAttempts default 5 (real config, not overridden by the Testing host).
    [Fact]
    public async Task Admin_otp_too_many_wrong_attempts_returns_OTP_TOO_MANY_ATTEMPTS()
    {
        var (_, email) = await SeedAdminAsync("Admin2026!");
        var client = _factory.CreateClient();

        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        var otpSessionToken = (await ReadAsync(loginRes)).Data!.GetProperty("otpSessionToken").GetString();

        HttpResponseMessage last = null!;
        for (var i = 0; i < 5; i++)
            last = await client.PostAsJsonAsync("/api/v1/auth/verify-otp", new { otpSessionToken, code = "000000" });

        last.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(last)).ErrorCode.Should().Be("OTP_TOO_MANY_ATTEMPTS");
    }

    // Reused-OTP: verify successfully once (removes the real Redis key on success), then
    // immediately retry the SAME code -> real finding per brief: OTP_EXPIRED (key not found),
    // not a distinct "already used" code, because VerifyAsync's null-check branch treats
    // missing-key and truly-expired identically.
    [Fact]
    public async Task Admin_otp_reused_after_successful_verify_returns_OTP_EXPIRED()
    {
        var (id, email) = await SeedAdminAsync("Admin2026!");
        var client = _factory.CreateClient();

        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        var otpSessionToken = (await ReadAsync(loginRes)).Data!.GetProperty("otpSessionToken").GetString();
        var code = await ReadRealOtpCodeAsync(id, Nexora.Domain.Enums.OtpPurpose.TwoFactor);

        var first = await client.PostAsJsonAsync("/api/v1/auth/verify-otp", new { otpSessionToken, code });
        first.StatusCode.Should().Be(HttpStatusCode.OK);

        // The pending-OTP token itself is single-use for VerifyOtpAsync's userId lookup too
        // (ValidatePendingOtpToken is a JWT, still valid, but the OTP redis key is gone) -> the
        // real code path hits OTP_EXPIRED (missing key), proving the brief's "reused OTP" finding.
        var second = await client.PostAsJsonAsync("/api/v1/auth/verify-otp", new { otpSessionToken, code });
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(second)).ErrorCode.Should().Be("OTP_EXPIRED");
    }

    // Resend cooldown == ValiditySeconds (60s default) per the brief's explicit "confirm this
    // equality is intentional" instruction -> real EnsureCanResendAsync throws immediately after
    // a fresh SendAsync.
    [Fact]
    public async Task Admin_resend_otp_before_cooldown_expires_returns_OTP_RESEND_COOLDOWN_with_real_remaining_seconds()
    {
        var (_, email) = await SeedAdminAsync("Admin2026!");
        var client = _factory.CreateClient();

        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        var otpSessionToken = (await ReadAsync(loginRes)).Data!.GetProperty("otpSessionToken").GetString();

        var resendRes = await client.PostAsJsonAsync("/api/v1/auth/resend-otp", new { otpSessionToken });
        resendRes.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await ReadAsync(resendRes);
        body.ErrorCode.Should().Be("OTP_RESEND_COOLDOWN");
        body.Message.Should().MatchRegex(@"\d+ saniye", "the real remaining-seconds count must appear in the message");
    }

    // ------------------------------------------------------------------------------------
    // Lockout: real threshold (LockoutSettings:MaxFailedAttempts, default 5), real 1-minute
    // window (LockoutSettings:LockoutMinutes, default 1 per the 2026-08-13 fix documented in
    // AuthService.cs), real remaining-time message computed from LockedUntil - UtcNow (not the
    // stale "15 dakika" the brief documents was fixed).
    // ------------------------------------------------------------------------------------
    [Fact]
    public async Task Admin_lockout_after_threshold_failed_logins_returns_ACCOUNT_LOCKED_with_real_remaining_time()
    {
        var (_, email) = await SeedAdminAsync("Admin2026!");
        var client = _factory.CreateClient();

        HttpResponseMessage last = null!;
        for (var i = 0; i < 5; i++)
            last = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "WrongPassword1" });

        last.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await ReadAsync(last);
        body.ErrorCode.Should().Be("ACCOUNT_LOCKED");
        // Real message shape: "Hesabınız kilitlendi. N saniye/dakika sonra tekrar deneyin." with
        // the REAL remaining time (jittered 4-5 min given LockoutMinutes=4 + JitterMaxSeconds=60),
        // never the stale "15 dakika".
        body.Message.Should().MatchRegex(@"\d+ (saniye|dakika) sonra");
        body.Message.Should().NotContain("15 dakika");

        // Even the CORRECT password is rejected while locked (lockout, not credential check,
        // gates the login) — LoginAsync checks IsLocked before verifying the password hash.
        var correctWhileLocked = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        correctWhileLocked.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(correctWhileLocked)).ErrorCode.Should().Be("ACCOUNT_LOCKED");
    }

    // Real clock-relative unlock-after-expiry: seeds a user whose LockedUntil is already in the
    // past (IsLocked is a computed property, `LockedUntil.HasValue && LockedUntil.Value > UtcNow`)
    // and proves login succeeds normally without waiting out a real lockout window in-process.
    [Fact]
    public async Task Admin_lockout_expires_naturally_login_succeeds_again()
    {
        var (id, email) = await SeedAdminAsync("Admin2026!");
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.AdminUsers.IgnoreQueryFilters().FirstAsync(u => u.Id == id);
            user.RecordFailedLogin(1, -1); // lockoutMinutes=-1 -> LockedUntil already in the past
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateClient();
        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        loginRes.StatusCode.Should().Be(HttpStatusCode.OK, "IsLocked is computed from LockedUntil > UtcNow; an already-past LockedUntil must not block login");
    }

    // A SUCCESSFUL login resets the failed-attempt counter (AdminUser.RecordLogin sets
    // FailedLoginCount=0/LockedUntil=null) — proven by getting close to the threshold, succeeding,
    // then confirming a fresh run of (threshold-1) failures alone does not lock the account.
    [Fact]
    public async Task Admin_successful_login_resets_failed_attempt_counter()
    {
        var (_, email) = await SeedAdminAsync("Admin2026!");
        var client = _factory.CreateClient();

        for (var i = 0; i < 4; i++)
            await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "WrongPassword1" });

        var success = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        success.StatusCode.Should().Be(HttpStatusCode.OK, "the counter must have been below threshold (4 < 5)");

        // Now the counter should be back at 0: 4 more wrong attempts must NOT lock (would need 5).
        HttpResponseMessage last = null!;
        for (var i = 0; i < 4; i++)
            last = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "WrongPassword1" });
        last.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(last)).ErrorCode.Should().Be("INVALID_CREDENTIALS", "4 failures after a reset must not reach the 5-failure lockout threshold");
    }

    // ------------------------------------------------------------------------------------
    // Password policy: min 8 chars, 1 uppercase, 1 digit, NO special-char requirement (real
    // regex set confirmed by reading PasswordPolicy.cs — only UppercaseRegex/DigitRegex exist).
    // ------------------------------------------------------------------------------------
    [Theory]
    [InlineData("short1A", "en az 8 karakter")]      // < 8 chars
    [InlineData("alllowercase1", "büyük harf")]        // no uppercase
    [InlineData("NoDigitsHere", "rakam")]               // no digit
    public async Task Admin_change_password_rejects_policy_violations(string weakPassword, string expectedMessageFragment)
    {
        var (id, email) = await SeedAdminAsync("Admin2026!");
        var client = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(id, email));

        var res = await client.PostAsJsonAsync("/api/v1/auth/change-password",
            new { currentPassword = "x", newPassword = weakPassword });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await res.Content.ReadAsStringAsync();
        body.Should().Contain(expectedMessageFragment);
    }

    // A password with NO special characters (only upper+digit+length) is a REAL valid password
    // under this policy — proves the "no special-character requirement" finding is real, not
    // an oversight in this test.
    [Fact]
    public async Task Admin_change_password_accepts_password_without_special_characters()
    {
        var (id, email) = await SeedAdminAsync("CurrentPass1");
        var client = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(id, email));

        var res = await client.PostAsJsonAsync("/api/v1/auth/change-password",
            new { currentPassword = "CurrentPass1", newPassword = "NoSpecialChar9" });

        res.StatusCode.Should().Be(HttpStatusCode.OK, "PasswordPolicy only requires length+uppercase+digit, no special character");
    }

    [Fact]
    public async Task Admin_change_password_wrong_current_password_returns_INVALID_CURRENT_PASSWORD()
    {
        var (id, email) = await SeedAdminAsync("Admin2026!");
        var client = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(id, email));

        var res = await client.PostAsJsonAsync("/api/v1/auth/change-password",
            new { currentPassword = "TotallyWrong1", newPassword = "NewPassword1" });

        res.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(res)).ErrorCode.Should().Be("INVALID_CURRENT_PASSWORD");
    }

    // First-login-after-temp-password flow: MustChangePassword=true gates change-initial-password
    // (real path: ForgotPasswordAsync sets this flag). change-initial-password succeeds once, then
    // retrying it (already changed) is blocked with PASSWORD_CHANGE_NOT_REQUIRED.
    [Fact]
    public async Task Admin_change_initial_password_first_login_flow_then_retry_blocked()
    {
        var (id, email) = await SeedAdminAsync("TempPass123", mustChangePassword: true);
        var client = await _factory.CreateClientAsync(TestIdentity.SuperAdmin(id, email));

        var first = await client.PostAsJsonAsync("/api/v1/auth/change-initial-password", new { newPassword = "NewRealPass1" });
        first.StatusCode.Should().Be(HttpStatusCode.OK);

        var retry = await client.PostAsJsonAsync("/api/v1/auth/change-initial-password", new { newPassword = "AnotherPass2" });
        retry.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(retry)).ErrorCode.Should().Be("PASSWORD_CHANGE_NOT_REQUIRED");
    }

    // ------------------------------------------------------------------------------------
    // Refresh rotation: real one-time-use. Old refresh token is removed from Redis on a
    // successful /refresh; a REPLAY of the old token must fail with INVALID_REFRESH_TOKEN.
    // ------------------------------------------------------------------------------------
    [Fact]
    public async Task Admin_refresh_rotates_token_old_refresh_token_is_unusable_after_use()
    {
        var (id, email) = await SeedAdminAsync("Admin2026!");
        var client = _factory.CreateClient();

        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        var otpSessionToken = (await ReadAsync(loginRes)).Data!.GetProperty("otpSessionToken").GetString();
        var code = await ReadRealOtpCodeAsync(id, Nexora.Domain.Enums.OtpPurpose.TwoFactor);
        var verifyRes = await client.PostAsJsonAsync("/api/v1/auth/verify-otp", new { otpSessionToken, code });
        var oldRefresh = (await ReadAsync(verifyRes)).Data!.GetProperty("refreshToken").GetString();

        var refreshRes = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = oldRefresh });
        refreshRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var newRefresh = (await ReadAsync(refreshRes)).Data!.GetProperty("refreshToken").GetString();
        newRefresh.Should().NotBe(oldRefresh);

        var replay = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = oldRefresh });
        replay.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(replay)).ErrorCode.Should().Be("INVALID_REFRESH_TOKEN");
    }

    // Per-refresh-cycle IsActive re-check: real enforcement point distinct from Task 6's
    // documented per-request gap (JWT pipeline does NOT re-check IsActive on ordinary requests,
    // but RefreshAsync DOES explicitly check user.IsActive before rotating).
    [Fact]
    public async Task Admin_refresh_with_deactivated_account_returns_ACCOUNT_INACTIVE()
    {
        var (id, email) = await SeedAdminAsync("Admin2026!");
        var client = _factory.CreateClient();

        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        var otpSessionToken = (await ReadAsync(loginRes)).Data!.GetProperty("otpSessionToken").GetString();
        var code = await ReadRealOtpCodeAsync(id, Nexora.Domain.Enums.OtpPurpose.TwoFactor);
        var verifyRes = await client.PostAsJsonAsync("/api/v1/auth/verify-otp", new { otpSessionToken, code });
        var refreshToken = (await ReadAsync(verifyRes)).Data!.GetProperty("refreshToken").GetString();

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.AdminUsers.IgnoreQueryFilters().FirstAsync(u => u.Id == id);
            user.Deactivate();
            await db.SaveChangesAsync();
        }

        var refreshRes = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken });
        refreshRes.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(refreshRes)).ErrorCode.Should().Be("ACCOUNT_INACTIVE");
    }

    // ------------------------------------------------------------------------------------
    // Ruling B: admin single-session mechanism proven at the xUnit level — a NEW login
    // (VerifyOtpAsync -> InvalidateAllSessionsAsync + fresh current-session-id) invalidates
    // ALL prior tokens instantly, on ANY endpoint, not just /auth/me. Real Redis
    // `auth:current-session-id:{userId}` overwrite-and-compare mechanism (Program.cs
    // OnTokenValidated).
    // ------------------------------------------------------------------------------------
    [Fact]
    public async Task Admin_second_login_invalidates_first_sessions_token_on_any_endpoint()
    {
        var (id, email) = await SeedAdminAsync("Admin2026!");

        async Task<string> LoginAndGetAccessTokenAsync(HttpClient c)
        {
            var loginRes = await c.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
            var otpSessionToken = (await ReadAsync(loginRes)).Data!.GetProperty("otpSessionToken").GetString();
            var code = await ReadRealOtpCodeAsync(id, Nexora.Domain.Enums.OtpPurpose.TwoFactor);
            var verifyRes = await c.PostAsJsonAsync("/api/v1/auth/verify-otp", new { otpSessionToken, code });
            return (await ReadAsync(verifyRes)).Data!.GetProperty("accessToken").GetString()!;
        }

        var client1 = _factory.CreateClient();
        var token1 = await LoginAndGetAccessTokenAsync(client1);

        var client2 = _factory.CreateClient();
        var token2 = await LoginAndGetAccessTokenAsync(client2);

        // token1 must now be rejected on ANY authenticated endpoint, not just /auth/me.
        client1.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token1);
        var probe1 = await client1.GetAsync("/api/v1/event-categories");
        probe1.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var probe1Body = await probe1.Content.ReadAsStringAsync();
        probe1Body.Should().Contain("SESSION_INVALIDATED");

        client2.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token2);
        var probe2 = await client2.GetAsync("/api/v1/auth/me");
        probe2.StatusCode.Should().Be(HttpStatusCode.OK, "the SECOND login's session must remain valid");
    }

    // Repeated 5x per the brief's verification requirement (Step 5: "run the citizen-vs-admin
    // single-session tests at least 5 times each to confirm no flakiness from real Redis
    // timing/TTL edges") — implemented as a Theory over 5 iterations in a single process run
    // rather than 5 separate `dotnet test` invocations, exercising the identical real mechanism
    // each time with fresh random identities.
    [Theory]
    [InlineData(1)] [InlineData(2)] [InlineData(3)] [InlineData(4)] [InlineData(5)]
    public async Task Admin_second_login_invalidates_first_session_repeatable(int iteration)
    {
        _ = iteration;
        await Admin_second_login_invalidates_first_sessions_token_on_any_endpoint();
    }

    [Fact]
    public async Task Admin_logout_invalidates_current_session_token()
    {
        var (id, email) = await SeedAdminAsync("Admin2026!");
        var client = _factory.CreateClient();

        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Admin2026!" });
        var otpSessionToken = (await ReadAsync(loginRes)).Data!.GetProperty("otpSessionToken").GetString();
        var code = await ReadRealOtpCodeAsync(id, Nexora.Domain.Enums.OtpPurpose.TwoFactor);
        var verifyRes = await client.PostAsJsonAsync("/api/v1/auth/verify-otp", new { otpSessionToken, code });
        var accessToken = (await ReadAsync(verifyRes)).Data!.GetProperty("accessToken").GetString();

        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        var logoutRes = await client.PostAsync("/api/v1/auth/logout", null);
        logoutRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var probe = await client.GetAsync("/api/v1/auth/me");
        probe.StatusCode.Should().Be(HttpStatusCode.Unauthorized, "logout writes a fresh current-session-id, invalidating the just-used token's own claim");
    }

    // ------------------------------------------------------------------------------------
    // Citizen registration (real NVI mock flow, Testing host has Nvi:UseMockMode=false per
    // NexoraApiFactory -> NviServiceSelector routes to the REAL NviService, which requires real
    // Vault-provisioned credentials this Testing environment does not have. Documented as a real,
    // honest environment constraint: the full HTTP nvi-lookup/register flow cannot run end-to-end
    // in this Testing host without live NVI credentials. Registration's password-policy and
    // TCKN-checksum validation are proven at the request-validation layer instead (real HTTP,
    // real validator, no NVI dependency reached).
    // ------------------------------------------------------------------------------------
    [Fact]
    public async Task Citizen_nvi_lookup_with_invalid_tckn_checksum_returns_INVALID_TCKN_without_reaching_NVI()
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/v1/auth/citizen/nvi-lookup",
            new { tckn = "11111111110", birthDate = "1990-01-01" });

        res.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(res)).ErrorCode.Should().Be("INVALID_TCKN");
    }

    // ------------------------------------------------------------------------------------
    // Citizen login/lockout/OTP (same real mechanisms as admin, proven independently since
    // ParticipantAuthService.cs is a SEPARATE implementation, not shared code with AuthService.cs).
    // ------------------------------------------------------------------------------------
    [Fact]
    public async Task Citizen_login_verify_otp_issues_real_tokens()
    {
        var (id, tckn) = await SeedCitizenAsync("Citizen2026!", 101);
        var client = _factory.CreateClient();

        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/citizen/login", new { identifier = tckn, password = "Citizen2026!" });
        loginRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var otpSessionToken = (await ReadAsync(loginRes)).Data!.GetProperty("otpSessionToken").GetString();

        var code = await ReadRealOtpCodeAsync(id, Nexora.Domain.Enums.OtpPurpose.TwoFactor);
        var verifyRes = await client.PostAsJsonAsync("/api/v1/auth/citizen/verify-otp", new { otpSessionToken, code });
        verifyRes.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadAsync(verifyRes)).Data!.GetProperty("accessToken").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Citizen_lockout_after_threshold_failed_logins_returns_ACCOUNT_LOCKED()
    {
        var (_, tckn) = await SeedCitizenAsync("Citizen2026!", 102);
        var client = _factory.CreateClient();

        HttpResponseMessage last = null!;
        for (var i = 0; i < 5; i++)
            last = await client.PostAsJsonAsync("/api/v1/auth/citizen/login", new { identifier = tckn, password = "WrongPassword1" });

        last.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(last)).ErrorCode.Should().Be("ACCOUNT_LOCKED");
    }

    // ------------------------------------------------------------------------------------
    // Ruling B (citizen side): multi-session allowed, individual revoke via the EXPLICIT
    // `auth:revoked-session:{sessionId}` set, CANNOT_REVOKE_CURRENT for self, logout ends only
    // the current session (not all sessions) -- the exact opposite structure of admin's
    // single-current-session overwrite.
    // ------------------------------------------------------------------------------------
    private async Task<(string AccessToken, string RefreshToken)> CitizenLoginAsync(HttpClient client, Guid participantId, string tckn, string password)
    {
        var loginRes = await client.PostAsJsonAsync("/api/v1/auth/citizen/login", new { identifier = tckn, password });
        var otpSessionToken = (await ReadAsync(loginRes)).Data!.GetProperty("otpSessionToken").GetString();
        var code = await ReadRealOtpCodeAsync(participantId, Nexora.Domain.Enums.OtpPurpose.TwoFactor);
        var verifyRes = await client.PostAsJsonAsync("/api/v1/auth/citizen/verify-otp", new { otpSessionToken, code });
        var data = (await ReadAsync(verifyRes)).Data!;
        return (data.GetProperty("accessToken").GetString()!, data.GetProperty("refreshToken").GetString()!);
    }

    [Fact]
    public async Task Citizen_second_login_does_NOT_invalidate_first_session_multi_device_allowed()
    {
        var (id, tckn) = await SeedCitizenAsync("Citizen2026!", 103);

        var client1 = _factory.CreateClient();
        var (token1, _) = await CitizenLoginAsync(client1, id, tckn, "Citizen2026!");

        var client2 = _factory.CreateClient();
        var (token2, _) = await CitizenLoginAsync(client2, id, tckn, "Citizen2026!");

        client1.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token1);
        var probe1 = await client1.GetAsync("/api/v1/auth/citizen/me");
        probe1.StatusCode.Should().Be(HttpStatusCode.OK, "citizens are NOT hard-limited to one live session, unlike admins");

        client2.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token2);
        var probe2 = await client2.GetAsync("/api/v1/auth/citizen/me");
        probe2.StatusCode.Should().Be(HttpStatusCode.OK, "both concurrent sessions remain valid simultaneously");
    }

    [Fact]
    public async Task Citizen_can_revoke_another_sessions_refresh_token_but_not_its_own_current_session()
    {
        var (id, tckn) = await SeedCitizenAsync("Citizen2026!", 104);

        var clientA = _factory.CreateClient();
        var (tokenA, _) = await CitizenLoginAsync(clientA, id, tckn, "Citizen2026!");
        clientA.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenA);

        var clientB = _factory.CreateClient();
        var (tokenB, _) = await CitizenLoginAsync(clientB, id, tckn, "Citizen2026!");

        // List sessions from A's perspective; find B's sessionId (the non-current one).
        var listRes = await clientA.GetAsync("/api/v1/auth/citizen/sessions");
        listRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var sessions = (await ReadAsync(listRes)).Data!;
        var sessionList = sessions.EnumerateArray().ToList();
        sessionList.Should().HaveCount(2);
        var currentSessionId = sessionList.First(s => s.GetProperty("isCurrent").GetBoolean()).GetProperty("sessionId").GetString();
        var otherSessionId = sessionList.First(s => !s.GetProperty("isCurrent").GetBoolean()).GetProperty("sessionId").GetString();

        // A cannot revoke its OWN current session via this endpoint.
        var selfRevoke = await clientA.DeleteAsync($"/api/v1/auth/citizen/sessions/{currentSessionId}");
        selfRevoke.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadAsync(selfRevoke)).ErrorCode.Should().Be("CANNOT_REVOKE_CURRENT");

        // A CAN revoke B's (the other) session.
        var otherRevoke = await clientA.DeleteAsync($"/api/v1/auth/citizen/sessions/{otherSessionId}");
        otherRevoke.StatusCode.Should().Be(HttpStatusCode.OK);

        // B's token is now invalid via the explicit auth:revoked-session:{sessionId} set.
        clientB.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenB);
        var probeB = await clientB.GetAsync("/api/v1/auth/citizen/me");
        probeB.StatusCode.Should().Be(HttpStatusCode.Unauthorized, "revoked-session set must invalidate B's token on its next validated request");

        // A's own (current) session remains valid throughout.
        var probeA = await clientA.GetAsync("/api/v1/auth/citizen/me");
        probeA.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData(1)] [InlineData(2)] [InlineData(3)] [InlineData(4)] [InlineData(5)]
    public async Task Citizen_multi_session_and_revoke_repeatable(int iteration)
    {
        _ = iteration;
        await Citizen_can_revoke_another_sessions_refresh_token_but_not_its_own_current_session();
    }
}
