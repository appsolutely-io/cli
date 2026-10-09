# Transcript: one run from an empty Docker engine

One recorded run of what the CLI and the two app starters are for: `init` and `deploy` serve a landing site, `generate-sdk` against it writes `@appsolutely/sdk` for the same spec revision byte for byte, `create-appsolutely-tauri-app` builds an app whose updater asks that install's `tauri/updates` route, `create-appsolutely-expo-app` builds an app whose screen calls it, and the same project shape deploys to a server over SSH.

## How the run was set up

- **The machine.** A container holding Node 24 and the Docker client (with Compose and Buildx) and nothing else — no PHP, no Composer, no Rust — driving a Docker engine that started empty (`docker images --quiet` prints nothing). The desktop build in part B ran on the development machine instead, because a Tauri build needs Rust and the platform toolchain.
- **Nothing is published yet.** The CLI and the starters run from their packed tarballs (`npx --package=<tarball>` and `npm exec --package=<tarball>` stand for `npx @appsolutely/cli` and `npm create …`). The host package is taken from its private repository with `--repository` and a `COMPOSER_AUTH` credential, which reaches Composer and the image build by name and appears nowhere in the output.
- **The SDK.** `generate-sdk` runs a local copy of the `sdk-ts` pipeline (`--sdk-source`), because `@appsolutely/sdk` is not on npm. The comparison stands in for "the published `@appsolutely/sdk` for the same spec revision": the same repository pinned (`pnpm spec:pin`) to the aio release the install runs, generated and packed. The first `generate-sdk` in part A ran against a copy pinned to aio v0.6.0 while the latest host release, v0.1.5, locks aio v0.7.0; it reports that the document differs and the diff shows the routes v0.7.0 added. Part A continued runs it against the copy pinned to v0.7.0.
- **The server.** Part C's server is a container running sshd with a Docker client that drives the same engine; the bundle directory sits on a path the engine sees at the same place.
- **What is left out.** Docker's layer download and image build progress lines, and npm's update notices. The one-time sign-in link the install prints is redacted, local paths are shortened to `<workdir>`, `<pnpm store>` and `~`, and the addresses of the private repositories the run read are shown as `<host repository>` and `<aio repository>`. Everything else is the output as it came.

## Part A: init, deploy, and generate-sdk against the wrong revision

```console
$ node --version
v24.21.0

$ docker version --format engine {{.Server.Version}}
engine 29.8.1

$ docker images --quiet

$ command -v php composer cargo
(none of them)

$ printf "software\n" | npx --yes --package=../appsolutely-cli-0.1.0.tgz appsolutely init demo --self-host --template landing --repository <host repository>
Industry whose starter content builds the landing site (such as software): Unable to find image 'composer:2' locally
2: Pulling from library/composer
Digest: sha256:af98f42dfff7c68ba8d53c2164fd9fde1087b7d449514baa38c418b1f6bc4bac
Status: Downloaded newer image for composer:2
Creating a "appsolutely/appsolutely" project at "./demo"
Installing appsolutely/appsolutely (v0.1.5)
  - Downloading appsolutely/appsolutely (v0.1.5)
  - Installing appsolutely/appsolutely (v0.1.5): Extracting archive
Created project in /app/demo
Created demo: a host project on appsolutely/aio v0.7.0, with the self-host bundle in deploy/.
Bring it up with:
  cd demo
  npx @appsolutely/cli deploy

$ cat demo/appsolutely.json
{
  "industry": "software",
  "siteType": "landing",
  "domain": null,
  "url": "https://localhost",
  "server": null,
  "serverPath": null
}

$ npx --yes --package=../../appsolutely-cli-0.1.0.tgz appsolutely deploy
(docker build output omitted)
naming to docker.io/appsolutely-local/demo:latest 0.0s done

 1 warning found (use docker --debug to expand):
 - SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ARG "COMPOSER_AUTH") (line 33)
 Network demo_default Creating
 Network demo_default Created
 Volume demo_run Creating
 Volume demo_run Created
 Volume demo_pg_data Creating
 Volume demo_pg_data Created
 Volume demo_caddy_data Creating
 Volume demo_caddy_data Created
 Volume demo_caddy_config Creating
 Volume demo_caddy_config Created
 Volume demo_redis_data Creating
 Volume demo_redis_data Created
 Volume demo_storage Creating
 Volume demo_storage Created
 Volume demo_logs Creating
 Volume demo_logs Created
 Container demo-app-run-be6023e871c1 Creating
 Container demo-app-run-be6023e871c1 Created
 Container demo-redis-1 Creating
 Container demo-caddy-1 Creating
 Container demo-init-1 Creating
 Container demo-postgres-1 Creating
 Container demo-redis-1 Created
 Container demo-postgres-1 Created
 Container demo-app-role-1 Creating
 Container demo-init-1 Created
 Container demo-caddy-1 Created
 Container demo-app-role-1 Created
 Container demo-redis-1 Starting
 Container demo-init-1 Starting
 Container demo-postgres-1 Starting
 Container demo-caddy-1 Starting
 Container demo-redis-1 Started
 Container demo-postgres-1 Started
 Container demo-postgres-1 Waiting
 Container demo-init-1 Started
 Container demo-caddy-1 Started
 Container demo-postgres-1 Healthy
 Container demo-app-role-1 Starting
 Container demo-app-role-1 Started
 Container demo-postgres-1 Waiting
 Container demo-redis-1 Waiting
 Container demo-app-role-1 Waiting
 Container demo-init-1 Waiting
 Container demo-postgres-1 Healthy
 Container demo-init-1 Exited
 Container demo-app-role-1 Exited
 Container demo-redis-1 Healthy
 Container demo-app-run-3f47282b0b54 Creating
 Container demo-app-run-3f47282b0b54 Created
ℹ️ NOTICE (generate-ssl): SSL mode is off, so we won't generate a self-signed SSL key pair.

   INFO  Discovering packages.

  appsolutely/aio ....................................................... DONE
  diglactic/laravel-breadcrumbs ......................................... DONE
  laravel/ai ............................................................ DONE
  laravel/passport ...................................................... DONE
  laravel/reverb ........................................................ DONE
  laravel/sanctum ....................................................... DONE
  laravel/socialite ..................................................... DONE
  laravel/tinker ........................................................ DONE
  livewire/livewire ..................................................... DONE
  mcamara/laravel-localization .......................................... DONE
  nesbot/carbon ......................................................... DONE
  nunomaduro/termwind ................................................... DONE
  openai-php/laravel .................................................... DONE
  prettus/l5-repository ................................................. DONE
  spatie/eloquent-sortable .............................................. DONE
  spatie/laravel-data ................................................... DONE
  spatie/laravel-responsecache .......................................... DONE
  spatie/php-structure-discoverer ....................................... DONE

   INFO  Publishing [livewire:assets] assets.

  Copying directory [vendor/livewire/livewire/dist] to [public/vendor/livewire]  DONE

   INFO  Publishing [aio-assets] assets.

  Copying directory [vendor/appsolutely/aio/resources/assets/images] to [public/vendor/aio/images]  DONE

🤔 Checking for Laravel automations...
🚀 Clearing Laravel cache before attempting migrations...

   INFO  Configuration cache cleared successfully.

⚡️ Attempting connection to default database...
✅ Database connection successful

   INFO  Preparing database.

  Creating migration table ...................................... 27.27ms DONE

   INFO  Running migrations.

  0001_01_01_000000_create_users_table .......................... 25.65ms DONE
  0001_01_01_000001_create_cache_table .......................... 11.91ms DONE
  0001_01_01_000002_create_jobs_table ........................... 22.41ms DONE
  2016_06_01_000001_create_oauth_auth_codes_table ................ 6.54ms DONE
  2016_06_01_000002_create_oauth_access_tokens_table ............. 3.48ms DONE
  2016_06_01_000003_create_oauth_refresh_tokens_table ............ 4.80ms DONE
  2016_06_01_000004_create_oauth_clients_table ................... 9.55ms DONE
  2024_06_01_000001_create_oauth_device_codes_table .............. 8.42ms DONE
  2026_01_01_000001_add_reference_and_sort_deletes_to_teams_table  0.52ms DONE
  2026_01_01_000101_create_admin_tables ......................... 19.75ms DONE
  2026_01_01_000102_create_admin_settings_table .................. 5.44ms DONE
  2026_01_01_000103_create_files_table .......................... 13.73ms DONE
  2026_01_01_000104_create_file_attachments_table ............... 13.78ms DONE
  2026_01_01_000105_create_translations_table .................... 7.23ms DONE
  2026_01_01_000106_create_admin_menu_profiles_table ............ 10.56ms DONE
  2026_01_01_000107_create_admin_menu_items_table ................ 9.67ms DONE
  2026_01_01_000108_create_admin_menu_user_overrides_table ....... 7.40ms DONE
  2026_01_01_000109_create_admin_quick_actions_table ............. 8.18ms DONE
  2026_01_01_000110_create_admin_resource_audits_table ........... 4.94ms DONE
  2026_01_01_000111_create_admin_spa_jobs_table .................. 5.31ms DONE
  2026_01_01_000112_create_distributions_table ................... 4.13ms DONE
  2026_01_01_000113_create_admin_dashboard_preferences_table ..... 7.36ms DONE
  2026_01_01_000114_create_release_versions_table ................ 7.43ms DONE
  2026_01_01_000115_create_release_builds_table .................. 8.87ms DONE
  2026_01_01_000116_create_settings_table ........................ 5.61ms DONE
  2026_01_01_000117_create_agent_conversations_table ............. 8.95ms DONE
  2026_01_01_000118_create_personal_access_tokens_table .......... 9.70ms DONE
  2026_01_01_000119_create_forms_table .......................... 11.75ms DONE
  2026_01_01_000120_create_form_fields_table .................... 18.51ms DONE
  2026_01_01_000121_create_form_entries_table ................... 17.76ms DONE
  2026_01_01_000122_create_notification_templates_table ......... 13.49ms DONE
  2026_01_01_000123_create_notification_rules_table ............. 21.30ms DONE
  2026_01_01_000124_create_notification_queue_table ............. 11.94ms DONE
  2026_01_01_000125_create_notification_senders_table ........... 22.34ms DONE
  2026_01_01_000126_create_article_categories_table .............. 8.14ms DONE
  2026_01_01_000127_create_articles_table ........................ 8.60ms DONE
  2026_01_01_000128_create_article_category_pivot_table .......... 4.20ms DONE
  2026_01_01_000129_create_pages_table .......................... 12.89ms DONE
  2026_01_01_000130_create_page_block_groups_table ............... 4.74ms DONE
  2026_01_01_000131_create_page_blocks_table .................... 14.78ms DONE
  2026_01_01_000132_create_page_block_values_table .............. 18.99ms DONE
  2026_01_01_000133_create_page_block_settings_table ............ 16.80ms DONE
  2026_01_01_000134_create_menus_table .......................... 27.83ms DONE
  2026_01_01_000135_create_product_categories_table ............. 18.39ms DONE
  2026_01_01_000136_create_products_table ....................... 16.72ms DONE
  2026_01_01_000137_create_product_category_pivot_table ......... 18.78ms DONE
  2026_01_01_000138_create_product_skus_table ................... 26.21ms DONE
  2026_01_01_000139_create_product_attribute_groups_table ........ 8.40ms DONE
  2026_01_01_000140_create_product_attributes_table ............. 12.07ms DONE
  2026_01_01_000141_create_product_attribute_values_table ........ 6.23ms DONE
  2026_01_01_000142_create_product_attribute_group_pivot_table ... 6.93ms DONE
  2026_01_01_000143_create_product_sku_attribute_value_table ..... 9.07ms DONE
  2026_01_01_000144_create_product_images_table ................. 12.08ms DONE
  2026_01_01_000145_create_orders_table ......................... 20.47ms DONE
  2026_01_01_000146_create_order_items_table .................... 30.93ms DONE
  2026_01_01_000147_create_product_prices_table ................. 33.46ms DONE
  2026_01_01_000147_create_user_addresses_table ................. 20.30ms DONE
  2026_01_01_000148_create_order_payments_table ................. 18.51ms DONE
  2026_01_01_000149_create_order_shipments_table ................. 9.31ms DONE
  2026_01_01_000150_create_payments_table ....................... 15.14ms DONE
  2026_01_01_000151_create_order_status_histories_table ......... 16.06ms DONE
  2026_01_01_000152_create_delivery_tokens_table ................ 36.04ms DONE
  2026_01_01_000152_create_refund_requests_table ................ 20.79ms DONE
  2026_01_01_000153_create_refunds_table ......................... 9.82ms DONE
  2026_01_01_000154_create_carts_table .......................... 14.79ms DONE
  2026_01_01_000155_create_cart_items_table ..................... 37.64ms DONE
  2026_01_01_000156_create_inventory_movements_table ............ 14.15ms DONE
  2026_01_01_000157_create_wishlists_table ....................... 8.20ms DONE
  2026_01_01_000158_create_wishlist_items_table ................. 10.15ms DONE
  2026_01_01_000159_create_coupons_table ........................ 11.29ms DONE
  2026_01_01_000160_create_coupon_usages_table ................... 8.31ms DONE
  2026_01_01_000161_create_product_reviews_table ................ 11.32ms DONE
  2026_01_01_000162_create_shipping_zones_table ................. 12.23ms DONE
  2026_01_01_000163_create_shipping_rates_table .................. 7.88ms DONE
  2026_01_01_000164_create_tax_rates_table ...................... 72.38ms DONE
  2026_01_01_000165_create_webhook_subscriptions_table .......... 52.31ms DONE
  2026_01_01_000166_create_starter_content_records_table ......... 8.89ms DONE
  2026_01_01_000167_create_entitlements_table ................... 41.98ms DONE
  2026_01_01_000168_create_product_entitlements_table ........... 11.00ms DONE
  2026_01_01_000169_add_openid_columns_to_oauth_clients_table .... 6.62ms DONE
  2026_01_01_000170_create_social_accounts_table ................. 7.78ms DONE
  2026_01_01_000171_create_support_tickets_table ................ 19.74ms DONE
  2026_01_01_000172_create_support_ticket_messages_table ........ 10.22ms DONE
  2026_01_01_000173_create_support_ticket_message_files_table ... 14.85ms DONE
  2026_01_01_000174_create_product_subscription_terms_table ..... 10.05ms DONE
  2026_01_01_000177_create_subscriptions_table ................. 119.59ms DONE
  2026_01_01_000178_create_subscription_periods_table ........... 46.27ms DONE
  2026_08_01_000000_align_personal_access_tokens_with_sanctum .... 9.97ms DONE
  2026_09_06_000000_add_member_account_columns_to_users_table ... 30.50ms DONE
  2026_09_08_000000_create_payment_webhook_events_table ......... 34.49ms DONE
  2026_09_09_000000_create_order_operator_notices_table ......... 47.87ms DONE
  2026_09_10_000101_create_site_grants_table .................... 13.11ms DONE
  2026_09_10_000102_create_one_time_codes_table ................. 10.86ms DONE
  2026_09_10_000201_create_restore_drills_table .................. 8.88ms DONE
  2026_09_10_000202_create_alert_states_table ................... 10.37ms DONE
  2026_09_10_000300_create_site_domains_table ................... 16.78ms DONE
  2026_09_10_000301_create_site_exports_table .................... 6.26ms DONE
  2026_09_11_000000_create_account_closure_records_table ........ 11.56ms DONE
  2026_09_14_000500_create_customer_data_requests_table .......... 5.30ms DONE
  2026_09_14_000800_create_unmatched_settlements_table .......... 13.11ms DONE
  2026_09_16_000000_create_gateway_customers_table .............. 13.81ms DONE
  2026_09_22_000000_create_account_subject_names_table .......... 15.39ms DONE
  2026_09_26_000000_create_held_subscription_notices_table ....... 6.78ms DONE
  2026_09_28_000000_create_crash_projects_table .................. 9.90ms DONE
  2026_09_28_000000_create_product_views_table ................... 9.42ms DONE
  2026_09_28_000100_add_search_columns_to_product_attributes_table  9.35ms DONE
  2026_09_28_000100_create_crash_events_table .................... 9.02ms DONE
  2026_09_28_000101_create_product_attribute_value_product_table . 9.48ms DONE
  2026_09_28_000102_create_search_histories_table ................ 5.20ms DONE
  2026_09_30_000000_create_push_device_tokens_table ............. 11.14ms DONE
  2026_10_01_000100_create_sync_mutations_table ................. 11.67ms DONE
  2026_10_01_000101_create_sync_resets_table ..................... 5.94ms DONE
  2026_10_02_000000_create_site_search_entries_table ............. 7.71ms DONE
  2026_10_02_000001_add_trigram_indexes_to_site_search_entries_table  10.39ms DONE

🚀 Running optimize command: "php artisan optimize"...

   INFO  Caching framework bootstrap, configuration, and metadata.

  config ........................................................ 53.73ms DONE
  events ......................................................... 0.79ms DONE
  routes ........................................................ 69.33ms DONE
  views ........................................................ 185.07ms DONE
  laravel-data .................................................. 20.20ms DONE

   INFO  Discovering packages.

  appsolutely/aio ....................................................... DONE
  diglactic/laravel-breadcrumbs ......................................... DONE
  laravel/ai ............................................................ DONE
  laravel/passport ...................................................... DONE
  laravel/reverb ........................................................ DONE
  laravel/sanctum ....................................................... DONE
  laravel/socialite ..................................................... DONE
  laravel/tinker ........................................................ DONE
  livewire/livewire ..................................................... DONE
  mcamara/laravel-localization .......................................... DONE
  nesbot/carbon ......................................................... DONE
  nunomaduro/termwind ................................................... DONE
  openai-php/laravel .................................................... DONE
  prettus/l5-repository ................................................. DONE
  spatie/eloquent-sortable .............................................. DONE
  spatie/laravel-data ................................................... DONE
  spatie/laravel-responsecache .......................................... DONE
  spatie/php-structure-discoverer ....................................... DONE

   INFO  Configuration cached successfully.

   INFO  Routes cached successfully.

   INFO  Blade templates cached successfully.

   INFO  Events cached successfully.

Back up /var/www/html/.env somewhere other than this server.
  It holds the key everything encrypted in your database is encrypted under.
  Every backup archive carries a copy of this key, so a site restored from an archive can read its encrypted settings again.
  That makes each archive a secret: anyone holding one can decrypt this site's payment credentials, mail passwords and secret settings. Keep archives off this server and restrict who can read them as tightly as this file.
  Losing this file with no archive to restore from is not a recoverable incident: the database survives and its encrypted columns do not.

Publishing AIO resources...

   INFO  Publishing [aio-config] assets.

  File [config/aio.php] already exists ............................... SKIPPED

   INFO  Publishing [aio-assets] assets.

  Copying directory [vendor/appsolutely/aio/resources/assets/images] to [public/vendor/aio/images]  DONE

Running migrations...

   INFO  Nothing to migrate.

Scanned 0 row(s), 0 changed.
Seeding admin tables...

   INFO  Nothing to migrate.

   INFO  Seeding database.

  Appsolutely\AIO\Database\Seeders\Admin\AdminTablesSeeder ........... RUNNING
Synced 276 new permission(s); kept 0 existing.
  Appsolutely\AIO\Database\Seeders\Admin\AdminMenuDefaultSeeder ...... RUNNING
Created administrator role menu profile.
  + added item for resource: pages
  + added item for resource: articles
  + added item for resource: article-categories
  + added item for resource: page-block-groups
  + added item for resource: page-blocks
  + added item for resource: page-block-settings
  + added item for resource: file-attachments
  + added item for resource: media-files
  + added item for resource: product-categories
  + added item for resource: product-attributes
  + added item for resource: products
  + added item for resource: orders
  + added item for resource: refunds
  + added item for resource: refund-requests
  + added item for resource: unmatched-settlements
  + added item for resource: coupons
  + added item for resource: subscriptions
  + added item for resource: tax-rates
  + added item for resource: members
  + added item for resource: product-reviews
  + added item for resource: shipping-zones
  + added item for resource: inventory-movements
  + added item for resource: support-tickets
  + added item for resource: release-versions
  + added item for resource: release-builds
  + added item for resource: crash-projects
  + added item for resource: menus
  + added item for resource: forms
  + added item for resource: form-fields
  + added item for resource: form-entries
  + added item for resource: notification-templates
  + added item for resource: notification-senders
  + added item for resource: notification-rules
  + added item for resource: notification-queues
  + added item for resource: site-grants
  + added item for resource: administrators
  + added item for resource: roles
  + added item for resource: permissions
  + added item for resource: menu-profiles
  + added item for resource: quick-actions
  + added item for resource: settings
  + added item for resource: privacy-settings
  + added item for resource: starter-content
  + added item for resource: api-tokens
  + added item for resource: admin-sessions
  + added item for resource: site-domains
  + added item for resource: site-exports
  + added item for resource: oauth-clients
  + added item for resource: webhook-subscriptions
  + added item for resource: webhook-deliveries
Synced 50 new resource_list item(s) into profile [Administrator].
Seeded 5 menu-management permission slug(s); kept 10 existing.
  Appsolutely\AIO\Database\Seeders\Admin\AdminMenuDefaultSeeder .. 882 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\CmsMenuSeeder ............... RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\CmsMenuSeeder ............ 85 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\SettingSeeder ............... RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\SettingSeeder ........... 465 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\PageBlockSeeder ............. RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\PageBlockSeeder .......... 94 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\NotificationTemplateSeeder .. RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\NotificationTemplateSeeder  91 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\NotificationRuleSeeder ...... RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\NotificationRuleSeeder ... 39 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\NotificationSenderSeeder .... RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\NotificationSenderSeeder . 12 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\AdminTablesSeeder ..... 6,353 ms DONE

Admin seed complete: seeded the administrator, roles, permissions, menu, site settings, page blocks, notification senders, templates and rules.
Applied 'software/landing': 2 page(s) created, 0 updated, 0 skipped, 10 block(s) written.
.env.example already declares AIO keys; skipping append.

   INFO  Compiled views cleared successfully.

AIO install complete.

  Key fingerprint  sha256:a642fd12b2477a7e
  Not the key. Compare it after a restore: a bundle brought back under a different key opens none of its encrypted columns.

  Open it  http://localhost/aio/claim/<redacted>
  Good once, for 7 days. It signs you in and puts you on your own front page; set a password from there.
  The administrator account has no password, so this link is the only way in.
  Lost it, or did it expire? Run aio:install again for a new one; it replaces this one.

  Site     http://localhost
  Admin    http://localhost/admin

  Start it with:  composer run dev
 Volume demo_clamav_data Creating
 Volume demo_clamav_data Created
 Container demo-caddy-1 Recreate
 Container demo-postgres-1 Running
 Container demo-redis-1 Running
 Container demo-clamd-1 Creating
 Container demo-app-role-1 Recreate
 Container demo-clamd-1 Created
 Container demo-app-role-1 Recreated
 Container demo-caddy-1 Recreated
 Container demo-app-1 Creating
 Container demo-app-1 Created
 Container demo-scheduler-1 Creating
 Container demo-queue-1 Creating
 Container demo-scheduler-1 Created
 Container demo-queue-1 Created
 Container demo-clamd-1 Starting
 Container demo-init-1 Starting
 Container demo-postgres-1 Waiting
 Container demo-caddy-1 Starting
 Container demo-clamd-1 Started
 Container demo-postgres-1 Healthy
 Container demo-app-role-1 Starting
 Container demo-init-1 Started
 Container demo-caddy-1 Started
 Container demo-app-role-1 Started
 Container demo-app-role-1 Waiting
 Container demo-init-1 Waiting
 Container demo-postgres-1 Waiting
 Container demo-redis-1 Waiting
 Container demo-postgres-1 Healthy
 Container demo-redis-1 Healthy
 Container demo-init-1 Exited
 Container demo-app-role-1 Exited
 Container demo-app-1 Starting
 Container demo-app-1 Started
 Container demo-app-1 Waiting
 Container demo-app-role-1 Waiting
 Container demo-init-1 Waiting
 Container demo-postgres-1 Waiting
 Container demo-redis-1 Waiting
 Container demo-app-1 Waiting
 Container demo-app-role-1 Waiting
 Container demo-init-1 Waiting
 Container demo-postgres-1 Waiting
 Container demo-redis-1 Waiting
 Container demo-redis-1 Healthy
 Container demo-redis-1 Healthy
 Container demo-postgres-1 Healthy
 Container demo-app-role-1 Exited
 Container demo-init-1 Exited
 Container demo-init-1 Exited
 Container demo-postgres-1 Healthy
 Container demo-app-role-1 Exited
 Container demo-app-1 Healthy
 Container demo-queue-1 Starting
 Container demo-app-1 Healthy
 Container demo-scheduler-1 Starting
 Container demo-scheduler-1 Started
 Container demo-queue-1 Started
 Container demo-caddy-1 Running
 Container demo-redis-1 Running
 Container demo-postgres-1 Running
 Container demo-app-1 Running
 Container demo-init-1 Starting
 Container demo-postgres-1 Waiting
 Container demo-postgres-1 Healthy
 Container demo-app-role-1 Starting
 Container demo-init-1 Started
 Container demo-app-role-1 Started
 Container demo-app-role-1 Waiting
 Container demo-init-1 Waiting
 Container demo-postgres-1 Waiting
 Container demo-redis-1 Waiting
 Container demo-redis-1 Healthy
 Container demo-init-1 Exited
 Container demo-postgres-1 Healthy
 Container demo-app-role-1 Exited
 Container demo-postgres-1 Waiting
 Container demo-app-role-1 Waiting
 Container demo-caddy-1 Waiting
 Container demo-redis-1 Waiting
 Container demo-init-1 Waiting
 Container demo-app-1 Waiting
 Container demo-app-role-1 Exited
 Container demo-caddy-1 Healthy
 Container demo-init-1 Exited
 Container demo-postgres-1 Healthy
 Container demo-redis-1 Healthy
 Container demo-app-1 Healthy
Serving https://localhost

$ docker compose --project-directory deploy -f deploy/compose.yaml ps --format {{.Service}}: {{.Status}}
app: Up 13 seconds (healthy)
caddy: Up 15 seconds
clamd: Up 15 seconds (health: starting)
postgres: Up About a minute (healthy)
queue: Up 4 seconds (health: starting)
redis: Up About a minute (healthy)
scheduler: Up 4 seconds (health: starting)

$ docker compose --project-directory deploy -f deploy/compose.yaml exec -T caddy cat /data/caddy/pki/authorities/local/root.crt > ../caddy-root.crt

$ curl -sS --cacert ../caddy-root.crt https://localhost/ | grep -oE "<title>[^<]*</title>|<h1[^>]*>[^<]*"
<title>Home | Appsolutely</title>
<h1 class="display-4 fw-bold mb-3">Track the hours. Send the invoice. Get paid.

$ npx --yes --package=../../appsolutely-cli-0.1.0.tgz appsolutely deploy   # again: installed, aio reports software/landing
Serving https://localhost

$ npx --yes --package=../../appsolutely-cli-0.1.0.tgz appsolutely generate-sdk --lang ts --sdk-source ../../sdk-at-aio-v0.6.0
? Verifying lockfile against supply-chain policies (44 entries)...
Progress: resolved 44, reused 0, downloaded 31, added 0
✓ Lockfile passes supply-chain policies (44 entries in 8.3s)
Lockfile is up to date, resolution step is skipped
Packages: +44
++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 44, reused 0, downloaded 44, added 44, done

dependencies:
+ openapi-fetch 0.17.0

devDependencies:
+ @seriousme/openapi-schema-validator 2.11.0
+ @types/node 24.19.0
+ openapi-typescript 7.13.0
+ prettier 3.9.9
+ typescript 5.9.3
+ yaml 2.9.1

Done in 9.9s using pnpm v12.8.1
$ node scripts/generate.ts --check
src/generated/schema.ts is not what spec/openapi.yaml generates; run pnpm generate.
[ELIFECYCLE] Command failed with exit code 1.
$ node scripts/generate.ts
Wrote src/generated/schema.ts.
. prepack$ pnpm build
. prepack: $ node scripts/clean.ts && tsc -p tsconfig.build.json
. prepack: Done
package: @appsolutely/sdk@0.1.0
Tarball Contents
dist/client.d.ts
dist/client.js
dist/generated/schema.d.ts
dist/generated/schema.js
dist/index.d.ts
dist/index.js
LICENSE
package.json
README.md
Tarball Details
/tmp/appsolutely-generate-sdk-kpGAfp/packed/appsolutely-sdk-0.1.0.tgz
Wrote /var/www/appsolutely/cli-e2e/final/demo/appsolutely-sdk.tgz: a client for the document https://localhost serves, which differs from the one @appsolutely/sdk 0.1.0 was generated from.
Install it with: npm install ./appsolutely-sdk.tgz

$ sha256sum appsolutely-sdk.tgz ../../reference/appsolutely-sdk-0.1.0.tgz
0ae03a79f6a5ff9046a99489c0d817fe64dfd498f157268a06a7ce687e67dd2e  appsolutely-sdk.tgz
7b4a09117e26e1e564a4afc0b3285987925c889418829a676609181e926beb0a  ../../reference/appsolutely-sdk-0.1.0.tgz

$ mkdir -p /tmp/generated /tmp/published

$ tar -xzf appsolutely-sdk.tgz -C /tmp/generated --strip-components=1

$ tar -xzf ../../reference/appsolutely-sdk-0.1.0.tgz -C /tmp/published --strip-components=1

$ diff -r /tmp/published /tmp/generated
--- /tmp/published/dist/generated/schema.d.ts
+++ /tmp/generated/dist/generated/schema.d.ts
@@ -69,6 +69,40 @@
         patch: operations["updateArticle"];
         trace?: never;
     };
+    "/api/v1/auth/magic-link": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        get?: never;
+        put?: never;
+        /** Request magic link */
+        post: operations["requestMagicLink"];
+        delete?: never;
+        options?: never;
+        head?: never;
+        patch?: never;
+        trace?: never;
+    };
+    "/api/v1/auth/magic-link/token": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        get?: never;
+        put?: never;
+        /** Token magic link */
+        post: operations["tokenMagicLink"];
+        delete?: never;
+        options?: never;
+        head?: never;
+        patch?: never;
+        trace?: never;
+    };
     "/api/v1/form-entries": {
         parameters: {
             query?: never;
@@ -361,6 +395,127 @@
         patch?: never;
         trace?: never;
     };
+    "/api/v1/sync/articles": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        /** Pull sync.articles */
+        get: operations["pullSync.article"];
+        put?: never;
+        /** Push sync.articles */
+        post: operations["pushSync.article"];
+        delete?: never;
+        options?: never;
+        head?: never;
+        patch?: never;
+        trace?: never;
+    };
+    "/api/v1/sync/form-entries": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        /** Pull sync.form entries */
+        get: operations["pullSync.formEntry"];
+        put?: never;
+        post?: never;
+        delete?: never;
+        options?: never;
+        head?: never;
+        patch?: never;
+        trace?: never;
+    };
+    "/api/v1/sync/me-addresses": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        /** Pull sync.me addresses */
+        get: operations["pullSync.meAddress"];
+        put?: never;
+        /** Push sync.me addresses */
+        post: operations["pushSync.meAddress"];
+        delete?: never;
+        options?: never;
+        head?: never;
+        patch?: never;
+        trace?: never;
+    };
+    "/api/v1/sync/me-orders": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        /** Pull sync.me orders */
+        get: operations["pullSync.meOrder"];
+        put?: never;
+        post?: never;
+        delete?: never;
+        options?: never;
+        head?: never;
+        patch?: never;
+        trace?: never;
+    };
+    "/api/v1/sync/orders": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        /** Pull sync.orders */
+        get: operations["pullSync.order"];
+        put?: never;
+        post?: never;
+        delete?: never;
+        options?: never;
+        head?: never;
+        patch?: never;
+        trace?: never;
+    };
+    "/api/v1/sync/pages": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        /** Pull sync.pages */
+        get: operations["pullSync.page"];
+        put?: never;
+        post?: never;
+        delete?: never;
+        options?: never;
+        head?: never;
+        patch?: never;
+        trace?: never;
+    };
+    "/api/v1/sync/products": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        /** Pull sync.products */
+        get: operations["pullSync.product"];
+        put?: never;
+        post?: never;
+        delete?: never;
+        options?: never;
+        head?: never;
+        patch?: never;
+        trace?: never;
+    };
     "/api/v1/webhook-subscriptions/{subscription}/deliveries": {
         parameters: {
             query?: never;
@@ -403,9 +558,8 @@
             /** @constant */
             status: true;
             message: string;
-            data: {
-                [key: string]: unknown;
-            } | null;
+            /** @description Any JSON value: an object, a list or null. The route declares no resource shape. */
+            data: unknown;
         };
         ApiError: {
             /** @constant */
@@ -484,6 +638,16 @@
             message: string;
             data: components["schemas"]["FormEntry"];
         };
+        MagicLinkPayload: {
+            email: string;
+            abilities: ("me:read" | "me:write" | "me-orders:read" | "me-addresses:read" | "me-addresses:write" | "me-entitlements:read" | "me-push-devices:write")[];
+            device_name: string;
+            code_challenge: string;
+        };
+        MagicLinkTokenPayload: {
+            link: string;
+            code_verifier: string;
+        };
         Order: {
             id: number;
             reference: string;
@@ -648,6 +812,9 @@
                 [key: string]: unknown;
             };
         };
+        SyncPushPayload: {
+            mutations: unknown[];
+        };
         UnregisterMePushDevicePayload: {
             token: string;
         };
@@ -731,6 +898,8 @@
 export type FormEntry = components['schemas']['FormEntry'];
 export type FormEntryListResponse = components['schemas']['FormEntryListResponse'];
 export type FormEntryResponse = components['schemas']['FormEntryResponse'];
+export type MagicLinkPayload = components['schemas']['MagicLinkPayload'];
+export type MagicLinkTokenPayload = components['schemas']['MagicLinkTokenPayload'];
 export type Order = components['schemas']['Order'];
 export type OrderLineSummary = components['schemas']['OrderLineSummary'];
 export type OrderListResponse = components['schemas']['OrderListResponse'];
@@ -746,6 +915,7 @@
 export type StoreArticlePayload = components['schemas']['StoreArticlePayload'];
 export type StoreMeAddressPayload = components['schemas']['StoreMeAddressPayload'];
 export type StoreMePushDevicePayload = components['schemas']['StoreMePushDevicePayload'];
+export type SyncPushPayload = components['schemas']['SyncPushPayload'];
 export type UnregisterMePushDevicePayload = components['schemas']['UnregisterMePushDevicePayload'];
 export type UpdateArticlePayload = components['schemas']['UpdateArticlePayload'];
 export type UpdateMeAddressPayload = components['schemas']['UpdateMeAddressPayload'];
@@ -1054,6 +1224,54 @@
             };
         };
     };
+    requestMagicLink: {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody: {
+            content: {
+                "application/json": components["schemas"]["MagicLinkPayload"];
+            };
+        };
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
+                };
+            };
+        };
+    };
+    tokenMagicLink: {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody: {
+            content: {
+                "application/json": components["schemas"]["MagicLinkTokenPayload"];
+            };
+        };
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
+                };
+            };
+        };
+    };
     listFormEntries: {
         parameters: {
             query?: {
@@ -1690,13 +1908,15 @@
         };
         requestBody?: never;
         responses: {
-            /** @description Success */
+            /** @description The OpenAPI document of this version */
             200: {
                 headers: {
                     [name: string]: unknown;
                 };
                 content: {
-                    "application/json": components["schemas"]["ApiEnvelope"];
+                    "application/json": {
+                        [key: string]: unknown;
+                    };
                 };
             };
         };
@@ -2081,6 +2301,194 @@
                 };
                 content: {
                     "application/json": components["schemas"]["ApiError"];
+                };
+            };
+        };
+    };
+    "pullSync.article": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody?: never;
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
+                };
+            };
+        };
+    };
+    "pushSync.article": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody: {
+            content: {
+                "application/json": components["schemas"]["SyncPushPayload"];
+            };
+        };
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
+                };
+            };
+        };
+    };
+    "pullSync.formEntry": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody?: never;
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
+                };
+            };
+        };
+    };
+    "pullSync.meAddress": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody?: never;
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
+                };
+            };
+        };
+    };
+    "pushSync.meAddress": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody: {
+            content: {
+                "application/json": components["schemas"]["SyncPushPayload"];
+            };
+        };
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
+                };
+            };
+        };
+    };
+    "pullSync.meOrder": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody?: never;
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
+                };
+            };
+        };
+    };
+    "pullSync.order": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody?: never;
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
+                };
+            };
+        };
+    };
+    "pullSync.page": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody?: never;
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
+                };
+            };
+        };
+    };
+    "pullSync.product": {
+        parameters: {
+            query?: never;
+            header?: never;
+            path?: never;
+            cookie?: never;
+        };
+        requestBody?: never;
+        responses: {
+            /** @description Success */
+            200: {
+                headers: {
+                    [name: string]: unknown;
+                };
+                content: {
+                    "application/json": components["schemas"]["ApiEnvelope"];
                 };
             };
         };
--- /tmp/published/package.json
+++ /tmp/generated/package.json
@@ -31,11 +31,8 @@
   },
   "appsolutely": {
     "spec": {
-      "repository": "<aio repository>",
-      "path": "docs/api/openapi.yaml",
-      "tag": "v0.6.0",
-      "commit": "06d37e8384f949b1d2dc720da2fd5a57cf846040",
-      "sha256": "bef3ca8e27762dbf5081c0389f182d5200d95c953adaec06e47060cb3dab878e"
+      "source": "https://localhost/api/v1/openapi.json",
+      "sha256": "3a027fa6f61145037d86987118462ebf66f7416d51f903c618c7cff735a9101f"
     }
   },
   "dependencies": {
```

## Part A, continued: generate-sdk against the same revision, signing key, Expo app

```console
$ npx --yes --package=../../appsolutely-cli-0.1.0.tgz appsolutely generate-sdk --lang ts --sdk-source ../../sdk-at-aio-v0.7.0 --force
? Verifying lockfile against supply-chain policies (44 entries)...
Progress: resolved 44, reused 0, downloaded 10, added 0
Progress: resolved 44, reused 0, downloaded 32, added 0
Progress: resolved 44, reused 0, downloaded 32, added 4
Progress: resolved 44, reused 0, downloaded 32, added 15
Progress: resolved 44, reused 0, downloaded 44, added 38
Progress: resolved 44, reused 0, downloaded 44, added 42
✓ Lockfile passes supply-chain policies (44 entries in 12.5s)
Lockfile is up to date, resolution step is skipped
Packages: +44
++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 44, reused 0, downloaded 44, added 44, done

dependencies:
+ openapi-fetch 0.17.0

devDependencies:
+ @seriousme/openapi-schema-validator 2.11.0
+ @types/node 24.19.0
+ openapi-typescript 7.13.0
+ prettier 3.9.9
+ typescript 5.9.3
+ yaml 2.9.1

Done in 13.4s using pnpm v12.8.1
$ node scripts/generate.ts --check
$ node scripts/generate.ts
Wrote src/generated/schema.ts.
. prepack$ pnpm build
. prepack: $ node scripts/clean.ts && tsc -p tsconfig.build.json
. prepack: Done
package: @appsolutely/sdk@0.1.0
Tarball Contents
dist/client.d.ts
dist/client.js
dist/generated/schema.d.ts
dist/generated/schema.js
dist/index.d.ts
dist/index.js
LICENSE
package.json
README.md
Tarball Details
/tmp/appsolutely-generate-sdk-gNNmbD/packed/appsolutely-sdk-0.1.0.tgz
Wrote /var/www/appsolutely/cli-e2e/final/demo/appsolutely-sdk.tgz: @appsolutely/sdk 0.1.0, byte for byte, generated from aio v0.7.0 — the document https://localhost serves.
Install it with: npm install ./appsolutely-sdk.tgz

$ sha256sum appsolutely-sdk.tgz ../../reference-v0.7.0/appsolutely-sdk-0.1.0.tgz
f53d70e897ac989d961b1887c27a27367a75a4d5e7d0a4057ff07f21275e89f9  appsolutely-sdk.tgz
f53d70e897ac989d961b1887c27a27367a75a4d5e7d0a4057ff07f21275e89f9  ../../reference-v0.7.0/appsolutely-sdk-0.1.0.tgz

$ mkdir -p /tmp/generated /tmp/published

$ tar -xzf appsolutely-sdk.tgz -C /tmp/generated --strip-components=1

$ tar -xzf ../../reference-v0.7.0/appsolutely-sdk-0.1.0.tgz -C /tmp/published --strip-components=1

$ diff -r /tmp/published /tmp/generated
(no difference)

$ docker compose --project-directory deploy -f deploy/compose.yaml exec -T app php artisan aio:release:generate-signing-key > ../signing-keys.env
(written, not shown: it holds the private key)

$ docker compose --project-directory deploy -f deploy/compose.yaml exec -T app php artisan aio:release:distribution demo-desktop --name Demo Desktop
Demo Desktop (demo-desktop): default channel stable, floor none.

$ npm exec --yes --package=../create-appsolutely-expo-app-0.1.0.tgz -- create-appsolutely-expo-app mobile --install-url https://localhost --sdk ./demo/appsolutely-sdk.tgz
Created an Expo app in mobile, talking to https://localhost.
npm warn deprecated uuid@7.0.3: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).

added 470 packages, and audited 471 packages in 4m

45 packages are looking for funding
  run `npm fund` for details

12 vulnerabilities (8 moderate, 4 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.

Next:
  cd mobile
  npx expo start

The screen shows the API version the install serves. To list its articles, issue a token on the
install with `php artisan aio:api:token` (ability articles:read) and type it into the screen.

$ cd mobile && npx tsc --noEmit
(no errors)

$ cat expo-round-trip.mts
// Calls the install the way the app's screen does, through the app's own src/api.ts.
import { connect, getApiVersion } from './mobile/src/api.ts';
import config from './mobile/app.json' with { type: 'json' };

const version = await getApiVersion(connect(config.expo.extra.appsolutelyUrl));
console.log(JSON.stringify(version));

$ node expo-round-trip.mts
(node:516) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///var/www/appsolutely/cli-e2e/final/mobile/src/api.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /var/www/appsolutely/cli-e2e/final/mobile/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
{"version":"v1","status":"current","deprecation":null,"sunset":null,"successor":null,"documentation":null}
```

## Part B: the desktop app (development machine)

```console
$ node --version
v26.10.0

$ cargo --version
cargo 1.99.0 (5f94df478 2026-08-27) (Homebrew)

$ npm exec --yes --package=../create-appsolutely-tauri-app-0.1.0.tgz -- create-appsolutely-tauri-app myapp --install-url https://localhost --distribution demo-desktop --public-key "$AIO_RELEASE_SIGNING_PUBLIC_KEY"
Created myapp in <workdir>/final/myapp.
Updater endpoint: https://localhost/api/tauri/updates/demo-desktop/{{target}}-{{arch}}/{{current_version}}
The updater settings are in src-tauri/tauri.distribution.conf.json, which git ignores; the release workflow writes its own from repository variables.

Next steps:
  cd myapp
  pnpm install

  Register the app on the install once, from its application directory:
    php artisan aio:release:distribution demo-desktop --name=myapp

  Build a signed release with the updater settings, the signing key in the environment:
    TAURI_SIGNING_PRIVATE_KEY=... TAURI_SIGNING_PRIVATE_KEY_PASSWORD=... \
      pnpm tauri build --config src-tauri/tauri.distribution.conf.json

  The release workflow (.github/workflows/release.yml) reads these repository variables:
    APPSOLUTELY_INSTALL_URL=https://localhost
    APPSOLUTELY_DISTRIBUTION=demo-desktop
    APPSOLUTELY_CHANNEL
    APPSOLUTELY_UPDATER_PUBLIC_KEY=dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXkgOURCNEYyNDA2MDU1OTc5RQpSV1NlbDFWZ1FQSzBuY2ZpYnIrVVpxUkFLaXViNTZQLzZITVVCNTQ4cUF5VTdLOGpQOGZBczZycAo=
    APPSOLUTELY_PUBLISH_SSH_HOST
    APPSOLUTELY_ARTISAN_PATH
    APPSOLUTELY_UPLOAD_DIR
    APPSOLUTELY_PUBLISH_SSH_KNOWN_HOSTS
  and these repository secrets:
    TAURI_SIGNING_PRIVATE_KEY
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD
    APPLE_CERTIFICATE
    APPLE_CERTIFICATE_PASSWORD
    APPLE_SIGNING_IDENTITY
    APPLE_ID
    APPLE_PASSWORD
    APPLE_TEAM_ID
    APPSOLUTELY_PUBLISH_SSH_KEY

$ pnpm install --frozen-lockfile
[WARN] The store at ~/Library/pnpm/store/v11 is not used because packages cannot be hard linked from it into this project. Using the store at <pnpm store>/v11 instead. Set storeDir to choose the store.
✓ Lockfile passes supply-chain policies (verified 1d ago)
Lockfile is up to date, resolution step is skipped
Packages are cloned from the content-addressable store to the virtual store.
Packages: +286
++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 286, reused 286, downloaded 0, added 286, done

dependencies:
+ @tailwindcss/vite 4.2.1
+ @tauri-apps/api 2.10.1
+ @tauri-apps/plugin-global-shortcut 2.3.1
+ @tauri-apps/plugin-opener 2.5.3
+ @tauri-apps/plugin-process 2.3.1
+ @tauri-apps/plugin-updater 2.10.0
+ class-variance-authority 0.7.1
+ clsx 2.1.1
+ i18next 25.8.18
+ i18next-browser-languagedetector 8.2.1
+ lucide-react 0.577.0
+ next-themes 0.4.6
+ radix-ui 1.4.3
+ react 19.2.4
+ react-dom 19.2.4
+ react-i18next 16.5.8
+ sonner 2.0.7
+ tailwind-merge 3.5.0
+ tailwindcss 4.2.1

devDependencies:
+ @eslint/js 9.39.4
+ @tauri-apps/cli 2.10.1
+ @types/node 25.5.0
+ @types/react 19.2.14
+ @types/react-dom 19.2.3
+ @vitejs/plugin-react 4.7.0
+ eslint 9.39.4
+ eslint-plugin-react-hooks 7.0.1
+ globals 16.5.0
+ prettier 3.8.1
+ prettier-plugin-tailwindcss 0.7.2
+ typescript 5.8.3
+ typescript-eslint 8.57.1
+ vite 7.3.1

Done in 677ms using pnpm v12.8.1

$ TAURI_SIGNING_PRIVATE_KEY=… TAURI_SIGNING_PRIVATE_KEY_PASSWORD=… pnpm tauri build --bundles app --config src-tauri/tauri.distribution.conf.json
$ tauri build --bundles app --config src-tauri/tauri.distribution.conf.json
        Info Looking up installed tauri packages to check mismatched versions...
     Running beforeBuildCommand `pnpm build`
$ tsc && vite build
vite v7.3.1 building client environment for production...
(node:35853) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
transforming...
✓ 1927 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                0.47 kB │ gzip:  0.31 kB
dist/assets/react-CHdo91hT.svg                 4.13 kB │ gzip:  2.14 kB
dist/assets/index-DVVjf0Pu.css                34.99 kB │ gzip:  6.72 kB
dist/assets/shortcut-BxrDwxK3.js               2.81 kB │ gzip:  1.34 kB
dist/assets/about-Bq3k2OzI.js                  3.41 kB │ gzip:  1.47 kB
dist/assets/settings-DFhZFoIT.js               7.88 kB │ gzip:  2.98 kB
dist/assets/home-DQMnPFkL.js                  15.91 kB │ gzip:  6.34 kB
dist/assets/updater-dialog-PkRHpVqa.js        38.39 kB │ gzip: 13.34 kB
dist/assets/use-app-translation-nG-1ZakE.js   81.03 kB │ gzip: 25.08 kB
dist/assets/index-NzbH7K3W.js                272.06 kB │ gzip: 85.55 kB
✓ built in 1.10s
   Compiling proc-macro2 v1.0.106
   Compiling quote v1.0.45
   Compiling unicode-ident v1.0.24
   Compiling libc v0.2.183
   Compiling cfg-if v1.0.4
   Compiling serde_core v1.0.228
   Compiling zerocopy v0.8.42
   Compiling shlex v1.3.0
   Compiling find-msvc-tools v0.1.9
   Compiling icu_properties_data v2.1.2
   Compiling zmij v1.0.21
   Compiling cc v1.2.57
   Compiling icu_normalizer_data v2.1.1
   Compiling serde v1.0.228
   Compiling stable_deref_trait v1.2.1
   Compiling siphasher v1.0.2
   Compiling memchr v2.8.0
   Compiling phf_shared v0.11.3
   Compiling smallvec v1.15.1
   Compiling itoa v1.0.17
   Compiling siphasher v0.3.11
   Compiling thiserror v2.0.18
   Compiling getrandom v0.1.16
   Compiling typeid v1.0.3
   Compiling litemap v0.8.1
   Compiling getrandom v0.2.17
   Compiling serde_json v1.0.149
   Compiling strsim v0.11.1
   Compiling erased-serde v0.4.10
   Compiling rand_core v0.6.4
   Compiling writeable v0.6.2
   Compiling thiserror v1.0.69
   Compiling getrandom v0.4.2
   Compiling ident_case v1.0.1
   Compiling syn v2.0.117
   Compiling rand_core v0.5.1
   Compiling syn v1.0.109
   Compiling rand_pcg v0.2.1
   Compiling phf_shared v0.8.0
   Compiling anyhow v1.0.102
   Compiling proc-macro-hack v0.5.20+deprecated
   Compiling parking_lot_core v0.9.12
   Compiling phf_shared v0.10.0
   Compiling byteorder v1.5.0
   Compiling scopeguard v1.2.0
   Compiling new_debug_unreachable v1.0.6
   Compiling lock_api v0.4.14
   Compiling winnow v0.7.15
   Compiling mac v0.1.1
   Compiling bitflags v2.11.0
   Compiling precomputed-hash v0.1.1
   Compiling parking_lot v0.12.5
   Compiling futf v0.1.5
   Compiling semver v1.0.27
   Compiling toml_datetime v0.7.5+spec-1.1.0
   Compiling serde_spanned v1.0.4
   Compiling objc2-exception-helper v0.1.1
   Compiling utf-8 v0.7.6
   Compiling dtoa v1.0.11
   Compiling bitflags v1.3.2
   Compiling time-core v0.1.8
   Compiling utf8_iter v1.0.4
   Compiling log v0.4.29
   Compiling percent-encoding v2.3.2
   Compiling toml_writer v1.0.6+spec-1.1.0
   Compiling autocfg v1.5.0
   Compiling num-conv v0.2.0
   Compiling form_urlencoded v1.2.2
   Compiling dtoa-short v0.3.5
   Compiling tendril v0.4.3
   Compiling uuid v1.22.0
   Compiling indexmap v1.9.3
   Compiling aho-corasick v1.1.4
   Compiling nodrop v0.1.14
   Compiling ppv-lite86 v0.2.21
   Compiling camino v1.2.2
   Compiling alloc-no-stdlib v2.0.4
   Compiling convert_case v0.4.0
   Compiling regex-syntax v0.8.10
   Compiling equivalent v1.0.2
   Compiling rand_chacha v0.3.1
   Compiling rand_chacha v0.2.2
   Compiling toml_parser v1.0.9+spec-1.1.0
   Compiling unic-common v0.9.0
   Compiling rand v0.7.3
   Compiling rand v0.8.5
   Compiling unic-char-range v0.9.0
   Compiling matches v0.1.10
   Compiling hashbrown v0.16.1
   Compiling toml v0.9.12+spec-1.1.0
   Compiling synstructure v0.13.2
   Compiling darling_core v0.23.0
   Compiling phf_generator v0.11.3
   Compiling string_cache_codegen v0.5.4
   Compiling phf_codegen v0.11.3
   Compiling phf_generator v0.8.0
   Compiling phf_generator v0.10.0
   Compiling phf_codegen v0.8.0
   Compiling indexmap v2.13.0
   Compiling serde_derive_internals v0.29.1
   Compiling selectors v0.24.0
   Compiling markup5ever v0.14.1
   Compiling regex-automata v0.4.14
   Compiling unic-char-property v0.9.0
   Compiling unic-ucd-version v0.9.0
   Compiling zerofrom-derive v0.1.6
   Compiling serde_derive v1.0.228
   Compiling yoke-derive v0.8.1
   Compiling zerovec-derive v0.11.2
   Compiling displaydoc v0.2.5
   Compiling thiserror-impl v2.0.18
   Compiling phf_macros v0.11.3
   Compiling thiserror-impl v1.0.69
   Compiling phf_macros v0.10.0
   Compiling cssparser v0.29.6
   Compiling zerofrom v0.1.6
   Compiling phf v0.11.3
   Compiling darling_macro v0.23.0
   Compiling yoke v0.8.1
   Compiling ctor v0.2.9
   Compiling darling v0.23.0
   Compiling cssparser-macros v0.6.1
   Compiling phf v0.10.1
   Compiling match_token v0.1.0
   Compiling derive_more v0.99.20
   Compiling serde_with_macros v3.18.0
   Compiling zerovec v0.11.5
   Compiling zerotrie v0.2.3
   Compiling alloc-stdlib v0.2.2
   Compiling servo_arc v0.2.0
   Compiling fxhash v0.2.1
   Compiling phf v0.8.0
   Compiling hashbrown v0.12.3
   Compiling fnv v1.0.7
   Compiling tinystr v0.8.2
   Compiling potential_utf v0.1.4
   Compiling objc2 v0.6.4
   Compiling icu_collections v2.1.1
   Compiling icu_locale_core v2.1.1
   Compiling schemars v0.8.22
   Compiling cfb v0.7.3
   Compiling string_cache v0.8.9
   Compiling cargo-platform v0.1.9
   Compiling swift-rs v1.0.7
   Compiling icu_provider v2.1.1
   Compiling jsonptr v0.6.3
   Compiling icu_properties v2.1.2
   Compiling icu_normalizer v2.1.1
   Compiling brotli-decompressor v5.0.0
   Compiling regex v1.12.3
   Compiling schemars_derive v0.8.22
   Compiling unic-ucd-ident v0.9.0
   Compiling same-file v1.0.6
   Compiling html5ever v0.29.1
   Compiling dyn-clone v1.0.20
   Compiling objc2-encode v4.1.0
   Compiling base64 v0.21.7
   Compiling bytes v1.11.1
   Compiling dunce v1.0.5
   Compiling brotli v8.0.2
   Compiling idna_adapter v1.2.1
   Compiling idna v1.1.0
   Compiling walkdir v2.5.0
   Compiling json-patch v3.0.1
   Compiling cargo_metadata v0.19.2
   Compiling http v1.4.0
   Compiling infer v0.19.0
   Compiling serde-untagged v0.1.9
   Compiling url v2.5.8
   Compiling serde_with v3.18.0
   Compiling glob v0.3.3
   Compiling kuchikiki v0.8.8-speedreader
   Compiling once_cell v1.21.4
   Compiling urlpattern v0.3.0
   Compiling version_check v0.9.5
   Compiling powerfmt v0.2.0
   Compiling deranged v0.5.8
   Compiling objc2-core-foundation v0.3.2
   Compiling block2 v0.6.2
   Compiling quick-xml v0.38.4
   Compiling crc32fast v1.5.0
   Compiling base64 v0.22.1
   Compiling pin-project-lite v0.2.17
   Compiling time v0.3.47
   Compiling objc2-foundation v0.3.2
   Compiling rustc_version v0.4.1
   Compiling tauri-utils v2.8.3
   Compiling option-ext v0.2.0
   Compiling embed-resource v3.0.7
   Compiling dirs-sys v0.5.0
   Compiling heck v0.5.0
   Compiling tauri-winres v0.3.5
   Compiling dirs v6.0.0
   Compiling cargo_toml v0.22.3
   Compiling socket2 v0.6.3
   Compiling plist v1.8.0
   Compiling mio v1.1.1
   Compiling core-foundation-sys v0.8.7
   Compiling typenum v1.19.0
   Compiling generic-array v0.14.7
   Compiling tokio v1.50.0
   Compiling crossbeam-utils v0.8.21
   Compiling core-foundation v0.10.1
   Compiling simd-adler32 v0.3.8
   Compiling dpi v0.1.2
   Compiling time-macros v0.2.27
   Compiling adler2 v2.0.1
   Compiling futures-core v0.3.32
   Compiling miniz_oxide v0.8.9
   Compiling crossbeam-channel v0.5.15
   Compiling cookie v0.18.1
   Compiling raw-window-handle v0.6.2
   Compiling flate2 v1.1.9
   Compiling crypto-common v0.1.7
   Compiling block-buffer v0.10.4
   Compiling fdeflate v0.3.7
   Compiling foreign-types-macros v0.2.3
   Compiling tauri-build v2.5.6
   Compiling tauri-plugin v2.5.4
   Compiling ring v0.17.14
   Compiling foreign-types-shared v0.3.1
   Compiling unicode-segmentation v1.12.0
   Compiling keyboard-types v0.7.0
   Compiling foreign-types v0.5.0
   Compiling png v0.17.16
   Compiling tauri v2.10.3
   Compiling digest v0.10.7
   Compiling core-graphics-types v0.2.0
   Compiling cpufeatures v0.2.17
   Compiling wry v0.54.3
   Compiling objc2-app-kit v0.3.2
   Compiling tauri-runtime v2.10.1
   Compiling sha2 v0.10.9
   Compiling core-graphics v0.25.0
   Compiling ico v0.5.0
   Compiling dispatch2 v0.3.1
   Compiling tauri-runtime-wry v2.10.1
   Compiling zeroize v1.8.2
   Compiling getrandom v0.3.4
   Compiling untrusted v0.9.0
   Compiling rustls-pki-types v1.14.0
   Compiling tauri-codegen v2.5.5
   Compiling http-body v1.0.1
   Compiling objc2-core-graphics v0.3.2
   Compiling futures-macro v0.3.32
   Compiling serialize-to-javascript-impl v0.1.2
   Compiling futures-task v0.3.32
   Compiling httparse v1.10.1
   Compiling slab v0.4.12
   Compiling rustls v0.23.37
   Compiling futures-util v0.3.32
   Compiling rustls-webpki v0.103.9
   Compiling serialize-to-javascript v0.1.2
   Compiling tauri-macros v2.5.5
   Compiling tracing-core v0.1.36
   Compiling serde_repr v0.1.20
   Compiling tracing-attributes v0.1.31
   Compiling try-lock v0.2.5
   Compiling rustix v1.1.4
   Compiling embed_plist v1.2.2
   Compiling mime v0.3.17
   Compiling tower-service v0.3.3
   Compiling subtle v2.6.1
   Compiling want v0.3.1
   Compiling tracing v0.1.44
   Compiling futures-channel v0.3.32
   Compiling errno v0.3.14
   Compiling atomic-waker v1.1.2
   Compiling pin-utils v0.1.0
   Compiling sync_wrapper v1.0.2
   Compiling security-framework-sys v2.17.0
   Compiling ipnet v2.12.0
   Compiling hyper v1.8.1
   Compiling tower-layer v0.3.3
   Compiling security-framework v3.7.0
   Compiling tower v0.5.3
   Compiling tauri-plugin-process v2.3.1
   Compiling tauri-plugin-updater v2.10.0
   Compiling tauri-plugin-global-shortcut v2.3.1
   Compiling objc2-web-kit v0.3.2
   Compiling muda v0.17.1
   Compiling tao v0.34.6
   Compiling window-vibrancy v0.6.0
   Compiling hyper-util v0.1.20
   Compiling tray-icon v0.21.3
   Compiling tauri-plugin-opener v2.5.3
   Compiling iri-string v0.7.10
   Compiling futures-sink v0.3.32
   Compiling tokio-util v0.7.18
   Compiling tokio-rustls v0.26.4
   Compiling hyper-rustls v0.27.7
   Compiling rustls-platform-verifier v0.6.2
   Compiling xattr v1.6.1
   Compiling objc2-osa-kit v0.3.2
   Compiling http-body-util v0.1.3
   Compiling tower-http v0.6.8
   Compiling filetime v0.2.27
   Compiling pathdiff v0.2.3
   Compiling fastrand v2.3.0
   Compiling tar v0.4.44
   Compiling open v5.3.3
   Compiling tempfile v3.27.0
   Compiling reqwest v0.13.2
   Compiling osakit v0.3.1
   Compiling global-hotkey v0.7.0
   Compiling tauri-app-template v0.2.2 (<workdir>/final/myapp/src-tauri)
   Compiling minisign-verify v0.2.5
   Compiling tauri-plugin-single-instance v2.4.0
    Finished `release` profile [optimized] target(s) in 1m 02s
       Built application at: <workdir>/final/myapp/src-tauri/target/release/myapp
    Bundling myapp.app (<workdir>/final/myapp/src-tauri/target/release/bundle/macos/myapp.app)
    Bundling <workdir>/final/myapp/src-tauri/target/release/bundle/macos/myapp.app.tar.gz (<workdir>/final/myapp/src-tauri/target/release/bundle/macos/myapp.app.tar.gz)
    Finished 1 bundle at:
        <workdir>/final/myapp/src-tauri/target/release/bundle/macos/myapp.app
        <workdir>/final/myapp/src-tauri/target/release/bundle/macos/myapp.app.tar.gz (updater)

    Finished 1 updater signature at:
        <workdir>/final/myapp/src-tauri/target/release/bundle/macos/myapp.app.tar.gz.sig

$ ls src-tauri/target/release/bundle/macos
myapp.app
myapp.app.tar.gz
myapp.app.tar.gz.sig

$ LC_ALL=C grep -a -o "https://localhost/api/tauri/updates/[A-Za-z0-9{}/_.-]*" src-tauri/target/release/bundle/macos/myapp.app/Contents/MacOS/myapp
https://localhost/api/tauri/updates/demo-desktop/{{target}}-{{arch}}/{{current_version}}
```

## Part C: the updater route, and a deploy to a server over SSH

```console
$ curl -sS --cacert caddy-root.crt -o /dev/null -w "%{http_code}\n" https://localhost/api/tauri/updates/demo-desktop/darwin-aarch64/0.2.2
204

$ curl -sS --cacert caddy-root.crt -o /dev/null -w "%{http_code}\n" https://localhost/api/tauri/updates/not-registered/darwin-aarch64/0.2.2
404

$ (cd demo && docker compose --project-directory deploy -f deploy/compose.yaml down)   # frees ports 80 and 443 for the server below
 Network demo_default Removed

$ npx --yes --package=../appsolutely-cli-0.1.0.tgz appsolutely init shop --template landing --industry software --server ssh://root@localhost:2222 --server-path /var/www/appsolutely/cli-e2e/final/server/shop --repository <host repository>
Creating a "appsolutely/appsolutely" project at "./shop"
Installing appsolutely/appsolutely (v0.1.5)
  - Downloading appsolutely/appsolutely (v0.1.5)
  - Installing appsolutely/appsolutely (v0.1.5): Extracting archive
Created project in /app/shop
Created shop: a host project on appsolutely/aio v0.7.0, with the self-host bundle in deploy/.
Bring it up with:
  cd shop
  npx @appsolutely/cli deploy

$ unset DOCKER_HOST DOCKER_TLS_VERIFY DOCKER_CERT_PATH   # this machine has no engine of its own now; the server has

$ npx --yes --package=../../appsolutely-cli-0.1.0.tgz appsolutely deploy
2026/10/02 11:20:19 http2: server: error reading preface from client dummy-1: read |0: file already closed
(docker build output omitted)
naming to docker.io/appsolutely-local/shop:latest done

 1 warning found (use docker --debug to expand):
 - SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ARG "COMPOSER_AUTH") (line 33)
 Network shop_default  Creating
 Network shop_default  Created
 Volume "shop_caddy_config"  Creating
 Volume "shop_caddy_config"  Created
 Volume "shop_pg_data"  Creating
 Volume "shop_pg_data"  Created
 Volume "shop_redis_data"  Creating
 Volume "shop_redis_data"  Created
 Volume "shop_storage"  Creating
 Volume "shop_storage"  Created
 Volume "shop_logs"  Creating
 Volume "shop_logs"  Created
 Volume "shop_run"  Creating
 Volume "shop_run"  Created
 Volume "shop_caddy_data"  Creating
 Volume "shop_caddy_data"  Created
 Container shop-redis-1  Creating
 Container shop-init-1  Creating
 Container shop-postgres-1  Creating
 Container shop-caddy-1  Creating
 Container shop-redis-1  Created
 Container shop-init-1  Created
 Container shop-caddy-1  Created
 Container shop-postgres-1  Created
 Container shop-app-role-1  Creating
 Container shop-app-role-1  Created
 Container shop-init-1  Starting
 Container shop-postgres-1  Starting
 Container shop-caddy-1  Starting
 Container shop-redis-1  Starting
 Container shop-postgres-1  Started
 Container shop-postgres-1  Waiting
 Container shop-init-1  Started
 Container shop-redis-1  Started
 Container shop-caddy-1  Started
 Container shop-postgres-1  Healthy
 Container shop-app-role-1  Starting
 Container shop-app-role-1  Started
ℹ️ NOTICE (generate-ssl): SSL mode is off, so we won't generate a self-signed SSL key pair.

   INFO  Discovering packages.

  appsolutely/aio ....................................................... DONE
  diglactic/laravel-breadcrumbs ......................................... DONE
  laravel/ai ............................................................ DONE
  laravel/passport ...................................................... DONE
  laravel/reverb ........................................................ DONE
  laravel/sanctum ....................................................... DONE
  laravel/socialite ..................................................... DONE
  laravel/tinker ........................................................ DONE
  livewire/livewire ..................................................... DONE
  mcamara/laravel-localization .......................................... DONE
  nesbot/carbon ......................................................... DONE
  nunomaduro/termwind ................................................... DONE
  openai-php/laravel .................................................... DONE
  prettus/l5-repository ................................................. DONE
  spatie/eloquent-sortable .............................................. DONE
  spatie/laravel-data ................................................... DONE
  spatie/laravel-responsecache .......................................... DONE
  spatie/php-structure-discoverer ....................................... DONE

   INFO  Publishing [livewire:assets] assets.

  Copying directory [vendor/livewire/livewire/dist] to [public/vendor/livewire]  DONE

   INFO  Publishing [aio-assets] assets.

  Copying directory [vendor/appsolutely/aio/resources/assets/images] to [public/vendor/aio/images]  DONE

🤔 Checking for Laravel automations...
🚀 Clearing Laravel cache before attempting migrations...

   INFO  Configuration cache cleared successfully.

⚡️ Attempting connection to default database...
✅ Database connection successful

   INFO  Preparing database.

  Creating migration table ...................................... 14.78ms DONE

   INFO  Running migrations.

  0001_01_01_000000_create_users_table .......................... 11.74ms DONE
  0001_01_01_000001_create_cache_table ........................... 4.32ms DONE
  0001_01_01_000002_create_jobs_table ............................ 7.04ms DONE
  2016_06_01_000001_create_oauth_auth_codes_table ................ 3.85ms DONE
  2016_06_01_000002_create_oauth_access_tokens_table ............. 5.81ms DONE
  2016_06_01_000003_create_oauth_refresh_tokens_table ............ 2.63ms DONE
  2016_06_01_000004_create_oauth_clients_table ................... 2.85ms DONE
  2024_06_01_000001_create_oauth_device_codes_table .............. 4.19ms DONE
  2026_01_01_000001_add_reference_and_sort_deletes_to_teams_table  0.55ms DONE
  2026_01_01_000101_create_admin_tables ......................... 18.97ms DONE
  2026_01_01_000102_create_admin_settings_table .................. 2.39ms DONE
  2026_01_01_000103_create_files_table ........................... 4.43ms DONE
  2026_01_01_000104_create_file_attachments_table ................ 6.12ms DONE
  2026_01_01_000105_create_translations_table .................... 3.73ms DONE
  2026_01_01_000106_create_admin_menu_profiles_table ............. 3.71ms DONE
  2026_01_01_000107_create_admin_menu_items_table ................ 4.39ms DONE
  2026_01_01_000108_create_admin_menu_user_overrides_table ....... 3.84ms DONE
  2026_01_01_000109_create_admin_quick_actions_table ............. 4.75ms DONE
  2026_01_01_000110_create_admin_resource_audits_table ........... 6.03ms DONE
  2026_01_01_000111_create_admin_spa_jobs_table .................. 3.74ms DONE
  2026_01_01_000112_create_distributions_table ................... 5.08ms DONE
  2026_01_01_000113_create_admin_dashboard_preferences_table ..... 3.10ms DONE
  2026_01_01_000114_create_release_versions_table ................ 4.79ms DONE
  2026_01_01_000115_create_release_builds_table ................. 10.64ms DONE
  2026_01_01_000116_create_settings_table ........................ 4.64ms DONE
  2026_01_01_000117_create_agent_conversations_table ............. 7.45ms DONE
  2026_01_01_000118_create_personal_access_tokens_table .......... 4.06ms DONE
  2026_01_01_000119_create_forms_table ........................... 5.13ms DONE
  2026_01_01_000120_create_form_fields_table ..................... 5.11ms DONE
  2026_01_01_000121_create_form_entries_table .................... 7.15ms DONE
  2026_01_01_000122_create_notification_templates_table .......... 4.91ms DONE
  2026_01_01_000123_create_notification_rules_table .............. 4.81ms DONE
  2026_01_01_000124_create_notification_queue_table .............. 6.82ms DONE
  2026_01_01_000125_create_notification_senders_table ............ 9.08ms DONE
  2026_01_01_000126_create_article_categories_table .............. 6.65ms DONE
  2026_01_01_000127_create_articles_table ........................ 5.46ms DONE
  2026_01_01_000128_create_article_category_pivot_table .......... 3.81ms DONE
  2026_01_01_000129_create_pages_table ........................... 6.74ms DONE
  2026_01_01_000130_create_page_block_groups_table ............... 2.93ms DONE
  2026_01_01_000131_create_page_blocks_table ..................... 4.33ms DONE
  2026_01_01_000132_create_page_block_values_table ............... 3.50ms DONE
  2026_01_01_000133_create_page_block_settings_table ............. 6.64ms DONE
  2026_01_01_000134_create_menus_table ........................... 4.61ms DONE
  2026_01_01_000135_create_product_categories_table .............. 4.59ms DONE
  2026_01_01_000136_create_products_table ........................ 4.57ms DONE
  2026_01_01_000137_create_product_category_pivot_table .......... 3.67ms DONE
  2026_01_01_000138_create_product_skus_table .................... 3.37ms DONE
  2026_01_01_000139_create_product_attribute_groups_table ........ 2.56ms DONE
  2026_01_01_000140_create_product_attributes_table .............. 3.79ms DONE
  2026_01_01_000141_create_product_attribute_values_table ........ 2.96ms DONE
  2026_01_01_000142_create_product_attribute_group_pivot_table ... 2.49ms DONE
  2026_01_01_000143_create_product_sku_attribute_value_table ..... 3.23ms DONE
  2026_01_01_000144_create_product_images_table .................. 4.74ms DONE
  2026_01_01_000145_create_orders_table ......................... 10.02ms DONE
  2026_01_01_000146_create_order_items_table ..................... 4.86ms DONE
  2026_01_01_000147_create_product_prices_table .................. 5.58ms DONE
  2026_01_01_000147_create_user_addresses_table .................. 4.47ms DONE
  2026_01_01_000148_create_order_payments_table .................. 8.66ms DONE
  2026_01_01_000149_create_order_shipments_table ................. 4.02ms DONE
  2026_01_01_000150_create_payments_table ........................ 4.87ms DONE
  2026_01_01_000151_create_order_status_histories_table .......... 4.87ms DONE
  2026_01_01_000152_create_delivery_tokens_table ................. 5.79ms DONE
  2026_01_01_000152_create_refund_requests_table ................. 5.72ms DONE
  2026_01_01_000153_create_refunds_table ......................... 7.20ms DONE
  2026_01_01_000154_create_carts_table ........................... 3.91ms DONE
  2026_01_01_000155_create_cart_items_table ...................... 4.47ms DONE
  2026_01_01_000156_create_inventory_movements_table ............. 5.61ms DONE
  2026_01_01_000157_create_wishlists_table ....................... 3.76ms DONE
  2026_01_01_000158_create_wishlist_items_table .................. 4.64ms DONE
  2026_01_01_000159_create_coupons_table ......................... 6.19ms DONE
  2026_01_01_000160_create_coupon_usages_table ................... 5.63ms DONE
  2026_01_01_000161_create_product_reviews_table ................. 6.47ms DONE
  2026_01_01_000162_create_shipping_zones_table .................. 3.64ms DONE
  2026_01_01_000163_create_shipping_rates_table .................. 4.06ms DONE
  2026_01_01_000164_create_tax_rates_table ...................... 34.68ms DONE
  2026_01_01_000165_create_webhook_subscriptions_table .......... 12.74ms DONE
  2026_01_01_000166_create_starter_content_records_table ......... 6.59ms DONE
  2026_01_01_000167_create_entitlements_table .................... 4.44ms DONE
  2026_01_01_000168_create_product_entitlements_table ............ 6.14ms DONE
  2026_01_01_000169_add_openid_columns_to_oauth_clients_table .... 3.41ms DONE
  2026_01_01_000170_create_social_accounts_table ................. 4.54ms DONE
  2026_01_01_000171_create_support_tickets_table ................. 5.73ms DONE
  2026_01_01_000172_create_support_ticket_messages_table ......... 4.23ms DONE
  2026_01_01_000173_create_support_ticket_message_files_table .... 2.95ms DONE
  2026_01_01_000174_create_product_subscription_terms_table ...... 2.76ms DONE
  2026_01_01_000177_create_subscriptions_table .................. 10.43ms DONE
  2026_01_01_000178_create_subscription_periods_table ........... 17.66ms DONE
  2026_08_01_000000_align_personal_access_tokens_with_sanctum .... 7.62ms DONE
  2026_09_06_000000_add_member_account_columns_to_users_table ... 10.89ms DONE
  2026_09_08_000000_create_payment_webhook_events_table .......... 3.73ms DONE
  2026_09_09_000000_create_order_operator_notices_table .......... 3.77ms DONE
  2026_09_10_000101_create_site_grants_table ..................... 4.01ms DONE
  2026_09_10_000102_create_one_time_codes_table .................. 3.45ms DONE
  2026_09_10_000201_create_restore_drills_table .................. 3.02ms DONE
  2026_09_10_000202_create_alert_states_table .................... 2.68ms DONE
  2026_09_10_000300_create_site_domains_table .................... 3.28ms DONE
  2026_09_10_000301_create_site_exports_table .................... 2.36ms DONE
  2026_09_11_000000_create_account_closure_records_table ......... 2.17ms DONE
  2026_09_14_000500_create_customer_data_requests_table .......... 2.48ms DONE
  2026_09_14_000800_create_unmatched_settlements_table ........... 6.82ms DONE
  2026_09_16_000000_create_gateway_customers_table ............... 4.72ms DONE
  2026_09_22_000000_create_account_subject_names_table ........... 3.23ms DONE
  2026_09_26_000000_create_held_subscription_notices_table ....... 3.09ms DONE
  2026_09_28_000000_create_crash_projects_table .................. 3.63ms DONE
  2026_09_28_000000_create_product_views_table ................... 3.35ms DONE
  2026_09_28_000100_add_search_columns_to_product_attributes_table  6.07ms DONE
  2026_09_28_000100_create_crash_events_table .................... 3.49ms DONE
  2026_09_28_000101_create_product_attribute_value_product_table . 2.82ms DONE
  2026_09_28_000102_create_search_histories_table ................ 3.01ms DONE
  2026_09_30_000000_create_push_device_tokens_table .............. 3.39ms DONE
  2026_10_01_000100_create_sync_mutations_table .................. 2.85ms DONE
  2026_10_01_000101_create_sync_resets_table ..................... 1.96ms DONE
  2026_10_02_000000_create_site_search_entries_table ............. 3.18ms DONE
  2026_10_02_000001_add_trigram_indexes_to_site_search_entries_table  2.08ms DONE

🚀 Running optimize command: "php artisan optimize"...

   INFO  Caching framework bootstrap, configuration, and metadata.

  config ........................................................ 31.81ms DONE
  events ......................................................... 0.57ms DONE
  routes ........................................................ 45.61ms DONE
  views ........................................................ 122.10ms DONE
  laravel-data .................................................. 14.00ms DONE

   INFO  Discovering packages.

  appsolutely/aio ....................................................... DONE
  diglactic/laravel-breadcrumbs ......................................... DONE
  laravel/ai ............................................................ DONE
  laravel/passport ...................................................... DONE
  laravel/reverb ........................................................ DONE
  laravel/sanctum ....................................................... DONE
  laravel/socialite ..................................................... DONE
  laravel/tinker ........................................................ DONE
  livewire/livewire ..................................................... DONE
  mcamara/laravel-localization .......................................... DONE
  nesbot/carbon ......................................................... DONE
  nunomaduro/termwind ................................................... DONE
  openai-php/laravel .................................................... DONE
  prettus/l5-repository ................................................. DONE
  spatie/eloquent-sortable .............................................. DONE
  spatie/laravel-data ................................................... DONE
  spatie/laravel-responsecache .......................................... DONE
  spatie/php-structure-discoverer ....................................... DONE

   INFO  Configuration cached successfully.

   INFO  Routes cached successfully.

   INFO  Blade templates cached successfully.

   INFO  Events cached successfully.

Back up /var/www/html/.env somewhere other than this server.
  It holds the key everything encrypted in your database is encrypted under.
  Every backup archive carries a copy of this key, so a site restored from an archive can read its encrypted settings again.
  That makes each archive a secret: anyone holding one can decrypt this site's payment credentials, mail passwords and secret settings. Keep archives off this server and restrict who can read them as tightly as this file.
  Losing this file with no archive to restore from is not a recoverable incident: the database survives and its encrypted columns do not.

Publishing AIO resources...

   INFO  Publishing [aio-config] assets.

  File [config/aio.php] already exists ............................... SKIPPED

   INFO  Publishing [aio-assets] assets.

  Copying directory [vendor/appsolutely/aio/resources/assets/images] to [public/vendor/aio/images]  DONE

Running migrations...

   INFO  Nothing to migrate.

Scanned 0 row(s), 0 changed.
Seeding admin tables...

   INFO  Nothing to migrate.

   INFO  Seeding database.

  Appsolutely\AIO\Database\Seeders\Admin\AdminTablesSeeder ........... RUNNING
Synced 276 new permission(s); kept 0 existing.
  Appsolutely\AIO\Database\Seeders\Admin\AdminMenuDefaultSeeder ...... RUNNING
Created administrator role menu profile.
  + added item for resource: pages
  + added item for resource: articles
  + added item for resource: article-categories
  + added item for resource: page-block-groups
  + added item for resource: page-blocks
  + added item for resource: page-block-settings
  + added item for resource: file-attachments
  + added item for resource: media-files
  + added item for resource: product-categories
  + added item for resource: product-attributes
  + added item for resource: products
  + added item for resource: orders
  + added item for resource: refunds
  + added item for resource: refund-requests
  + added item for resource: unmatched-settlements
  + added item for resource: coupons
  + added item for resource: subscriptions
  + added item for resource: tax-rates
  + added item for resource: members
  + added item for resource: product-reviews
  + added item for resource: shipping-zones
  + added item for resource: inventory-movements
  + added item for resource: support-tickets
  + added item for resource: release-versions
  + added item for resource: release-builds
  + added item for resource: crash-projects
  + added item for resource: menus
  + added item for resource: forms
  + added item for resource: form-fields
  + added item for resource: form-entries
  + added item for resource: notification-templates
  + added item for resource: notification-senders
  + added item for resource: notification-rules
  + added item for resource: notification-queues
  + added item for resource: site-grants
  + added item for resource: administrators
  + added item for resource: roles
  + added item for resource: permissions
  + added item for resource: menu-profiles
  + added item for resource: quick-actions
  + added item for resource: settings
  + added item for resource: privacy-settings
  + added item for resource: starter-content
  + added item for resource: api-tokens
  + added item for resource: admin-sessions
  + added item for resource: site-domains
  + added item for resource: site-exports
  + added item for resource: oauth-clients
  + added item for resource: webhook-subscriptions
  + added item for resource: webhook-deliveries
Synced 50 new resource_list item(s) into profile [Administrator].
Seeded 5 menu-management permission slug(s); kept 10 existing.
  Appsolutely\AIO\Database\Seeders\Admin\AdminMenuDefaultSeeder .. 299 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\CmsMenuSeeder ............... RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\CmsMenuSeeder ............ 28 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\SettingSeeder ............... RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\SettingSeeder ........... 246 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\PageBlockSeeder ............. RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\PageBlockSeeder .......... 38 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\NotificationTemplateSeeder .. RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\NotificationTemplateSeeder  49 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\NotificationRuleSeeder ...... RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\NotificationRuleSeeder ... 21 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\NotificationSenderSeeder .... RUNNING
  Appsolutely\AIO\Database\Seeders\Admin\NotificationSenderSeeder . 12 ms DONE

  Appsolutely\AIO\Database\Seeders\Admin\AdminTablesSeeder ..... 1,360 ms DONE

Admin seed complete: seeded the administrator, roles, permissions, menu, site settings, page blocks, notification senders, templates and rules.
Applied 'software/landing': 2 page(s) created, 0 updated, 0 skipped, 10 block(s) written.
.env.example already declares AIO keys; skipping append.

   INFO  Compiled views cleared successfully.

AIO install complete.

  Key fingerprint  sha256:c287dda5cbc3db6d
  Not the key. Compare it after a restore: a bundle brought back under a different key opens none of its encrypted columns.

  Open it  http://localhost/aio/claim/<redacted>
  Good once, for 7 days. It signs you in and puts you on your own front page; set a password from there.
  The administrator account has no password, so this link is the only way in.
  Lost it, or did it expire? Run aio:install again for a new one; it replaces this one.

  Site     http://localhost
  Admin    http://localhost/admin

  Start it with:  composer run dev
 Volume "shop_clamav_data"  Creating
 Volume "shop_clamav_data"  Created
 Container shop-postgres-1  Running
 Container shop-clamd-1  Creating
 Container shop-caddy-1  Recreate
 Container shop-init-1  Created
 Container shop-redis-1  Running
 Container shop-app-role-1  Recreate
 Container shop-app-role-1  Recreated
 Container shop-caddy-1  Recreated
 Container shop-app-1  Creating
 Container shop-clamd-1  Created
 Container shop-app-1  Created
 Container shop-queue-1  Creating
 Container shop-scheduler-1  Creating
 Container shop-scheduler-1  Created
 Container shop-queue-1  Created
 Container shop-caddy-1  Starting
 Container shop-postgres-1  Waiting
 Container shop-clamd-1  Starting
 Container shop-init-1  Starting
 Container shop-caddy-1  Started
 Container shop-init-1  Started
 Container shop-clamd-1  Started
 Container shop-postgres-1  Healthy
 Container shop-app-role-1  Starting
 Container shop-app-role-1  Started
 Container shop-app-role-1  Waiting
 Container shop-init-1  Waiting
 Container shop-postgres-1  Waiting
 Container shop-redis-1  Waiting
 Container shop-redis-1  Healthy
 Container shop-app-role-1  Exited
 Container shop-init-1  Exited
 Container shop-postgres-1  Healthy
 Container shop-app-1  Starting
 Container shop-app-1  Started
 Container shop-postgres-1  Waiting
 Container shop-redis-1  Waiting
 Container shop-app-1  Waiting
 Container shop-app-role-1  Waiting
 Container shop-init-1  Waiting
 Container shop-init-1  Waiting
 Container shop-postgres-1  Waiting
 Container shop-redis-1  Waiting
 Container shop-app-1  Waiting
 Container shop-app-role-1  Waiting
 Container shop-postgres-1  Healthy
 Container shop-redis-1  Healthy
 Container shop-init-1  Exited
 Container shop-postgres-1  Healthy
 Container shop-app-role-1  Exited
 Container shop-redis-1  Healthy
 Container shop-init-1  Exited
 Container shop-app-role-1  Exited
 Container shop-app-1  Healthy
 Container shop-scheduler-1  Starting
 Container shop-app-1  Healthy
 Container shop-queue-1  Starting
 Container shop-scheduler-1  Started
 Container shop-queue-1  Started
 Container shop-init-1  Created
 Container shop-caddy-1  Running
 Container shop-redis-1  Running
 Container shop-postgres-1  Running
 Container shop-app-role-1  Created
 Container shop-app-1  Running
 Container shop-init-1  Starting
 Container shop-postgres-1  Waiting
 Container shop-init-1  Started
 Container shop-postgres-1  Healthy
 Container shop-app-role-1  Starting
 Container shop-app-role-1  Started
 Container shop-postgres-1  Waiting
 Container shop-redis-1  Waiting
 Container shop-app-role-1  Waiting
 Container shop-init-1  Waiting
 Container shop-init-1  Exited
 Container shop-redis-1  Healthy
 Container shop-postgres-1  Healthy
 Container shop-app-role-1  Exited
 Container shop-app-1  Waiting
 Container shop-redis-1  Waiting
 Container shop-postgres-1  Waiting
 Container shop-init-1  Waiting
 Container shop-caddy-1  Waiting
 Container shop-app-role-1  Waiting
 Container shop-redis-1  Healthy
 Container shop-postgres-1  Healthy
 Container shop-init-1  Exited
 Container shop-app-role-1  Exited
 Container shop-app-1  Healthy
 Container shop-caddy-1  Healthy
Serving https://localhost

$ ssh root@localhost ls -A /var/www/appsolutely/cli-e2e/final/server/shop
.env
backups
compose.yaml

$ curl -sS -k https://localhost/ | grep -oE "<h1[^>]*>[^<]*"
<h1 class="display-4 fw-bold mb-3">Track the hours. Send the invoice. Get paid.
```
