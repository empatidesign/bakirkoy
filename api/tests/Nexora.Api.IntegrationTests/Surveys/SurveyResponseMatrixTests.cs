using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Surveys;

// Task 10: Survey field-response matrix. Exercises the real citizen-facing field submission
// surface (POST /api/v1/me/surveys/field/tasks/{id}/responses, ParticipantSurveyService.Field.cs
// SubmitFieldResponseAsync) over real HTTP + real PostgreSQL, per the plan's Global Constraints:
// no direct DbContext seeding for domain state, every mutating case is real HTTP.
//
// Runs against the Redis-ENABLED host (NexoraApiFactory.CreateForCollectionWithRedis), matching
// Task 8/9's discovered finding for this exact class of bug: ParticipantSurveyService constructor-
// injects ILoyaltyService (LoyaltyService), which constructor-injects IRedisService.
// Infrastructure only registers IRedisService when ConnectionStrings:Redis is non-empty — every
// call into SubmitFieldResponseAsync against the default Redis-disabled host throws a DI
// InvalidOperationException (masked as a 500) before the handler body ever runs.
//
// Real idempotency mechanism under test (ParticipantSurveyService.Field.cs lines ~150-165):
// FieldSurveySubmitRequest.LocalUuid — inside the transaction, AFTER the per-(survey,identity)
// pg_advisory_xact_lock is acquired but BEFORE any business-rule checks, if LocalUuid is
// non-empty the code queries for an existing SurveyResponse with the same LocalUuid+FieldTaskId;
// if found, the (otherwise empty) transaction is rolled back and the EXISTING response's
// id/timestamp/counts are returned unchanged, without re-running quota/duplicate checks.
[Collection(ApiCollection.Name)]
public sealed class SurveyResponseMatrixTests : IAsyncLifetime
{
    private NexoraApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = NexoraApiFactory.CreateForCollectionWithRedis();
        await _factory.InitializeAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    public SurveyResponseMatrixTests(ApiTestHost host) { }

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record Envelope<T>(bool Success, int StatusCode, string? Message, string? ErrorCode, T? Data);
    private sealed record FieldSubmitResult(Guid ResponseId, DateTime SubmittedAt, int CompletedCount, int TodayCount);
    private sealed record FieldResponseSummary(Guid Id, string TcknMasked, string? Neighborhood, string? AgeGroup, string? Gender, int? DurationSeconds, DateTime SubmittedAt);

    private async Task<HttpClient> AdminAsync() =>
        await _factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t10-{Guid.NewGuid():N}@nexora.local"));

    private async Task<(HttpClient Client, CitizenTestIdentity Identity)> InterviewerAsync(int seed)
    {
        var identity = CitizenTestIdentity.Adult(seed);
        var client = await _factory.CreateCitizenClientAsync(identity);
        return (client, identity);
    }

    private static object AnswerPayload(Guid questionId, string answer) => new { questionId, answer };

    private async Task<List<JsonElement>> GetQuestionsAsync(HttpClient interviewer, Guid taskId)
    {
        var res = await interviewer.GetAsync($"/api/v1/me/surveys/field/tasks/{taskId}");
        res.IsSuccessStatusCode.Should().BeTrue($"task detail fetch must succeed; body: {await res.Content.ReadAsStringAsync()}");
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var data = doc.RootElement.GetProperty("data");
        return data.GetProperty("questions").EnumerateArray().Select(e => e.Clone()).ToList();
    }

    // ---------- Idempotency (LocalUuid replay) ----------

    [Fact]
    public async Task Same_LocalUuid_submitted_twice_creates_exactly_one_response_and_returns_same_id()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 200001);
        var tag = $"T10IDEM{Guid.NewGuid():N}"[..14];
        var (_, taskId) = await SurveyScenario.CreateSurveyWithFieldTaskAsync(admin, identity.ParticipantId, tag);

        var questions = await GetQuestionsAsync(interviewer, taskId);
        var qId = questions[0].GetProperty("id").GetGuid();
        var localUuid = Guid.NewGuid().ToString();

        var payload = new
        {
            answers = new[] { AnswerPayload(qId, "Temizlik") },
            tckn = CitizenTestIdentity.GenerateValidTckn(300001),
            isAnonymousRespondent = false,
            localUuid,
        };

        var first = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        first.StatusCode.Should().Be(HttpStatusCode.Created, $"first submission must succeed; body: {await first.Content.ReadAsStringAsync()}");
        var firstBody = JsonSerializer.Deserialize<Envelope<FieldSubmitResult>>(await first.Content.ReadAsStringAsync(), Web);

        var second = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        second.StatusCode.Should().Be(HttpStatusCode.Created, $"replayed submission with the same LocalUuid must still return 201 (idempotent), not an error; body: {await second.Content.ReadAsStringAsync()}");
        var secondBody = JsonSerializer.Deserialize<Envelope<FieldSubmitResult>>(await second.Content.ReadAsStringAsync(), Web);

        secondBody!.Data!.ResponseId.Should().Be(firstBody!.Data!.ResponseId,
            "the same client submission ID (LocalUuid) must map to the exact same server-side response row");

        // Verify only one row exists via the real follow-up responses endpoint, not by trusting the HTTP status alone.
        var listRes = await interviewer.GetAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses?take=100");
        listRes.IsSuccessStatusCode.Should().BeTrue();
        var listBody = JsonSerializer.Deserialize<Envelope<List<FieldResponseSummary>>>(await listRes.Content.ReadAsStringAsync(), Web);
        listBody!.Data!.Should().HaveCount(1, "replaying the same LocalUuid must not create a second row");
    }

    [Fact]
    public async Task Idempotent_replay_returns_freshly_recomputed_counts_not_cached_from_first_call()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 200002);
        var tag = $"T10IDEMCNT{Guid.NewGuid():N}"[..14];
        var (_, taskId) = await SurveyScenario.CreateSurveyWithFieldTaskAsync(admin, identity.ParticipantId, tag);
        var questions = await GetQuestionsAsync(interviewer, taskId);
        var qId = questions[0].GetProperty("id").GetGuid();
        var localUuid = Guid.NewGuid().ToString();

        var payload = new
        {
            answers = new[] { AnswerPayload(qId, "Temizlik") },
            isAnonymousRespondent = true,
            localUuid,
        };

        var first = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        first.StatusCode.Should().Be(HttpStatusCode.Created, await first.Content.ReadAsStringAsync());
        var firstBody = JsonSerializer.Deserialize<Envelope<FieldSubmitResult>>(await first.Content.ReadAsStringAsync(), Web);
        firstBody!.Data!.CompletedCount.Should().Be(1);

        // Submit a second, DIFFERENT anonymous response for the same task (no shared LocalUuid) —
        // real total should now be 2 before we replay the original LocalUuid.
        var otherPayload = new
        {
            answers = new[] { AnswerPayload(qId, "Ulaşım") },
            isAnonymousRespondent = true,
            localUuid = Guid.NewGuid().ToString(),
        };
        var other = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", otherPayload);
        other.StatusCode.Should().Be(HttpStatusCode.Created, await other.Content.ReadAsStringAsync());

        var replay = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        replay.StatusCode.Should().Be(HttpStatusCode.Created, await replay.Content.ReadAsStringAsync());
        var replayBody = JsonSerializer.Deserialize<Envelope<FieldSubmitResult>>(await replay.Content.ReadAsStringAsync(), Web);

        replayBody!.Data!.ResponseId.Should().Be(firstBody.Data!.ResponseId, "replay must still resolve to the original row");
        replayBody.Data!.CompletedCount.Should().Be(2,
            "the idempotent-replay path recomputes CountTaskResponsesAsync fresh (line ~161) rather than caching the first call's count — it must reflect the second, unrelated submission that happened in between");
    }

    // ---------- Anonymous vs TCKN-identified respondents ----------

    [Fact]
    public async Task Anonymous_respondent_without_shared_LocalUuid_produces_two_distinct_rows_not_a_collision()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 200003);
        var tag = $"T10ANON{Guid.NewGuid():N}"[..14];
        var (_, taskId) = await SurveyScenario.CreateSurveyWithFieldTaskAsync(admin, identity.ParticipantId, tag, allowMultipleResponses: true);
        var questions = await GetQuestionsAsync(interviewer, taskId);
        var qId = questions[0].GetProperty("id").GetGuid();

        var payloadA = new { answers = new[] { AnswerPayload(qId, "Temizlik") }, isAnonymousRespondent = true, localUuid = Guid.NewGuid().ToString() };
        var payloadB = new { answers = new[] { AnswerPayload(qId, "Ulaşım") }, isAnonymousRespondent = true, localUuid = Guid.NewGuid().ToString() };

        var resA = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payloadA);
        var resB = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payloadB);
        resA.StatusCode.Should().Be(HttpStatusCode.Created, await resA.Content.ReadAsStringAsync());
        resB.StatusCode.Should().Be(HttpStatusCode.Created, await resB.Content.ReadAsStringAsync());

        var bodyA = JsonSerializer.Deserialize<Envelope<FieldSubmitResult>>(await resA.Content.ReadAsStringAsync(), Web);
        var bodyB = JsonSerializer.Deserialize<Envelope<FieldSubmitResult>>(await resB.Content.ReadAsStringAsync(), Web);
        bodyA!.Data!.ResponseId.Should().NotBe(bodyB!.Data!.ResponseId,
            "two anonymous submissions without a shared LocalUuid must be request-scoped distinct rows, not collide on a shared ANON identity");
    }

    [Fact]
    public async Task Tckn_identified_respondent_who_already_responded_is_rejected_when_multiple_responses_disallowed()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 200004);
        var tag = $"T10TCKN{Guid.NewGuid():N}"[..14];
        var (_, taskId) = await SurveyScenario.CreateSurveyWithFieldTaskAsync(admin, identity.ParticipantId, tag, allowMultipleResponses: false);
        var questions = await GetQuestionsAsync(interviewer, taskId);
        var qId = questions[0].GetProperty("id").GetGuid();
        var respondentTckn = CitizenTestIdentity.GenerateValidTckn(300010);

        var payload1 = new { answers = new[] { AnswerPayload(qId, "Temizlik") }, tckn = respondentTckn, localUuid = Guid.NewGuid().ToString() };
        var first = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload1);
        first.StatusCode.Should().Be(HttpStatusCode.Created, await first.Content.ReadAsStringAsync());

        // Same TCKN, DIFFERENT LocalUuid — a genuinely new submission attempt, not an idempotent replay.
        var payload2 = new { answers = new[] { AnswerPayload(qId, "Ulaşım") }, tckn = respondentTckn, localUuid = Guid.NewGuid().ToString() };
        var second = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload2);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict, await second.Content.ReadAsStringAsync());
        var body = JsonSerializer.Deserialize<Envelope<object>>(await second.Content.ReadAsStringAsync(), Web);
        body!.ErrorCode.Should().Be("ALREADY_RESPONDED");
    }

    // ---------- Required-answer validation ----------

    [Fact]
    public async Task Missing_required_answer_is_rejected_with_REQUIRED_ANSWERS_MISSING()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 200005);
        var tag = $"T10REQ{Guid.NewGuid():N}"[..14];
        var (_, taskId) = await SurveyScenario.CreateSurveyWithFieldTaskAsync(admin, identity.ParticipantId, tag, questions: new List<SurveyScenario.QuestionSpec>
        {
            new("multiple_choice", "Zorunlu soru", true, new List<string> { "A", "B" }),
        });

        var payload = new { answers = Array.Empty<object>(), isAnonymousRespondent = true, localUuid = Guid.NewGuid().ToString() };
        var response = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict, await response.Content.ReadAsStringAsync());
        var body = JsonSerializer.Deserialize<Envelope<object>>(await response.Content.ReadAsStringAsync(), Web);
        body!.ErrorCode.Should().Be("REQUIRED_ANSWERS_MISSING");
    }

    // ---------- Survey window expired / not started ----------

    [Fact]
    public async Task Submission_after_survey_end_date_is_rejected_with_SURVEY_EXPIRED()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 200006);
        var tag = $"T10EXP{Guid.NewGuid():N}"[..14];
        // CreateSurveyRequestValidator forbids a past StartDate outright, so the closed window
        // is applied via a real PUT update (UpdateSurveyRequestValidator has no such restriction,
        // matching the real admin UI's own "edit an existing survey's dates" flow) rather than
        // created directly with past dates. Field task window itself must remain open (task
        // StartDate/EndDate independent) so LoadOwnedTaskAsync doesn't reject earlier with
        // FIELD_TASK_WINDOW_CLOSED before reaching the SURVEY_EXPIRED check.
        var surveyId = await SurveyScenario.CreateSurveyAsync(admin, new SurveyScenario.CreateSurveyOptions { Tag = tag });
        await SurveyScenario.SetSurveyWindowAsync(admin, surveyId, DateTime.UtcNow.AddDays(-10), DateTime.UtcNow.AddDays(-1));
        var taskId = await SurveyScenario.CreateFieldTaskAsync(admin, new SurveyScenario.CreateFieldTaskOptions
        {
            SurveyId = surveyId,
            InterviewerId = identity.ParticipantId,
            StartDate = DateTime.UtcNow.AddDays(-1),
            EndDate = DateTime.UtcNow.AddDays(3),
        });
        var questions = await GetQuestionsAsync(interviewer, taskId);
        var qId = questions[0].GetProperty("id").GetGuid();

        var payload = new { answers = new[] { AnswerPayload(qId, "Temizlik") }, isAnonymousRespondent = true, localUuid = Guid.NewGuid().ToString() };
        var response = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict, await response.Content.ReadAsStringAsync());
        var body = JsonSerializer.Deserialize<Envelope<object>>(await response.Content.ReadAsStringAsync(), Web);
        body!.ErrorCode.Should().Be("SURVEY_EXPIRED");
    }

    [Fact]
    public async Task Submission_before_survey_start_date_is_rejected_with_SURVEY_NOT_STARTED()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 200007);
        var tag = $"T10NST{Guid.NewGuid():N}"[..14];
        var surveyId = await SurveyScenario.CreateSurveyAsync(admin, new SurveyScenario.CreateSurveyOptions
        {
            Tag = tag,
            StartDate = DateTime.UtcNow.AddDays(5),
            EndDate = DateTime.UtcNow.AddDays(10),
        });
        var taskId = await SurveyScenario.CreateFieldTaskAsync(admin, new SurveyScenario.CreateFieldTaskOptions
        {
            SurveyId = surveyId,
            InterviewerId = identity.ParticipantId,
            StartDate = DateTime.UtcNow.AddDays(-1),
            EndDate = DateTime.UtcNow.AddDays(10),
        });
        var questions = await GetQuestionsAsync(interviewer, taskId);
        var qId = questions[0].GetProperty("id").GetGuid();

        var payload = new { answers = new[] { AnswerPayload(qId, "Temizlik") }, isAnonymousRespondent = true, localUuid = Guid.NewGuid().ToString() };
        var response = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict, await response.Content.ReadAsStringAsync());
        var body = JsonSerializer.Deserialize<Envelope<object>>(await response.Content.ReadAsStringAsync(), Web);
        body!.ErrorCode.Should().Be("SURVEY_NOT_STARTED");
    }

    // ---------- Location-required enforcement ----------

    [Fact]
    public async Task Location_required_survey_without_coordinates_is_rejected_with_LOCATION_REQUIRED()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 200008);
        var tag = $"T10LOC{Guid.NewGuid():N}"[..14];
        var (_, taskId) = await SurveyScenario.CreateSurveyWithFieldTaskAsync(admin, identity.ParticipantId, tag, requireLocation: true);
        var questions = await GetQuestionsAsync(interviewer, taskId);
        var qId = questions[0].GetProperty("id").GetGuid();

        var payload = new { answers = new[] { AnswerPayload(qId, "Temizlik") }, isAnonymousRespondent = true, localUuid = Guid.NewGuid().ToString() };
        var response = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict, await response.Content.ReadAsStringAsync());
        var body = JsonSerializer.Deserialize<Envelope<object>>(await response.Content.ReadAsStringAsync(), Web);
        body!.ErrorCode.Should().Be("LOCATION_REQUIRED");
    }

    [Fact]
    public async Task Location_required_survey_with_coordinates_succeeds()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 200009);
        var tag = $"T10LOCOK{Guid.NewGuid():N}"[..14];
        var (_, taskId) = await SurveyScenario.CreateSurveyWithFieldTaskAsync(admin, identity.ParticipantId, tag, requireLocation: true);
        var questions = await GetQuestionsAsync(interviewer, taskId);
        var qId = questions[0].GetProperty("id").GetGuid();

        var payload = new
        {
            answers = new[] { AnswerPayload(qId, "Temizlik") },
            isAnonymousRespondent = true,
            localUuid = Guid.NewGuid().ToString(),
            latitude = 41.0512,
            longitude = 28.8656,
        };
        var response = await interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
    }
}
