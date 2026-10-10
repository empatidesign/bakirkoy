using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class QuizAgeGroupConfiguration : IEntityTypeConfiguration<QuizAgeGroup>
{
    public void Configure(EntityTypeBuilder<QuizAgeGroup> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(100);

        builder.HasIndex(x => x.Name).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
