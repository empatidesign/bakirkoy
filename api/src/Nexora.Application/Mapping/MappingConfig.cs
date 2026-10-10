using Mapster;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Application.Features.Auth.Dtos;
using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Entities.Specialized;

namespace Nexora.Application.Mapping;

public static class MappingConfig
{
    public static TypeAdapterConfig Configure()
    {
        var config = new TypeAdapterConfig();

        config.NewConfig<AuditLog, AuditLog>();

        config.NewConfig<AdminUser, MeDto>();

        return config;
    }
}
