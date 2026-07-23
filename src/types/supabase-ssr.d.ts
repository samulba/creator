declare module "@supabase/ssr" {
  type CookieOptions = Record<string, unknown>;

  type CookieToSet = {
    name: string;
    value: string;
    options?: CookieOptions;
  };

  type CookieMethodsServer = {
    getAll(): { name: string; value: string }[];
    setAll(cookies: CookieToSet[]): void;
  };

  type SupabaseClientLike<Database> = {
    readonly __database?: Database;
  };

  export function createBrowserClient<Database>(
    supabaseUrl: string,
    supabaseKey: string,
  ): SupabaseClientLike<Database>;

  export function createServerClient<Database>(
    supabaseUrl: string,
    supabaseKey: string,
    options: { cookies: CookieMethodsServer },
  ): SupabaseClientLike<Database>;
}
