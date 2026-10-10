using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class QuizQuestionConfiguration : IEntityTypeConfiguration<QuizQuestion>
{
    public void Configure(EntityTypeBuilder<QuizQuestion> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Question).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Difficulty).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Language).IsRequired().HasMaxLength(10).HasDefaultValue("tr");
        builder.Property(x => x.Tags).HasDefaultValueSql("'{}'");

        builder.HasIndex(x => x.QuizId);
        builder.HasIndex(x => x.AgeGroupId);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
