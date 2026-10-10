using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Nexora.Application.Features.Integrations;

namespace Nexora.Infrastructure.Services;

public class AiQueryService(HttpClient httpClient, IIntegrationSettingsService settings) : IAiQueryService
{
    public async Task<string> AskAsync(string prompt, string? contextJson, string? preferredProvider, CancellationToken ct)
    {
        var resolved = await settings.ResolveAiProviderAsync(preferredProvider, ct)
            ?? throw new AiNotConfiguredException(
                "Hiçbir yapay zeka sağlayıcısı yapılandırılmamış. Ayarlar > Entegrasyonlar ekranından bir API key girip etkinleştirin.");

        var fullPrompt = string.IsNullOrWhiteSpace(contextJson)
            ? prompt
            : $"{prompt}\n\nVeri (JSON):\n{contextJson}";

        try
        {
            return resolved.Provider switch
            {
                "openai" => await AskOpenAiAsync(resolved.ApiKey, resolved.Model ?? "gpt-4o", fullPrompt, ct),
                "anthropic" => await AskAnthropicAsync(resolved.ApiKey, resolved.Model ?? "claude-sonnet-4-5", fullPrompt, ct),
                "gemini" => await AskGeminiAsync(resolved.ApiKey, resolved.Model ?? "gemini-2.0-flash", fullPrompt, ct),
                _ => throw new AiNotConfiguredException($"Bilinmeyen sağlayıcı: {resolved.Provider}"),
            };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            throw new AiNotConfiguredException(
                $"Yapay zeka sağlayıcısına ({resolved.Provider}) bağlanılamadı. API key'in geçerli/etkin olduğunu ve internet bağlantısını kontrol edin. Detay: {ex.Message}");
        }
    }

    private async Task<string> AskOpenAiAsync(string apiKey, string model, string prompt, CancellationToken ct)
    {
        var body = new
        {
            model,
            messages = new[]
            {
                new { role = "system", content = "Sen Sultangazi Belediyesi yönetim panelinde raporlama/analiz asistanısın. Türkçe, kısa ve net yanıt ver." },
                new { role = "user", content = prompt },
            },
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
        {
            Content = JsonContent.Create(body),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var res = await httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        return doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";
    }

    private async Task<string> AskAnthropicAsync(string apiKey, string model, string prompt, CancellationToken ct)
    {
        var body = new
        {
            model,
            max_tokens = 1024,
            system = "Sen Sultangazi Belediyesi yönetim panelinde raporlama/analiz asistanısın. Türkçe, kısa ve net yanıt ver.",
            messages = new[] { new { role = "user", content = prompt } },
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
        {
            Content = JsonContent.Create(body),
        };
        req.Headers.Add("x-api-key", apiKey);
        req.Headers.Add("anthropic-version", "2023-06-01");

        using var res = await httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        return doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString() ?? "";
    }

    private async Task<string> AskGeminiAsync(string apiKey, string model, string prompt, CancellationToken ct)
    {
        var body = new
        {
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = prompt } } },
            },
        };
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(body),
        };

        using var res = await httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        return doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString() ?? "";
    }
}
