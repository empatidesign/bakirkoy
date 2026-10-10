using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Nexora.Api.Common.OpenApi;

public class SecuritySchemeTransformer : IOpenApiDocumentTransformer
{
    public Task TransformAsync(
        OpenApiDocument document,
        OpenApiDocumentTransformerContext context,
        CancellationToken ct)
    {
        var components = document.Components ??= new OpenApiComponents();
        components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type         = SecuritySchemeType.Http,
            Scheme       = "bearer",
            BearerFormat = "JWT",
            Description  = "JWT Bearer token"
        };

        var schemeRef   = new OpenApiSecuritySchemeReference("Bearer");
        var requirement = new OpenApiSecurityRequirement { [schemeRef] = [] };

        if (document.Paths is not null)
        {
            foreach (var path in document.Paths.Values)
            {
                if (path.Operations is null) continue;
                foreach (var operation in path.Operations.Values)
                    (operation.Security ??= []).Add(requirement);
            }
        }

        return Task.CompletedTask;
    }
}
