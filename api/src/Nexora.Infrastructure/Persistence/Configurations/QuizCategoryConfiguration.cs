using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class QuizCategoryConfiguration : IEntityTypeConfiguration<QuizCategory>
{
    public void Configure(EntityTypeBuilder<QuizCategory> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Name).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Description).HasMaxLength(300);
        builder.Property(x => x.Color).IsRequired().HasMaxLength(9);

        builder.HasIndex(x => x.Name).IsUnique();

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
