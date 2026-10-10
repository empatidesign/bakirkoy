namespace Nexora.Api.Common;

public sealed record RequirePermissionMetadata(string[] PermissionKeys);

public static class PermissionEndpointExtensions
{
    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder, string permissionKey)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.WithMetadata(new RequirePermissionMetadata([permissionKey]));
        return builder;
    }

    public static TBuilder RequireAnyPermission<TBuilder>(this TBuilder builder, params string[] permissionKeys)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.WithMetadata(new RequirePermissionMetadata(permissionKeys));
        return builder;
    }
}
