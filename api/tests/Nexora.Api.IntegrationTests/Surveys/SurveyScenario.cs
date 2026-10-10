using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Nexora.Api.IntegrationTests.Infrastructure;

namespace Nexora.Api.IntegrationTests.Surveys;

// Task 10: shared helpers to create real Surveys + field tasks over the real public admin HTTP
// API (matching Task 7/8/9's FacilityScenario/EventScenario/LibraryScenario pattern: no direct
// DbContext seeding for domain state), used by SurveyResponseMatrixTests.cs and
// SurveyQuotaConcurrencyTests.cs.
internal static class SurveyScenario
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record Envelope<T>(bool Success, int StatusCode, T Data);
    private sealed record IdOnly(Guid Id);

    public sealed record QuestionSpec(
        string Type,
        string Question,
        bool Required = false,
        List<string>? Options = null);

    public sealed record CreateSurveyOptions
    {
        public string Tag { get; init; } = "T10";
        public bool IsActive { get; init; } = true;
        public bool IsAnonymous { get; init; }
        public bool AllowMultipleResponses { get; init; }
        public bool FieldEnabled { get; init; } = true;
        public bool RequireLocation { get; init; }
        public DateTime? StartDate { get; init; }
        public DateTime? EndDate { get; init; }
        public List<QuestionSpec>? Questions { get; init; }
    }

    public static async Task<Guid> CreateSurveyAsync(HttpClient admin, CreateSurveyOptions o)
    {
        var questions = o.Questions ?? new List<QuestionSpec>
        {
            new("multiple_choice", "Mahallenizde en önemli sorun nedir?", true, new List<string> { "Temizlik", "Ulaşım", "Güvenlik" }),
            new("text", "Ek görüşleriniz", false, new List<string>()),
        };

        var payload = new
        {
            title = $"{o.Tag} Anketi",
            description = "task10 integration test survey",
            category = "Belediye Hizmetleri",
            targetAudience = "all",
            startDate = o.StartDate,
            endDate = o.EndDate,
            estimatedDuration = 5,
            isActive = o.IsActive,
            isAnonymous = o.IsAnonymous,
            allowMultipleResponses = o.AllowMultipleResponses,
            showResults = false,
            autoSendAfterEvent = false,
            sendReminderSMS = false,
            sourceType = (string?)null,
            sourceId = (Guid?)null,
            isRequired = false,
            questions = questions.Select(q => new
            {
                type = q.Type,
                question = q.Question,
                description = (string?)null,
                required = q.Required,
                options = q.Options ?? new List<string>(),
                config = (object?)null,
            }),
            surveyType = "satisfaction",
            identityMode = "open",
            topic = "Genel",
            targetNeighborhoods = (List<string>?)null,
            targetResponseCount = 0,
            fieldEnabled = o.FieldEnabled,
            requireLocation = o.RequireLocation,
        };

        var response = await admin.PostAsJsonAsync("/api/v1/surveys", payload);
        var body = await response.Content.ReadAsStringAsync();
        response.StatusCode.Should().Be(HttpStatusCode.Created, $"survey create must succeed; body: {body}");
        var parsed = JsonSerializer.Deserialize<Envelope<IdOnly>>(body, Web);
        return parsed!.Data.Id;
    }

    public sealed record CreateFieldTaskOptions
    {
        public Guid SurveyId { get; init; }
        public Guid InterviewerId { get; init; }
        public string InterviewerType { get; init; } = "participant";
        public string Neighborhood { get; init; } = "Cebeci";
        public DateTime? StartDate { get; init; }
        public DateTime? EndDate { get; init; }
        public int TargetCount { get; init; }
        public int DailyTarget { get; init; }
        public string? Status { get; init; } = "assigned";
    }

    public static async Task<Guid> CreateFieldTaskAsync(HttpClient admin, CreateFieldTaskOptions o)
    {
        var start = o.StartDate ?? DateTime.UtcNow.AddDays(-1);
        var end = o.EndDate ?? DateTime.UtcNow.AddDays(3);
        var payload = new
        {
            surveyId = o.SurveyId,
            interviewerId = o.InterviewerId,
            interviewerType = o.InterviewerType,
            neighborhood = o.Neighborhood,
            startDate = start,
            endDate = end,
            targetCount = o.TargetCount,
            dailyTarget = o.DailyTarget,
            note = (string?)null,
            status = o.Status,
        };

        var response = await admin.PostAsJsonAsync("/api/v1/surveys/field-tasks", payload);
        var body = await response.Content.ReadAsStringAsync();
        response.StatusCode.Should().Be(HttpStatusCode.Created, $"field-task create must succeed; body: {body}");
        var parsed = JsonSerializer.Deserialize<Envelope<IdOnly>>(body, Web);
        return parsed!.Data.Id;
    }

    /// <summary>
    /// CreateSurveyRequestValidator forbids a past StartDate outright, so a survey whose response
    /// window is already CLOSED (SURVEY_EXPIRED case) cannot be created directly with past dates —
    /// UpdateSurveyRequestValidator has no such restriction (only enforces End >= Start), matching
    /// the real admin UI's own "edit an existing survey's dates" flow. This creates with a
    /// currently-open (or unbounded) window first, then PUTs the real expired/not-yet-started
    /// window over it, exercising the real update path rather than bypassing validation.
    /// </summary>
    public static async Task SetSurveyWindowAsync(HttpClient admin, Guid surveyId, DateTime? startDate, DateTime? endDate, List<QuestionSpec>? questions = null)
    {
        var getRes = await admin.GetAsync($"/api/v1/surveys/{surveyId}");
        getRes.IsSuccessStatusCode.Should().BeTrue($"survey fetch before window update must succeed; body: {await getRes.Content.ReadAsStringAsync()}");
        using var doc = JsonDocument.Parse(await getRes.Content.ReadAsStringAsync());
        var s = doc.RootElement.GetProperty("data");

        var qResponse = await admin.GetAsync($"/api/v1/surveys/{surveyId}/questions");
        qResponse.IsSuccessStatusCode.Should().BeTrue();
        using var qDoc = JsonDocument.Parse(await qResponse.Content.ReadAsStringAsync());
        var existingQuestions = qDoc.RootElement.GetProperty("data").EnumerateArray().Select(q => new
        {
            type = q.GetProperty("type").GetString(),
            question = q.GetProperty("question").GetString(),
            description = (string?)null,
            required = q.GetProperty("required").GetBoolean(),
            options = q.GetProperty("options").EnumerateArray().Select(o => o.GetString()).ToList(),
            config = (object?)null,
        }).ToList();

        var payload = new
        {
            title = s.GetProperty("title").GetString(),
            description = s.GetProperty("description").GetString(),
            category = s.GetProperty("category").GetString(),
            targetAudience = s.GetProperty("targetAudience").GetString(),
            startDate,
            endDate,
            estimatedDuration = s.GetProperty("estimatedDuration").GetInt32(),
            isActive = s.GetProperty("isActive").GetBoolean(),
            isAnonymous = s.GetProperty("isAnonymous").GetBoolean(),
            allowMultipleResponses = s.GetProperty("allowMultipleResponses").GetBoolean(),
            showResults = s.GetProperty("showResults").GetBoolean(),
            autoSendAfterEvent = s.GetProperty("autoSendAfterEvent").GetBoolean(),
            sendReminderSMS = s.GetProperty("sendReminderSMS").GetBoolean(),
            sourceType = (string?)null,
            sourceId = (Guid?)null,
            isRequired = s.GetProperty("isRequired").GetBoolean(),
            questions = existingQuestions,
            surveyType = s.GetProperty("surveyType").GetString(),
            identityMode = s.GetProperty("identityMode").GetString(),
            topic = s.GetProperty("topic").GetString(),
            targetNeighborhoods = (List<string>?)null,
            targetResponseCount = s.GetProperty("targetResponseCount").GetInt32(),
            fieldEnabled = s.GetProperty("fieldEnabled").GetBoolean(),
            requireLocation = s.GetProperty("requireLocation").GetBoolean(),
        };

        var putRes = await admin.PutAsJsonAsync($"/api/v1/surveys/{surveyId}", payload);
        putRes.IsSuccessStatusCode.Should().BeTrue($"survey window update must succeed; body: {await putRes.Content.ReadAsStringAsync()}");
    }

    /// <summary>Anket ve tek anketörlü, hemen açık ("bugün penceresi") bir saha görevi tek çağrıda kurar.</summary>
    public static async Task<(Guid SurveyId, Guid FieldTaskId)> CreateSurveyWithFieldTaskAsync(
        HttpClient admin,
        Guid interviewerId,
        string tag,
        int targetCount = 0,
        int dailyTarget = 0,
        bool requireLocation = false,
        bool isAnonymous = false,
        bool allowMultipleResponses = false,
        DateTime? surveyStart = null,
        DateTime? surveyEnd = null,
        List<QuestionSpec>? questions = null)
    {
        var surveyId = await CreateSurveyAsync(admin, new CreateSurveyOptions
        {
            Tag = tag,
            IsAnonymous = isAnonymous,
            AllowMultipleResponses = allowMultipleResponses,
            RequireLocation = requireLocation,
            StartDate = surveyStart,
            EndDate = surveyEnd,
            Questions = questions,
        });

        var fieldTaskId = await CreateFieldTaskAsync(admin, new CreateFieldTaskOptions
        {
            SurveyId = surveyId,
            InterviewerId = interviewerId,
            TargetCount = targetCount,
            DailyTarget = dailyTarget,
        });

        return (surveyId, fieldTaskId);
    }
}
