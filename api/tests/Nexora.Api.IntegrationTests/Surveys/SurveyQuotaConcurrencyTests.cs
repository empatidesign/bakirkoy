using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace Nexora.Api.IntegrationTests.Surveys;

// Task 10 (Ruling C): a REAL concurrent race against real Postgres. The real DB-level guarantee
// preventing a field task's TargetCount/DailyTarget from being exceeded is a Postgres
// session-level transaction advisory lock keyed per (surveyId, respondent-identity)
// (pg_advisory_xact_lock via IUnitOfWork.AcquireAdvisoryLockAsync,
// SurveyResponseLockKey(survey.Id, identity) — ParticipantSurveyService.Field.cs line ~151),
// which serializes concurrent SubmitFieldResponseAsync calls for the SAME (survey, identity) pair
// so the count-then-insert TargetCount/DailyTarget decision can never race for that pair.
//
// IMPORTANT REAL FINDING (task-10-brief.md, verified independently by reading
// ParticipantSurveyService.Field.cs / SurveyPlatformService.cs): dimension quotas (SurveyQuota —
// e.g. "max 50 responses from Cebeci neighborhood", neighborhood/age_group/gender) are NOT
// enforced anywhere at submission time. Neither SubmitAsync nor SubmitFieldResponseAsync ever
// reads db.SurveyQuotas; the only real capacity enforcement at submit time is the field TASK's
// own aggregate TargetCount/DailyTarget. This is reported in task-10-report.md per the plan's
// required finding format, not silently patched here (report-only, matching Tasks 5-9's handling
// of comparable out-of-scope findings).
[Collection(ApiCollection.Name)]
public sealed class SurveyQuotaConcurrencyTests : IAsyncLifetime
{
    private NexoraApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        _factory = NexoraApiFactory.CreateForCollectionWithRedis();
        await _factory.InitializeAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    public SurveyQuotaConcurrencyTests(ApiTestHost host) { }

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record Envelope<T>(bool Success, int StatusCode, string? Message, string? ErrorCode, T? Data);
    private sealed record FieldSubmitResult(Guid ResponseId, DateTime SubmittedAt, int CompletedCount, int TodayCount);
    private sealed record FieldResponseSummary(Guid Id, string TcknMasked, string? Neighborhood, string? AgeGroup, string? Gender, int? DurationSeconds, DateTime SubmittedAt);

    private async Task<HttpClient> AdminAsync() =>
        await _factory.CreateClientAsync(TestIdentity.SuperAdmin(Guid.NewGuid(), $"t10q-{Guid.NewGuid():N}@nexora.local"));

    private async Task<(HttpClient Client, CitizenTestIdentity Identity)> InterviewerAsync(int seed)
    {
        var identity = CitizenTestIdentity.Adult(seed);
        var client = await _factory.CreateCitizenClientAsync(identity);
        return (client, identity);
    }

    private async Task<Guid> QuestionIdAsync(HttpClient interviewer, Guid taskId)
    {
        var res = await interviewer.GetAsync($"/api/v1/me/surveys/field/tasks/{taskId}");
        res.IsSuccessStatusCode.Should().BeTrue();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("data").GetProperty("questions")[0].GetProperty("id").GetGuid();
    }

    /// <summary>
    /// Real concurrent race: TargetCount=1 field task, two DIFFERENT anonymous respondents
    /// (different LocalUuids, so this is NOT the idempotency case) both POST via Task.WhenAll —
    /// exactly one must succeed (201) and the other must get a real 409 FIELD_TASK_TARGET_REACHED,
    /// verified by a follow-up count query, not by trusting the HTTP status alone.
    /// </summary>
    [Fact]
    public async Task Concurrent_submissions_against_TargetCount_1_grant_exactly_one_success()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 210001);
        var tag = $"T10QRACE{Guid.NewGuid():N}"[..14];
        var (_, taskId) = await SurveyScenario.CreateSurveyWithFieldTaskAsync(
            admin, identity.ParticipantId, tag, targetCount: 1, allowMultipleResponses: true);
        var qId = await QuestionIdAsync(interviewer, taskId);

        var payloadA = new { answers = new[] { new { questionId = qId, answer = "Temizlik" } }, isAnonymousRespondent = true, localUuid = Guid.NewGuid().ToString() };
        var payloadB = new { answers = new[] { new { questionId = qId, answer = "Ulaşım" } }, isAnonymousRespondent = true, localUuid = Guid.NewGuid().ToString() };

        var taskA = interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payloadA);
        var taskB = interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payloadB);
        var responses = await Task.WhenAll(taskA, taskB);

        var statusCodes = responses.Select(r => r.StatusCode).ToList();
        statusCodes.Count(s => s == HttpStatusCode.Created).Should().Be(1,
            "exactly one of the two real concurrent field submissions must win the TargetCount=1 slot");
        statusCodes.Count(s => s == HttpStatusCode.Conflict).Should().Be(1,
            "the other concurrent submission must be rejected with a real 409, not silently dropped or double-accepted");

        var conflictResponse = responses.First(r => r.StatusCode == HttpStatusCode.Conflict);
        var conflictBody = JsonSerializer.Deserialize<Envelope<object>>(await conflictResponse.Content.ReadAsStringAsync(), Web);
        conflictBody!.ErrorCode.Should().Be("FIELD_TASK_TARGET_REACHED");

        // Verify via a real follow-up count query, not by trusting the HTTP status alone.
        var listRes = await interviewer.GetAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses?take=100");
        var listBody = JsonSerializer.Deserialize<Envelope<List<FieldResponseSummary>>>(await listRes.Content.ReadAsStringAsync(), Web);
        listBody!.Data!.Should().HaveCount(1, "the advisory-lock-serialized TargetCount check must leave exactly one real row, never zero or two");
    }

    /// <summary>
    /// Real concurrent race for the SAME LocalUuid (idempotency under real concurrency, not just
    /// sequential replay): both calls must produce exactly one SurveyResponse row and both must
    /// return the same ResponseId — the pg_advisory_xact_lock serializes them so the second call
    /// observes the first's committed row via the LocalUuid lookup, it does not create a duplicate
    /// and does not get rejected as a target-reached conflict either.
    /// </summary>
    [Fact]
    public async Task Concurrent_submissions_with_the_SAME_LocalUuid_produce_exactly_one_row_both_calls_return_same_id()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 210002);
        var tag = $"T10QDUP{Guid.NewGuid():N}"[..14];
        var (_, taskId) = await SurveyScenario.CreateSurveyWithFieldTaskAsync(
            admin, identity.ParticipantId, tag, targetCount: 5, allowMultipleResponses: true);
        var qId = await QuestionIdAsync(interviewer, taskId);

        var localUuid = Guid.NewGuid().ToString();
        var payload = new { answers = new[] { new { questionId = qId, answer = "Temizlik" } }, isAnonymousRespondent = true, localUuid };

        var taskA = interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        var taskB = interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payload);
        var responses = await Task.WhenAll(taskA, taskB);

        responses.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.Created,
            "both concurrent calls with the same LocalUuid must succeed (one creates, one replays) — neither should be a hard conflict");

        var bodies = await Task.WhenAll(responses.Select(async r =>
            JsonSerializer.Deserialize<Envelope<FieldSubmitResult>>(await r.Content.ReadAsStringAsync(), Web)));

        bodies[0]!.Data!.ResponseId.Should().Be(bodies[1]!.Data!.ResponseId,
            "concurrent replays of the same LocalUuid must resolve to the same real response row");

        var listRes = await interviewer.GetAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses?take=100");
        var listBody = JsonSerializer.Deserialize<Envelope<List<FieldResponseSummary>>>(await listRes.Content.ReadAsStringAsync(), Web);
        listBody!.Data!.Should().HaveCount(1, "a real concurrent race on the same LocalUuid must never create two rows");
    }

    /// <summary>
    /// DailyTarget=1 (separate from TargetCount) real concurrent race — same mechanism, different
    /// counter (CountTaskResponsesAsync's "today" bucket).
    /// </summary>
    [Fact]
    public async Task Concurrent_submissions_against_DailyTarget_1_grant_exactly_one_success()
    {
        var admin = await AdminAsync();
        var (interviewer, identity) = await InterviewerAsync(seed: 210003);
        var tag = $"T10QDAILY{Guid.NewGuid():N}"[..14];
        var (_, taskId) = await SurveyScenario.CreateSurveyWithFieldTaskAsync(
            admin, identity.ParticipantId, tag, targetCount: 0, dailyTarget: 1, allowMultipleResponses: true);
        var qId = await QuestionIdAsync(interviewer, taskId);

        var payloadA = new { answers = new[] { new { questionId = qId, answer = "Temizlik" } }, isAnonymousRespondent = true, localUuid = Guid.NewGuid().ToString() };
        var payloadB = new { answers = new[] { new { questionId = qId, answer = "Ulaşım" } }, isAnonymousRespondent = true, localUuid = Guid.NewGuid().ToString() };

        var taskA = interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payloadA);
        var taskB = interviewer.PostAsJsonAsync($"/api/v1/me/surveys/field/tasks/{taskId}/responses", payloadB);
        var responses = await Task.WhenAll(taskA, taskB);

        var statusCodes = responses.Select(r => r.StatusCode).ToList();
        statusCodes.Count(s => s == HttpStatusCode.Created).Should().Be(1);
        statusCodes.Count(s => s == HttpStatusCode.Conflict).Should().Be(1);

        var conflictResponse = responses.First(r => r.StatusCode == HttpStatusCode.Conflict);
        var conflictBody = JsonSerializer.Deserialize<Envelope<object>>(await conflictResponse.Content.ReadAsStringAsync(), Web);
        conflictBody!.ErrorCode.Should().Be("FIELD_TASK_DAILY_TARGET_REACHED");
    }
}
