using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Infrastructure.Persistence.Configurations;

public class QuizConfiguration : IEntityTypeConfiguration<Quiz>
{
    public void Configure(EntityTypeBuilder<Quiz> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasColumnType("text");
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ResidencyMode).IsRequired().HasMaxLength(20).HasDefaultValue("anyone");

        builder.HasIndex(x => x.CategoryId);
        builder.HasIndex(x => x.AgeGroupId);

        builder.HasMany(x => x.Questions)
            .WithOne()
            .HasForeignKey(q => q.QuizId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
