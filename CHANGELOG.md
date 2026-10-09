# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `appsolutely init <directory>`: creates a host project on the `appsolutely/appsolutely` host application with its self-host bundle, running Composer in its own image, and keeps the industry, site type, domain and server in `appsolutely.json`.
- `appsolutely deploy`: builds the project's own image and brings the bundle up on this machine or on a server over SSH, running `aio:install` until an install has finished and refusing a site type the site was not built as.
- `appsolutely generate-sdk --lang ts`: writes a typed TypeScript client for an install as a package tarball, by running the `@appsolutely/sdk` pipeline at a release's tag (or a local checkout with `--sdk-source`) on the document the install serves.
