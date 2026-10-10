namespace Nexora.Api.IntegrationTests.Infrastructure;

// Describes a real citizen (Participant) identity minted directly as a signed JWT for the hosted
// API, using the exact claim shape GenerateCitizenAccessToken produces (JwtService.cs) so the real
// RequireAuthorization("Citizen") policy and downstream ParticipantEventService/ParticipantTravelService
// code run unchanged. Task 8's brief Ruling D: this must exercise the real Citizen auth policy, not a
// repurposed admin token — the claim shape here is deliberately identical to production
// (ClaimTypes.NameIdentifier, ClaimTypes.Name, user_type=citizen, sessionId, must_change_password),
// only the *minting path* differs (direct EF seed of the Participant row instead of driving the real
// HTTP OTP flow), matching the exact same trade-off TestIdentity.SuperAdmin already makes for admins.
public sealed record CitizenTestIdentity(
    Guid ParticipantId,
    string Tckn,
    string FullName,
    DateTime BirthDate,
    Nexora.Domain.Enums.Gender Gender,
    string? Address = null,
    string? Email = null,
    string? Phone = null)
{
    // Deterministic-but-valid TCKN generator (real checksum algorithm, TcKimlikValidator-compatible)
    // so every test gets a unique, real-shape citizen without colliding on a fixed literal.
    public static string GenerateValidTckn(int seed)
    {
        // First digit must be 1-9. Derive 9 "free" digits from the seed, then compute the real
        // two check digits per TcKimlikValidator's algorithm so IsValid(...) returns true.
        var rnd = new Random(seed);
        var d = new int[11];
        d[0] = 1 + rnd.Next(9);
        for (var i = 1; i < 9; i++) d[i] = rnd.Next(10);

        var oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
        var evenSum = d[1] + d[3] + d[5] + d[7];
        var tenth = ((oddSum * 7) - evenSum) % 10;
        if (tenth < 0) tenth += 10;
        d[9] = tenth;
        d[10] = d.Take(10).Sum() % 10;

        return string.Concat(d);
    }

    public static CitizenTestIdentity Adult(int seed, string? fullName = null, Nexora.Domain.Enums.Gender gender = Nexora.Domain.Enums.Gender.Male, string? address = null) =>
        new(
            Guid.NewGuid(),
            GenerateValidTckn(seed),
            fullName ?? $"Test Vatandaş {seed}",
            new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            gender,
            address);

    public static CitizenTestIdentity Minor(int seed, string? fullName = null, Nexora.Domain.Enums.Gender gender = Nexora.Domain.Enums.Gender.Male, string? address = null) =>
        new(
            Guid.NewGuid(),
            GenerateValidTckn(seed),
            fullName ?? $"Test Çocuk {seed}",
            DateTime.UtcNow.AddYears(-10),
            gender,
            address);
}
