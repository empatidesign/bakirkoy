using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Education;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class EducationInstitutionConfiguration : IEntityTypeConfiguration<EducationInstitution>
{
    public void Configure(EntityTypeBuilder<EducationInstitution> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Faculty).HasMaxLength(200);
        builder.Property(x => x.Department).HasMaxLength(200);
        builder.Property(x => x.Type).IsRequired();
        builder.HasQueryFilter(x => !x.IsDeleted);
        builder.HasIndex(x => x.Type);
        builder.HasIndex(x => x.IsActive);
    }
}
