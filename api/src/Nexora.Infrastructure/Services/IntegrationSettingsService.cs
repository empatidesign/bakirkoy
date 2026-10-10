using System.Text.Json;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Integrations;
using Nexora.Application.Features.Integrations.Dtos;
using Nexora.Domain.Entities.Integrations;

namespace Nexora.Infrastructure.Services;

public class IntegrationSettingsService(IUnitOfWork uow, IApiKeyEncryptor encryptor) : IIntegrationSettingsService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private record StoredProviderConfig(bool Enabled, string? EncryptedApiKey, string? Model);
    private record StoredUlakbelConfig(bool Enabled, string? BaseUrl, string? EncryptedApiToken, bool NotifyCitizenOnUpdate = true, int? SourceId = null);
    private record StoredFlexcityConfig(bool Enabled, string? BaseUrl, string? EncryptedAppKey, string? EncryptedSecurityCode);
    private record StoredBridge360Config(bool Enabled, string? BaseUrl, string? EncryptedApiKey);
    private record StoredConfig(
        StoredProviderConfig GoogleMaps,
        StoredProviderConfig OpenAi,
        StoredProviderConfig Anthropic,
        StoredProviderConfig Gemini,
        string? DefaultAiProvider,
        StoredUlakbelConfig? Ulakbel,
        StoredFlexcityConfig? Flexcity = null,
        StoredBridge360Config? Bridge360 = null);

    private static StoredConfig DefaultStored() => new(
        GoogleMaps: new StoredProviderConfig(false, null, null),
        OpenAi: new StoredProviderConfig(false, null, "gpt-4o"),
        Anthropic: new StoredProviderConfig(false, null, "claude-sonnet-4-5"),
        Gemini: new StoredProviderConfig(false, null, "gemini-2.0-flash"),
        DefaultAiProvider: null,
        Ulakbel: new StoredUlakbelConfig(false, null, null, true, null));

    private async Task<StoredConfig> LoadAsync(CancellationToken ct)
    {
        var record = await uow.IntegrationSettings.GetCurrentAsync(ct);
        if (record is null) return DefaultStored();
        var stored = JsonSerializer.Deserialize<StoredConfig>(record.ConfigJson, JsonOpts) ?? DefaultStored();
        return stored.Ulakbel is null ? stored with { Ulakbel = new StoredUlakbelConfig(false, null, null, true, null) } : stored;
    }

    private async Task SaveStoredAsync(StoredConfig config, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(config, JsonOpts);
        var record = await uow.IntegrationSettings.GetCurrentAsync(ct);
        if (record is null)
        {
            record = IntegrationSettingsRecord.Create(json);
            await uow.IntegrationSettings.AddAsync(record, ct);
        }
        else
        {
            record.Update(json);
            uow.IntegrationSettings.Update(record);
        }
        await uow.SaveChangesAsync(ct);
    }

    private MapProviderSettingsDto ToMapDto(StoredProviderConfig p)
    {
        var plain = encryptor.Decrypt(p.EncryptedApiKey);
        return new MapProviderSettingsDto(p.Enabled, !string.IsNullOrEmpty(plain), plain is null ? null : encryptor.Mask(plain));
    }

    private AiProviderSettingsDto ToAiDto(StoredProviderConfig p)
    {
        var plain = encryptor.Decrypt(p.EncryptedApiKey);
        return new AiProviderSettingsDto(p.Enabled, !string.IsNullOrEmpty(plain), plain is null ? null : encryptor.Mask(plain), p.Model);
    }

    public async Task<IntegrationSettingsDto> GetAsync(CancellationToken ct)
    {
        var stored = await LoadAsync(ct);
        var ulakbelPlain = encryptor.Decrypt(stored.Ulakbel?.EncryptedApiToken);
        var fx = stored.Flexcity;
        var fxKey = encryptor.Decrypt(fx?.EncryptedAppKey);
        var b3 = stored.Bridge360;
        var b3Key = encryptor.Decrypt(b3?.EncryptedApiKey);
        return new IntegrationSettingsDto(
            ToMapDto(stored.GoogleMaps),
            ToAiDto(stored.OpenAi),
            ToAiDto(stored.Anthropic),
            ToAiDto(stored.Gemini),
            stored.DefaultAiProvider,
            new UlakbelSettingsDto(
                stored.Ulakbel?.Enabled ?? false,
                stored.Ulakbel?.BaseUrl,
                !string.IsNullOrEmpty(ulakbelPlain),
                ulakbelPlain is null ? null : encryptor.Mask(ulakbelPlain),
                stored.Ulakbel?.NotifyCitizenOnUpdate ?? true,
                stored.Ulakbel?.SourceId),
            new FlexcitySettingsDto(
                fx?.Enabled ?? false,
                fx?.BaseUrl,
                !string.IsNullOrEmpty(fxKey),
                fxKey is null ? null : encryptor.Mask(fxKey),
                !string.IsNullOrEmpty(encryptor.Decrypt(fx?.EncryptedSecurityCode))),
            new Bridge360SettingsDto(
                b3?.Enabled ?? false,
                b3?.BaseUrl,
                !string.IsNullOrEmpty(b3Key),
                b3Key is null ? null : encryptor.Mask(b3Key)));
    }

    private StoredProviderConfig MergeMap(StoredProviderConfig existing, UpdateMapProviderRequest req)
    {
        string? encrypted = existing.EncryptedApiKey;
        if (req.ClearApiKey) encrypted = null;
        else if (!string.IsNullOrWhiteSpace(req.ApiKey)) encrypted = encryptor.Encrypt(req.ApiKey.Trim());
        return new StoredProviderConfig(req.Enabled, encrypted, null);
    }

    private StoredProviderConfig MergeAi(StoredProviderConfig existing, UpdateAiProviderRequest req)
    {
        string? encrypted = existing.EncryptedApiKey;
        if (req.ClearApiKey) encrypted = null;
        else if (!string.IsNullOrWhiteSpace(req.ApiKey)) encrypted = encryptor.Encrypt(req.ApiKey.Trim());
        var model = string.IsNullOrWhiteSpace(req.Model) ? existing.Model : req.Model.Trim();
        return new StoredProviderConfig(req.Enabled, encrypted, model);
    }

    public async Task<IntegrationSettingsDto> SaveAsync(UpdateIntegrationSettingsRequest req, CancellationToken ct)
    {
        var existing = await LoadAsync(ct);
        StoredUlakbelConfig mergedUlakbel = existing.Ulakbel ?? new StoredUlakbelConfig(false, null, null, true, null);
        if (req.Ulakbel is not null)
        {
            var u = req.Ulakbel;
            if (u.SourceId is <= 0)
                throw new Nexora.Application.Common.Exceptions.ConflictException(
                    "Ulakbell Başvuru Kaynağı (Source ID) pozitif bir tam sayı olmalı.", "INVALID_ULAKBEL_SOURCE_ID");
            if (!string.IsNullOrWhiteSpace(u.BaseUrl)
                && (!Uri.TryCreate(u.BaseUrl.Trim().TrimEnd('/'), UriKind.Absolute, out var uUri) || uUri.Scheme != Uri.UriSchemeHttps))
                throw new Nexora.Application.Common.Exceptions.ConflictException(
                    "Ulakbell adresi https:// ile başlayan geçerli bir adres olmalı.", "INVALID_ULAKBEL_URL");
            var baseUrl = string.IsNullOrWhiteSpace(u.BaseUrl) ? mergedUlakbel.BaseUrl : u.BaseUrl.Trim().TrimEnd('/');
            string? encrypted = mergedUlakbel.EncryptedApiToken;
            if (u.ClearApiToken) encrypted = null;
            else if (!string.IsNullOrWhiteSpace(u.ApiToken)) encrypted = encryptor.Encrypt(u.ApiToken.Trim());
            mergedUlakbel = new StoredUlakbelConfig(u.Enabled, baseUrl, encrypted, u.NotifyCitizenOnUpdate, u.SourceId ?? mergedUlakbel.SourceId);
        }
        var mergedFx = existing.Flexcity ?? new StoredFlexcityConfig(false, null, null, null);
        if (req.Flexcity is not null)
        {
            var f = req.Flexcity;
            string? key = mergedFx.EncryptedAppKey, code = mergedFx.EncryptedSecurityCode;
            if (f.ClearCredentials) { key = null; code = null; }
            if (!string.IsNullOrWhiteSpace(f.AppKey)) key = encryptor.Encrypt(f.AppKey.Trim());
            if (!string.IsNullOrWhiteSpace(f.SecurityCode)) code = encryptor.Encrypt(f.SecurityCode.Trim());
            var url = string.IsNullOrWhiteSpace(f.BaseUrl) ? mergedFx.BaseUrl : f.BaseUrl.Trim().TrimEnd('/');
            if (url is not null && (!Uri.TryCreate(url, UriKind.Absolute, out var u) || (u.Scheme != Uri.UriSchemeHttp && u.Scheme != Uri.UriSchemeHttps)))
                throw new Nexora.Application.Common.Exceptions.ConflictException("Flexcity adresi http:// veya https:// ile başlayan geçerli bir adres olmalı.", "INVALID_FLEXCITY_URL");
            mergedFx = new StoredFlexcityConfig(f.Enabled, url, key, code);
        }
        var mergedB3 = existing.Bridge360 ?? new StoredBridge360Config(false, null, null);
        if (req.Bridge360 is not null)
        {
            var b = req.Bridge360;
            string? key = mergedB3.EncryptedApiKey;
            if (b.ClearApiKey) key = null;
            else if (!string.IsNullOrWhiteSpace(b.ApiKey)) key = encryptor.Encrypt(b.ApiKey.Trim());
            var url = string.IsNullOrWhiteSpace(b.BaseUrl) ? mergedB3.BaseUrl : b.BaseUrl.Trim().TrimEnd('/');
            if (url is not null && (!Uri.TryCreate(url, UriKind.Absolute, out var bu) || bu.Scheme != Uri.UriSchemeHttps))
                throw new Nexora.Application.Common.Exceptions.ConflictException("Bridge360 adresi https:// ile başlayan geçerli bir adres olmalı.", "INVALID_BRIDGE360_URL");
            mergedB3 = new StoredBridge360Config(b.Enabled, url, key);
        }
        var updated = new StoredConfig(
            GoogleMaps: MergeMap(existing.GoogleMaps, req.GoogleMaps),
            OpenAi: MergeAi(existing.OpenAi, req.OpenAi),
            Anthropic: MergeAi(existing.Anthropic, req.Anthropic),
            Gemini: MergeAi(existing.Gemini, req.Gemini),
            DefaultAiProvider: string.IsNullOrWhiteSpace(req.DefaultAiProvider) ? null : req.DefaultAiProvider.Trim().ToLowerInvariant(),
            Ulakbel: mergedUlakbel,
            Flexcity: mergedFx,
            Bridge360: mergedB3);

        await SaveStoredAsync(updated, ct);
        return await GetAsync(ct);
    }

    public async Task<PublicMapConfigDto> GetPublicMapConfigAsync(CancellationToken ct)
    {
        var stored = await LoadAsync(ct);
        if (!stored.GoogleMaps.Enabled) return new PublicMapConfigDto(false, null);
        var plain = encryptor.Decrypt(stored.GoogleMaps.EncryptedApiKey);
        return string.IsNullOrEmpty(plain)
            ? new PublicMapConfigDto(false, null)
            : new PublicMapConfigDto(true, plain);
    }

    public async Task<ResolvedAiProvider?> ResolveAiProviderAsync(string? preferredProvider, CancellationToken ct)
    {
        var stored = await LoadAsync(ct);
        var provider = (string.IsNullOrWhiteSpace(preferredProvider) ? stored.DefaultAiProvider : preferredProvider)
            ?.Trim().ToLowerInvariant();

        StoredProviderConfig? config = provider switch
        {
            "openai" or "chatgpt" => stored.OpenAi,
            "anthropic" or "claude" => stored.Anthropic,
            "gemini" or "google" => stored.Gemini,
            _ => null,
        };

        if (config is null && string.IsNullOrWhiteSpace(provider))
        {
            foreach (var (name, candidate) in new[] { ("openai", stored.OpenAi), ("anthropic", stored.Anthropic), ("gemini", stored.Gemini) })
            {
                if (!candidate.Enabled) continue;
                var candidatePlain = encryptor.Decrypt(candidate.EncryptedApiKey);
                if (!string.IsNullOrEmpty(candidatePlain))
                    return new ResolvedAiProvider(name, candidatePlain, candidate.Model);
            }
            return null;
        }

        if (config is null || !config.Enabled) return null;
        var plain = encryptor.Decrypt(config.EncryptedApiKey);
        if (string.IsNullOrEmpty(plain)) return null;
        return new ResolvedAiProvider(provider!, plain, config.Model);
    }

    public async Task<ResolvedUlakbelConfig?> ResolveUlakbelAsync(CancellationToken ct)
    {
        var stored = await LoadAsync(ct);
        var u = stored.Ulakbel;
        if (u is null || !u.Enabled || string.IsNullOrWhiteSpace(u.BaseUrl)) return null;
        var plain = encryptor.Decrypt(u.EncryptedApiToken);
        if (string.IsNullOrEmpty(plain)) return null;
        return new ResolvedUlakbelConfig(u.BaseUrl, plain, u.SourceId);
    }

    // Kullanıcı isteği (2026-08-08): "Ulakbel'den bildirim gidiyorsa ordan gitsin ama bizim
    // sistemde gitsin veya gitmesin şeklinde ayar olsun". Ulakbel.Enabled durumundan BAĞIMSIZ
    // okunur — entegrasyon simülasyon modunda (yapılandırılmamış) çalışırken de sistem içi
    // vatandaş bildirimi ayarı geçerli olmalı.
    public async Task<bool> ShouldNotifyCitizenOnUlakbelUpdateAsync(CancellationToken ct)
    {
        var stored = await LoadAsync(ct);
        return stored.Ulakbel?.NotifyCitizenOnUpdate ?? true;
    }

    public async Task<ResolvedFlexcityConfig?> ResolveFlexcityAsync(CancellationToken ct)
    {
        var f = (await LoadAsync(ct)).Flexcity;
        if (f is null || !f.Enabled || string.IsNullOrWhiteSpace(f.BaseUrl)) return null;
        var key = encryptor.Decrypt(f.EncryptedAppKey);
        if (string.IsNullOrEmpty(key)) return null;
        return new ResolvedFlexcityConfig(f.BaseUrl, key, encryptor.Decrypt(f.EncryptedSecurityCode));
    }

    public async Task<ResolvedBridge360Config?> ResolveBridge360Async(CancellationToken ct)
    {
        var b = (await LoadAsync(ct)).Bridge360;
        if (b is null || !b.Enabled || string.IsNullOrWhiteSpace(b.BaseUrl)) return null;
        var key = encryptor.Decrypt(b.EncryptedApiKey);
        if (string.IsNullOrEmpty(key)) return null;
        return new ResolvedBridge360Config(b.BaseUrl, key);
    }
}
