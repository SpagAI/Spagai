// Cloudflare adapter settings. Every page in this app is rendered on each request,
// so no shared page cache (and no R2 bucket) is needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
