using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class CompanySettingsRecordConfiguration : IEntityTypeConfiguration<CompanySettingsRecord>
{
    public void Configure(EntityTypeBuilder<CompanySettingsRecord> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.ConfigJson).IsRequired().HasColumnType("jsonb");

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
