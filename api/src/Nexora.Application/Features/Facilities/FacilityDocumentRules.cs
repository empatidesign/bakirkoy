using System.Text.Json;
using Nexora.Application.Common.Exceptions;

namespace Nexora.Application.Features.Facilities;

// Kullanıcı isteği (2026-10-04): "önkoşul kurs" (örn. Arapça Seviye 2'ye yalnızca Seviye 1'i
// tamamlamış/kayıtlı kişiler başvurabilsin) ve "özel evet/hayır soruları" (örn. Havuz'da
// "Yüzme biliyor musunuz?") — admin panelden grup bazında aç/kapa yapılabilen, modüle özgü
// olmayan JENERIK alanlar. FacilityGroup.ConditionsJson'a eklendi (documentsRequired/
// residenceRequired ile aynı desen — yeni tablo açmadan, mevcut esnek JSON alanına).
public sealed record FacilityCustomQuestion(string Id, string Question, bool Required);

public sealed record FacilityGroupRules(Guid? PrerequisiteGroupId, IReadOnlyList<FacilityCustomQuestion> CustomQuestions);

public static class FacilityDocumentRules
{
    public static void EnsureRequiredProvided(FacilityModuleRule rule, IEnumerable<string> providedTypeKeys)
    {
        var missing = MissingRequired(rule, providedTypeKeys);
        if (missing.Count == 0) return;
        throw new ConflictException(BuildRequiredMessage(rule, missing), "DOCUMENTS_REQUIRED");
    }

    public static IReadOnlyList<FacilityDocumentType> MissingRequired(FacilityModuleRule rule, IEnumerable<string> providedTypeKeys)
    {
        if (rule.DocumentTypes.Count == 0) return [];
        var provided = new HashSet<string>(providedTypeKeys.Where(k => !string.IsNullOrWhiteSpace(k)), StringComparer.OrdinalIgnoreCase);
        return rule.DocumentTypes.Where(t => t.Required && !provided.Contains(t.Key)).ToList();
    }

    public static string BuildRequiredMessage(FacilityModuleRule rule, IReadOnlyList<FacilityDocumentType> missing)
    {
        if (missing.Count == 0)
            return rule.DocumentsRequiredMessage ?? "Bu başvuru için zorunlu belgeler eksik.";
        return $"Şu belgelerin yüklenmesi zorunludur: {string.Join(", ", missing.Select(m => m.Label))}.";
    }

    public static FacilityModuleRule ResolveGroupRule(string? conditionsJson, IReadOnlyDictionary<string, string>? labels = null)
    {
        var types = new List<FacilityDocumentType>();
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(conditionsJson) ? "{}" : conditionsJson);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object)
            {
                var documentsRequired = root.TryGetProperty("documentsRequired", out var dr) && dr.ValueKind == JsonValueKind.True;
                var residenceRequired = root.TryGetProperty("residenceRequired", out var rr) && rr.ValueKind == JsonValueKind.True;
                if (documentsRequired && root.TryGetProperty("requiredDocumentIds", out var idsEl) && idsEl.ValueKind == JsonValueKind.Array)
                    foreach (var e in idsEl.EnumerateArray())
                        if (e.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(e.GetString()))
                        {
                            var id = e.GetString()!;
                            var label = labels is not null && labels.TryGetValue(id, out var l) ? l : "Evrak";
                            types.Add(new FacilityDocumentType(id, label, true));
                        }
                if (residenceRequired && !types.Any(t => string.Equals(t.Key, "residence", StringComparison.OrdinalIgnoreCase)))
                    types.Add(new FacilityDocumentType("residence", "İkametgâh Belgesi", true));
            }
        }
        catch { }
        return new FacilityModuleRule(
            RequiresApplicationDocuments: types.Count > 0,
            DocumentsRequiredMessage: "Bu program için gerekli evrakların yüklenmesi zorunludur.",
            RequiredDocumentTypes: types);
    }

    public static IReadOnlyDictionary<string, string> ParseLibraryLabels(string? settingsJson)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(settingsJson)) return result;
        try
        {
            using var doc = JsonDocument.Parse(settingsJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("requiredDocuments", out var arr)
                && arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var d in arr.EnumerateArray())
                {
                    if (d.ValueKind != JsonValueKind.Object) continue;
                    var id = d.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                    var label = d.TryGetProperty("label", out var lEl) ? lEl.GetString() : null;
                    if (!string.IsNullOrWhiteSpace(id))
                        result[id!] = string.IsNullOrWhiteSpace(label) ? "Evrak" : label!;
                }
            }
        }
        catch { }
        return result;
    }

    public static IReadOnlyList<string> ProvidedTypeKeys(JsonElement documents)
    {
        if (documents.ValueKind != JsonValueKind.Array) return [];
        var keys = new List<string>();
        foreach (var doc in documents.EnumerateArray())
        {
            if (doc.ValueKind != JsonValueKind.Object) continue;
            var type = doc.TryGetProperty("type", out var t) ? t.GetString() : null;
            if (string.IsNullOrWhiteSpace(type)) continue;
            if (!HasContent(doc, "objectName") && !HasContent(doc, "fileUrl") && !HasContent(doc, "url")) continue;
            keys.Add(type);
        }
        return keys;
    }

    /// <summary>
    /// ConditionsJson'dan önkoşul grup ID'si ve özel soru listesini çözer. Beklenen şema:
    /// { "prerequisiteGroupId": "guid-string" | null, "customQuestions": [{ "id": "...", "question": "...", "required": true }] }
    /// Format, admin panelin GroupFormFields.tsx'inin ürettiği şemayla birebir eşleşir.
    /// </summary>
    public static FacilityGroupRules ParseGroupRules(string? conditionsJson)
    {
        Guid? prerequisiteId = null;
        var questions = new List<FacilityCustomQuestion>();
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(conditionsJson) ? "{}" : conditionsJson);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object)
            {
                if (root.TryGetProperty("prerequisiteGroupId", out var pEl) && pEl.ValueKind == JsonValueKind.String
                    && Guid.TryParse(pEl.GetString(), out var pGuid))
                    prerequisiteId = pGuid;

                if (root.TryGetProperty("customQuestions", out var qEl) && qEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var q in qEl.EnumerateArray())
                    {
                        if (q.ValueKind != JsonValueKind.Object) continue;
                        var id = q.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                        var question = q.TryGetProperty("question", out var qnEl) ? qnEl.GetString() : null;
                        if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(question)) continue;
                        var required = q.TryGetProperty("required", out var rEl) && rEl.ValueKind == JsonValueKind.True;
                        questions.Add(new FacilityCustomQuestion(id!, question!, required));
                    }
                }
            }
        }
        catch { }
        return new FacilityGroupRules(prerequisiteId, questions);
    }

    /// <summary>
    /// Zorunlu özel sorulardan yanıtlanmayanları döner — boş liste "hepsi tamam" demektir.
    /// answersJson beklenen şema: { "questionId": "yes" | "no", ... }
    /// </summary>
    public static IReadOnlyList<FacilityCustomQuestion> MissingRequiredAnswers(
        IReadOnlyList<FacilityCustomQuestion> questions, string? answersJson)
    {
        if (questions.Count == 0) return [];
        var answered = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(answersJson) ? "{}" : answersJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object)
                foreach (var prop in doc.RootElement.EnumerateObject())
                    if (prop.Value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(prop.Value.GetString()))
                        answered.Add(prop.Name);
        }
        catch { }
        return questions.Where(q => q.Required && !answered.Contains(q.Id)).ToList();
    }

    private static bool HasContent(JsonElement doc, string property)
        => doc.TryGetProperty(property, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString());
}
