FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
ARG TARGETARCH
# Çalışan imajın hangi commit'ten derlendiği /health yanıtında görünür.
ARG GIT_SHA=unknown
WORKDIR /src

COPY ["src/", "./"]

RUN ARCH=$(echo "$TARGETARCH" | sed 's/amd64/x64/') && \
    dotnet publish "Nexora.Api/Nexora.Api.csproj" \
    -c Release \
    -o /app/publish \
    -a "$ARCH" \
    -p:SourceRevisionId="$GIT_SHA"

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine

RUN apk add --no-cache icu-libs tzdata curl krb5-libs

ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false \
    ASPNETCORE_URLS=http://+:34000 \
    TZ=Europe/Istanbul

WORKDIR /app
COPY --from=build /app/publish .

# Task 14 (2026-09-07, deployment-security finding): base image's default user is root when
# no USER directive is set. The app never writes inside /app (published, read-only content) or
# elsewhere on disk (no local file storage — MinIO/S3 handles all file storage), so a dedicated
# unprivileged user is a safe, no-behavior-change hardening. chown before switching user so the
# app's own files remain readable.
RUN addgroup -S nexora && adduser -S nexora -G nexora \
    && chown -R nexora:nexora /app
USER nexora

EXPOSE 34000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:34000/health || exit 1

ENTRYPOINT ["dotnet", "Nexora.Api.dll"]
