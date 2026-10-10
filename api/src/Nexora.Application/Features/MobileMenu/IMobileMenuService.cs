using Nexora.Application.Features.MobileMenu.Dtos;

namespace Nexora.Application.Features.MobileMenu;

public interface IMobileMenuService
{
    Task<List<MobileMenuItemDto>> GetItemsAsync(CancellationToken ct);
    Task<MobileMenuItemDto> CreateItemAsync(CreateMobileMenuItemRequest req, CancellationToken ct);
    Task<MobileMenuItemDto> UpdateItemAsync(Guid id, UpdateMobileMenuItemRequest req, CancellationToken ct);
    Task DeleteItemAsync(Guid id, CancellationToken ct);
    Task ReorderAsync(ReorderMobileMenuRequest req, CancellationToken ct);
    Task<List<MobileMenuGroupDto>> GetGroupsAsync(CancellationToken ct);
    Task<List<MobileMenuBannerDto>> GetBannersAsync(CancellationToken ct);
    Task<MobileMenuBannerDto> UpsertBannerAsync(string pageKey, UpsertBannerRequest req, CancellationToken ct);
    Task DeleteBannerAsync(string pageKey, CancellationToken ct);
    Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct);

    Task<PublicMenuResponse> GetPublicMenuAsync(CancellationToken ct);
    Task<PublicBannerDto?> GetPublicBannerAsync(string pageKey, CancellationToken ct);
}
