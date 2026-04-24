// Mirrors the Python-side customer config JSON shape
// (inventory_sync/customers.py) so we can parse `customers.config_json`
// without redefining it per callsite.

export type Recipient = {
  whatsapp: string | null;
  email: string | null;
};

export type RouteSpec = {
  to: "ops" | "client" | "both" | "none";
  via: "whatsapp" | "email" | "both" | "none";
};

export type CustomerStoreConfig = {
  platform: string;
  store_url: string;
  myshopify_domain: string | null;
  api_version: string | null;
  display_name: string;
};

export type CustomerVendorBinding = {
  name: string;
  url: string;
  store_tag: string | null;
};

export type CustomerNotifications = {
  ops_enabled: boolean;
  client_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  recipients: Record<string, Recipient>;
  routes: Record<string, RouteSpec>;
};

export type Customer = {
  store: CustomerStoreConfig;
  vendors: CustomerVendorBinding[];
  notifications: CustomerNotifications | null;
};
