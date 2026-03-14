using backend.Modules.Users.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Modules.Users.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> entity)
    {
        entity.ToTable("users");
        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        entity.Property(x => x.Email)
            .HasColumnName("email")
            .HasMaxLength(320)
            .IsRequired();

        entity.Property(x => x.NormalizedEmail)
            .HasColumnName("normalized_email")
            .HasMaxLength(320)
            .IsRequired();

        entity.Property(x => x.UserName)
            .HasColumnName("user_name")
            .HasMaxLength(100)
            .IsRequired();

        entity.Property(x => x.NormalizedUserName)
            .HasColumnName("normalized_user_name")
            .HasMaxLength(100)
            .IsRequired();

        entity.Property(x => x.PasswordHash)
            .HasColumnName("password_hash")
            .HasMaxLength(512)
            .IsRequired(false);

        entity.Property(x => x.DisplayName)
            .HasColumnName("display_name")
            .HasMaxLength(200)
            .IsRequired();

        entity.Property(x => x.IsBlocked)
            .HasColumnName("is_blocked")
            .IsRequired();

        entity.Property(x => x.PreferredLanguage)
            .HasColumnName("preferred_language")
            .HasMaxLength(10)
            .IsRequired();

        entity.Property(x => x.PreferredTheme)
            .HasColumnName("preferred_theme")
            .HasMaxLength(20)
            .IsRequired();

        entity.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        entity.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        entity.HasIndex(x => x.Email)
            .IsUnique();

        entity.HasIndex(x => x.NormalizedEmail)
            .IsUnique();

        entity.HasIndex(x => x.UserName)
            .IsUnique();

        entity.HasIndex(x => x.NormalizedUserName)
            .IsUnique();
    }
}

public sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> entity)
    {
        entity.ToTable("roles");
        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        entity.Property(x => x.Name)
            .HasColumnName("name")
            .HasMaxLength(50)
            .IsRequired();

        entity.HasIndex(x => x.Name)
            .IsUnique();

        entity.HasData(
            new Role { Id = 1, Name = "user" },
            new Role { Id = 2, Name = "admin" }
        );
    }
}

public sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> entity)
    {
        entity.ToTable("user_roles");
        entity.HasKey(x => new { x.UserId, x.RoleId });

        entity.Property(x => x.UserId)
            .HasColumnName("user_id");

        entity.Property(x => x.RoleId)
            .HasColumnName("role_id");

        entity.HasOne(x => x.User)
            .WithMany(x => x.UserRoles)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.Role)
            .WithMany(x => x.UserRoles)
            .HasForeignKey(x => x.RoleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ExternalAuthAccountConfiguration : IEntityTypeConfiguration<ExternalAuthAccount>
{
    public void Configure(EntityTypeBuilder<ExternalAuthAccount> entity)
    {
        entity.ToTable("external_auth_accounts");
        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        entity.Property(x => x.UserId)
            .HasColumnName("user_id");

        entity.Property(x => x.Provider)
            .HasColumnName("provider")
            .HasMaxLength(50)
            .IsRequired();

        entity.Property(x => x.ProviderUserId)
            .HasColumnName("provider_user_id")
            .HasMaxLength(200)
            .IsRequired();

        entity.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        entity.HasOne(x => x.User)
            .WithMany(x => x.ExternalAuthAccounts)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasIndex(x => new { x.Provider, x.ProviderUserId })
            .IsUnique();

        entity.HasIndex(x => new { x.UserId, x.Provider })
            .IsUnique();
    }
}
