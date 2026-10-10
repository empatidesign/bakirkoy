using Microsoft.EntityFrameworkCore;
using Nexora.Application.Features.Surveys;
using Nexora.Application.Features.Surveys.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Surveys;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-09-01): saha görevlilerinin canlı harita takibi (GPS izi, yürünen
/// mesafe, gezilen noktalar) ve anketör performans/veri-kalitesi tablosu.
///
/// Kapsam kuralları mevcut saha ekranlarıyla birebir aynıdır: mahalle kapsamı
/// (GetNeighborhoodScopeAsync) ve "yalnızca kendi anketleri" kapsamı
/// (GetOwnSurveyIdsScopeAsync) burada da uygulanır — bir Anket Kullanıcısı kapsamı
/// dışındaki bir anketörün konumunu göremez.
/// </summary>
public partial class SurveyPlatformService
{
    /// <summary>Ayrık nokta ızgarası: ~0.0009° enlem ≈ 100 m.</summary>
    private const double LocationGridDegrees = 0.0009;

    /// <summary>5 dakikadan yeni ping = sahada aktif.</summary>
    private static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan IdleWindow = TimeSpan.FromMinutes(30);

    /// <summary>Ping'ler arası bu süreden uzun boşluk "mola/kopukluk" sayılır, mesafeye eklenmez.</summary>
    private static readonly TimeSpan TrailGapLimit = TimeSpan.FromMinutes(10);

    /// <summary>En az bu kadar aynı noktada kalınırsa "duraklama" olarak raporlanır.</summary>
    private const int StopMinMinutes = 10;

    /// <summary>Duraklama sayılması için nokta yarıçapı (metre).</summary>
    private const double StopRadiusMeters = 60;

    // ------------------------------------------------------------- canlı harita

    public async Task<List<SurveyFieldLiveAgentDto>> GetLiveAgentsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);

        var tasks = await ScopedFieldTasksAsync(p.SurveyId, ct);
        var interviewerIds = tasks.Select(t => t.InterviewerId).Distinct().ToList();
        if (interviewerIds.Count == 0) return [];

        var names = await ResolveInterviewerNamesAsync(tasks, ct);
        var phones = await db.Participants.AsNoTracking()
            .Where(x => interviewerIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Phone, ct);

        var todayStartUtc = TurkeyTime.TodayStartUtc();
        var pings = await db.SurveyFieldLocationPings.AsNoTracking()
            .Where(x => interviewerIds.Contains(x.InterviewerId) && x.RecordedAt >= todayStartUtc)
            .OrderBy(x => x.RecordedAt)
            .ToListAsync(ct);
        var pingsByAgent = pings.GroupBy(x => x.InterviewerId).ToDictionary(g => g.Key, g => g.ToList());

        var responses = await LoadResponsesAsync(p, ct);
        var responsesByAgent = responses.Where(r => r.InterviewerId.HasValue)
            .GroupBy(r => r.InterviewerId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var surveyTitles = await db.Surveys.AsNoTracking()
            .Where(s => !s.IsDeleted)
            .ToDictionaryAsync(s => s.Id, s => s.Title, ct);

        var now = DateTime.UtcNow;
        var todayTurkey = TurkeyTime.TodayDate().Date;

        return interviewerIds.Select(id =>
        {
            var myTasks = tasks.Where(t => t.InterviewerId == id).ToList();
            var activeTask = myTasks.FirstOrDefault(t => t.Status is "assigned" or "in_progress") ?? myTasks[0];
            var myPings = pingsByAgent.GetValueOrDefault(id) ?? [];
            var last = myPings.Count > 0 ? myPings[^1] : null;
            var myResponses = responsesByAgent.GetValueOrDefault(id) ?? [];
            var totalTarget = myTasks.Sum(t => t.TargetCount);
            var completed = myResponses.Count;

            var presence = last is null
                ? "offline"
                : now - last.RecordedAt <= OnlineWindow ? "online"
                : now - last.RecordedAt <= IdleWindow ? "idle"
                : "offline";

            return new SurveyFieldLiveAgentDto(
                id,
                names.GetValueOrDefault(id, "—"),
                phones.GetValueOrDefault(id),
                activeTask.Id,
                surveyTitles.GetValueOrDefault(activeTask.SurveyId),
                activeTask.Neighborhood ?? "Tüm Mahalleler",
                last?.Latitude,
                last?.Longitude,
                last?.AccuracyMeters,
                last?.RecordedAt,
                presence,
                Math.Round(myPings.Sum(x => x.DistanceFromPreviousMeters), 1),
                DistinctPointCount(myPings.Select(x => (x.Latitude, x.Longitude))),
                myResponses.Count(r => TurkeyTime.ToTurkey(r.SubmittedAt).Date == todayTurkey),
                completed,
                totalTarget,
                totalTarget > 0 ? Math.Round(100.0 * completed / totalTarget, 1) : 0);
        })
        .OrderBy(a => a.PresenceStatus switch { "online" => 0, "idle" => 1, _ => 2 })
        .ThenByDescending(a => a.TodayResponseCount)
        .ToList();
    }

    public async Task<SurveyFieldTrailDto> GetAgentTrailAsync(Guid interviewerId, DateTime? date, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);

        // Kapsam kontrolü: çağıran bu anketörü görebiliyor mu?
        var tasks = await ScopedFieldTasksAsync(null, ct);
        var myTasks = tasks.Where(t => t.InterviewerId == interviewerId).ToList();
        if (myTasks.Count == 0)
            throw new Nexora.Application.Common.Exceptions.NotFoundException("Anketör bulunamadı.", "INTERVIEWER_NOT_FOUND");

        var day = (date ?? TurkeyTime.TodayDate()).Date;
        var fromUtc = TurkeyTime.ToUtc(day);
        var toUtc = fromUtc.AddDays(1);

        var pings = await db.SurveyFieldLocationPings.AsNoTracking()
            .Where(x => x.InterviewerId == interviewerId && x.RecordedAt >= fromUtc && x.RecordedAt < toUtc)
            .OrderBy(x => x.RecordedAt)
            .ToListAsync(ct);

        var responses = await db.SurveyResponses.AsNoTracking()
            .Where(r => !r.IsDeleted && r.InterviewerId == interviewerId
                && r.SubmittedAt >= fromUtc && r.SubmittedAt < toUtc)
            .Select(r => new { r.Id, r.Latitude, r.Longitude, r.SubmittedAt, r.Neighborhood, r.DurationSeconds, r.AnswersJson, r.IsFlagged })
            .ToListAsync(ct);

        var meta = await LoadQuestionMetaAsync(ct);
        var responsePoints = responses
            .Where(r => r.Latitude.HasValue && r.Longitude.HasValue)
            .Select(r =>
            {
                var score = ScoreOf(r.AnswersJson, meta);
                return new SurveyFieldResponsePointDto(
                    r.Id, r.Latitude!.Value, r.Longitude!.Value, r.SubmittedAt, r.Neighborhood,
                    r.DurationSeconds, score.HasValue ? Math.Round(score.Value * 5, 2) : null, r.IsFlagged);
            })
            .OrderBy(x => x.SubmittedAt)
            .ToList();

        var names = await ResolveInterviewerNamesAsync(myTasks, ct);

        // Aktif süre: ping'ler arasındaki, mola sayılmayan (<= TrailGapLimit) aralıkların toplamı.
        var activeMinutes = 0.0;
        for (var i = 1; i < pings.Count; i++)
        {
            var gap = pings[i].RecordedAt - pings[i - 1].RecordedAt;
            if (gap <= TrailGapLimit) activeMinutes += gap.TotalMinutes;
        }

        return new SurveyFieldTrailDto(
            interviewerId,
            names.GetValueOrDefault(interviewerId, "—"),
            day,
            Math.Round(pings.Sum(x => x.DistanceFromPreviousMeters), 1),
            (int)Math.Round(activeMinutes),
            pings.Count > 0 ? pings[0].RecordedAt : null,
            pings.Count > 0 ? pings[^1].RecordedAt : null,
            pings.Select(x => new SurveyFieldTrailPointDto(
                x.Latitude, x.Longitude, x.RecordedAt, x.AccuracyMeters, Math.Round(x.DistanceFromPreviousMeters, 1))).ToList(),
            BuildStops(pings, responsePoints),
            responsePoints);
    }

    /// <summary>
    /// Ardışık ping'leri, StopRadiusMeters yarıçapında kalındığı sürece tek bir "duraklama"
    /// olarak birleştirir; StopMinMinutes altındakiler (yürüme geçişleri) elenir.
    /// </summary>
    private static List<SurveyFieldStopDto> BuildStops(
        List<SurveyFieldLocationPing> pings, List<SurveyFieldResponsePointDto> responsePoints)
    {
        var stops = new List<SurveyFieldStopDto>();
        var i = 0;
        while (i < pings.Count)
        {
            var anchor = pings[i];
            var j = i + 1;
            while (j < pings.Count
                && GeoDistance.HaversineMeters(anchor.Latitude, anchor.Longitude, pings[j].Latitude, pings[j].Longitude) <= StopRadiusMeters
                && pings[j].RecordedAt - pings[j - 1].RecordedAt <= TrailGapLimit)
                j++;

            var last = pings[j - 1];
            var minutes = (int)Math.Round((last.RecordedAt - anchor.RecordedAt).TotalMinutes);
            if (minutes >= StopMinMinutes)
            {
                var count = responsePoints.Count(r =>
                    r.SubmittedAt >= anchor.RecordedAt && r.SubmittedAt <= last.RecordedAt);
                stops.Add(new SurveyFieldStopDto(
                    anchor.Latitude, anchor.Longitude, anchor.RecordedAt, last.RecordedAt, minutes, count));
            }
            i = j > i ? j : i + 1;
        }
        return stops;
    }

    // ------------------------------------------------------- performans tablosu

    public async Task<SurveyInterviewerPerformanceResultDto> GetInterviewerPerformanceAsync(
        SurveyAnalyticsFilterParams p, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);

        var tasks = await ScopedFieldTasksAsync(p.SurveyId, ct);
        var responses = await LoadResponsesAsync(p, ct);
        var meta = await LoadQuestionMetaAsync(ct);

        var byInterviewer = responses.Where(r => r.InterviewerId.HasValue)
            .GroupBy(r => r.InterviewerId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var ids = tasks.Select(t => t.InterviewerId).Concat(byInterviewer.Keys).Distinct().ToList();
        if (ids.Count == 0)
            return new SurveyInterviewerPerformanceResultDto(
                new SurveyPerformanceBenchmarkDto(0, 0, 0, 0, 0, 0, 0, 0), []);

        // Görevi silinmiş ama yanıtı duran anketörlerin de adı çözülsün diye yanıtlardan
        // gelen kimlikler ek olarak verilir (bkz. ResolveInterviewerNamesAsync).
        var names = await ResolveInterviewerNamesAsync(tasks, ct, byInterviewer.Keys);
        var departments = await db.AdminUsers.AsNoTracking()
            .Where(a => ids.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.Department, ct);

        // Yanıt başına türetilmiş ölçüler (tek geçişte) — soru bazlı olumlu/olumsuz dökümü dahil.
        var analyzed = responses.ToDictionary(r => r.Id, r => AnalyzeResponse(r.AnswersJson, meta));

        // Saha geneli referans (benchmark) — bireysel sapma bunun üzerinden hesaplanır.
        var allScored = responses.Select(r => analyzed[r.Id]).Where(a => a.Score.HasValue).ToList();
        var fieldPositiveRate = SurveyPerformanceMath.Percent(
            allScored.Count(a => a.Score!.Value >= SurveyPerformanceMath.PositiveThreshold), allScored.Count);
        var fieldNegativeRate = SurveyPerformanceMath.Percent(
            allScored.Count(a => a.Score!.Value < SurveyPerformanceMath.NegativeThreshold), allScored.Count);
        var allDurations = responses.Where(r => r.DurationSeconds is > 0).Select(r => (double)r.DurationSeconds!.Value).ToList();
        var fieldMedianDuration = SurveyPerformanceMath.Median(allDurations);
        var fastThreshold = fieldMedianDuration * SurveyPerformanceMath.FastRatio;

        var pingTotals = await LoadDistanceByInterviewerAsync(ids, p, ct);

        var perInterviewerPositiveRates = new List<double>();
        var rows = new List<SurveyInterviewerPerformanceDto>();

        foreach (var id in ids)
        {
            var myTasks = tasks.Where(t => t.InterviewerId == id).ToList();
            var myResponses = byInterviewer.GetValueOrDefault(id) ?? [];
            var totalTarget = myTasks.Sum(t => t.TargetCount);
            var progress = totalTarget > 0 ? Math.Round(100.0 * myResponses.Count / totalTarget, 1) : 0;

            var myAnalyzed = myResponses.Select(r => analyzed[r.Id]).ToList();
            var scored = myAnalyzed.Where(a => a.Score.HasValue).ToList();
            var positive = scored.Count(a => a.Score!.Value >= SurveyPerformanceMath.PositiveThreshold);
            var negative = scored.Count(a => a.Score!.Value < SurveyPerformanceMath.NegativeThreshold);
            var neutral = scored.Count - positive - negative;

            var positiveRate = SurveyPerformanceMath.Percent(positive, scored.Count);
            var negativeRate = SurveyPerformanceMath.Percent(negative, scored.Count);
            // Standart sapma yalnızca gerçekten yanıt toplamış anketörler üzerinden hesaplanır;
            // aksi hâlde boş görevliler dağılımı yapay olarak genişletir.
            if (scored.Count > 0) perInterviewerPositiveRates.Add(positiveRate);

            var durations = myResponses.Where(r => r.DurationSeconds is > 0).Select(r => (double)r.DurationSeconds!.Value).ToList();
            var fastCount = fastThreshold > 0 ? durations.Count(d => d < fastThreshold) : 0;
            var fastRate = SurveyPerformanceMath.Percent(fastCount, durations.Count);
            var straightRate = SurveyPerformanceMath.Percent(myAnalyzed.Count(a => a.IsStraightLined), myAnalyzed.Count);

            var located = myResponses.Count(r => r.HasLocation);
            var gpsRate = SurveyPerformanceMath.Percent(located, myResponses.Count);
            var distinctLocations = DistinctPointCount(myResponses.Where(r => r.HasLocation).Select(r => (r.Latitude!.Value, r.Longitude!.Value)));

            var flagged = myResponses.Count(r => r.IsFlagged);
            var flaggedRate = SurveyPerformanceMath.Percent(flagged, myResponses.Count);

            var reliability = SurveyPerformanceMath.ReliabilityScore(
                fastRate, straightRate, gpsRate, flaggedRate, myResponses.Count, distinctLocations);
            // Doğrulama bulgusu (2026-09-01, UI): henüz hiç skorlanabilir yanıt toplamamış
            // anketörler için sapma "0 − saha ortalaması" olarak hesaplanıyor ve tabloda
            // yanıltıcı bir "−%84 sapma" görünüyordu. Veri yoksa sapma tanımsızdır → 0.
            var bias = scored.Count == 0 ? 0 : Math.Round(positiveRate - fieldPositiveRate, 1);
            var performance = SurveyPerformanceMath.PerformanceScore(progress, reliability, distinctLocations, bias);

            var avgDuration = durations.Count > 0 ? Math.Round(durations.Average(), 1) : 0;

            rows.Add(new SurveyInterviewerPerformanceDto(
                id,
                names.GetValueOrDefault(id, "—"),
                departments.GetValueOrDefault(id) ?? "Saha Görevlisi",
                myTasks.Count,
                totalTarget,
                myResponses.Count,
                myResponses.Count(r => TurkeyTime.ToTurkey(r.SubmittedAt).Date == TurkeyTime.TodayDate().Date),
                progress,
                scored.Count > 0 ? Math.Round(scored.Average(a => a.Score!.Value) * 5, 2) : 0,
                scored.Count,
                positiveRate,
                SurveyPerformanceMath.Percent(neutral, scored.Count),
                negativeRate,
                bias,
                avgDuration,
                Math.Round(SurveyPerformanceMath.Median(durations), 1),
                fastRate,
                straightRate,
                gpsRate,
                distinctLocations,
                Math.Round(pingTotals.GetValueOrDefault(id), 1),
                flagged,
                reliability,
                performance,
                myTasks.Select(t => t.Neighborhood ?? "Tüm Mahalleler").Distinct().OrderBy(n => n).ToList(),
                TopLabels(myAnalyzed.SelectMany(a => a.PositiveQuestions)),
                TopLabels(myAnalyzed.SelectMany(a => a.NegativeQuestions)),
                [], // açıklamalar, saha standart sapması kesinleştikten sonra aşağıda doldurulur
                myResponses.Count > 0 ? myResponses.Max(r => r.SubmittedAt) : null));
        }

        // Sapma eşiği tüm anketörler hesaplandıktan sonra kesinleşir; açıklamalar
        // nihai standart sapmayla yeniden üretilir (ilk geçişte kısmi liste kullanılmıştı).
        var stdDev = SurveyPerformanceMath.StdDev(perInterviewerPositiveRates);
        rows = rows.Select(r => r with
        {
            Explanations = SurveyPerformanceMath.Explain(
                r.CompletedCount, r.PositiveRate, fieldPositiveRate, stdDev,
                r.NegativeRate, r.FastResponseRate, r.StraightLiningRate,
                r.GpsCoverageRate, r.DistinctLocationCount, r.ProgressPercent,
                r.AverageDurationSeconds, fieldMedianDuration),
        })
        .OrderByDescending(r => r.PerformanceScore)
        .ThenByDescending(r => r.CompletedCount)
        .ToList();

        var benchmark = new SurveyPerformanceBenchmarkDto(
            ids.Count,
            responses.Count,
            allScored.Count > 0 ? Math.Round(allScored.Average(a => a.Score!.Value) * 5, 2) : 0,
            fieldPositiveRate,
            fieldNegativeRate,
            Math.Round(fieldMedianDuration, 1),
            ids.Count > 0 ? Math.Round((double)responses.Count / ids.Count, 1) : 0,
            Math.Round(stdDev, 1));

        return new SurveyInterviewerPerformanceResultDto(benchmark, rows);
    }

    // ------------------------------------------------------------- yardımcılar

    /// <summary>Bir yanıtın skoru ve kalite göstergeleri (soru bazlı olumlu/olumsuz dökümüyle).</summary>
    private sealed record ResponseAnalysis(
        double? Score, bool IsStraightLined, List<string> PositiveQuestions, List<string> NegativeQuestions);

    private static ResponseAnalysis AnalyzeResponse(string answersJson, Dictionary<Guid, SurveyQuestion> meta)
    {
        var scores = new List<double>();
        var raws = new List<string>();
        var positives = new List<string>();
        var negatives = new List<string>();

        foreach (var a in SurveyAnswerFormatting.ParseAnswersJson(answersJson))
        {
            if (string.IsNullOrWhiteSpace(a.Answer)) continue;
            meta.TryGetValue(a.QuestionId, out var question);
            var s = SurveyScoring.Normalize(question, a.Answer);
            if (!s.HasValue) continue;
            scores.Add(s.Value);
            raws.Add(a.Answer.Trim());
            var label = question?.Question ?? "Bilinmeyen soru";
            if (s.Value >= SurveyPerformanceMath.PositiveThreshold) positives.Add(label);
            else if (s.Value < SurveyPerformanceMath.NegativeThreshold) negatives.Add(label);
        }

        // "Düz çizgi": en az 3 skorlanabilir soruya birebir aynı cevabın verilmesi.
        var straight = raws.Count >= 3 && raws.Distinct().Count() == 1;

        return new ResponseAnalysis(
            scores.Count > 0 ? scores.Average() : null, straight, positives, negatives);
    }

    private static List<SurveyAnswerDistributionDto> TopLabels(IEnumerable<string> labels)
        => Distribution(labels, 5);

    /// <summary>~100 m ızgaraya yuvarlayarak ayrık nokta sayısı.</summary>
    private static int DistinctPointCount(IEnumerable<(double Lat, double Lng)> points)
        => points
            .Select(p => (Math.Round(p.Lat / LocationGridDegrees), Math.Round(p.Lng / LocationGridDegrees)))
            .Distinct()
            .Count();

    private async Task<List<SurveyFieldTask>> ScopedFieldTasksAsync(Guid? surveyId, CancellationToken ct)
    {
        var q = db.SurveyFieldTasks.AsNoTracking()
            .Where(t => !t.IsDeleted && t.InterviewerType == "participant");
        if (surveyId.HasValue) q = q.Where(t => t.SurveyId == surveyId.Value);

        var neighborhoodScope = await GetNeighborhoodScopeAsync(ct);
        if (neighborhoodScope is not null)
            q = q.Where(t => t.Neighborhood != null && neighborhoodScope.Contains(t.Neighborhood));
        var ownSurveyScope = await GetOwnSurveyIdsScopeAsync(ct);
        if (ownSurveyScope is not null)
            q = q.Where(t => ownSurveyScope.Contains(t.SurveyId));

        return await q.ToListAsync(ct);
    }

    /// <summary>
    /// Anketör kimliklerini görünen ada çevirir.
    /// Hata bulgusu (2026-09-02, uçtan uca test): isimler yalnızca GÖREV listesinden
    /// toplanıyordu; görevi silinen (soft-delete) ama topladığı yanıtlar duran anketör
    /// listelerde "—" görünüyordu. <paramref name="extraIds"/> ile yanıtlardan gelen
    /// kimlikler de çözülür (hangi tabloda olduğu bilinmediği için iki tabloda da aranır).
    /// </summary>
    private async Task<Dictionary<Guid, string>> ResolveInterviewerNamesAsync(
        List<SurveyFieldTask> tasks, CancellationToken ct, IEnumerable<Guid>? extraIds = null)
    {
        var extras = extraIds?.Distinct().ToList() ?? [];
        var participantIds = tasks.Where(t => t.InterviewerType == "participant")
            .Select(t => t.InterviewerId).Concat(extras).Distinct().ToList();
        var adminIds = tasks.Where(t => t.InterviewerType != "participant")
            .Select(t => t.InterviewerId).Concat(extras).Distinct().ToList();

        var names = participantIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Participants.AsNoTracking()
                .Where(x => participantIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.FullName, ct);

        if (adminIds.Count > 0)
        {
            var admins = await db.AdminUsers.AsNoTracking()
                .Where(a => adminIds.Contains(a.Id))
                .ToDictionaryAsync(a => a.Id, a => a.FullName, ct);
            foreach (var kv in admins) names[kv.Key] = kv.Value;
        }

        return names;
    }

    /// <summary>Filtre aralığında (verilmemişse bugün) anketör başına yürünen toplam mesafe.</summary>
    private async Task<Dictionary<Guid, double>> LoadDistanceByInterviewerAsync(
        List<Guid> ids, SurveyAnalyticsFilterParams p, CancellationToken ct)
    {
        var fromUtc = p.From.HasValue ? TurkeyTime.ToUtc(p.From.Value.Date) : TurkeyTime.TodayStartUtc();
        var toUtc = p.To.HasValue ? TurkeyTime.ToUtc(p.To.Value.Date).AddDays(1) : fromUtc.AddDays(1);

        return await db.SurveyFieldLocationPings.AsNoTracking()
            .Where(x => ids.Contains(x.InterviewerId) && x.RecordedAt >= fromUtc && x.RecordedAt < toUtc)
            .GroupBy(x => x.InterviewerId)
            .Select(g => new { g.Key, Total = g.Sum(x => x.DistanceFromPreviousMeters) })
            .ToDictionaryAsync(x => x.Key, x => x.Total, ct);
    }
}
