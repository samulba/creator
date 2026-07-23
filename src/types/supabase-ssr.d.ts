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

  type AuthUser = {
    id: string;
    email?: string;
  };

  type AuthResult = {
    data: {
      user: AuthUser | null;
    };
  };

  type AuthErrorResult = {
    error: { message: string } | null;
  };

  type SignUpResult = AuthErrorResult & {
    data: {
      session: unknown | null;
    };
  };

  type SupabaseClientLike<Database> = {
    readonly __database?: Database;
    auth: {
      getUser(): Promise<AuthResult>;
      signInWithPassword(credentials: {
        email: string;
        password: string;
      }): Promise<AuthErrorResult>;
      signUp(credentials: {
        email: string;
        password: string;
        options?: { emailRedirectTo?: string };
      }): Promise<SignUpResult>;
      exchangeCodeForSession(code: string): Promise<AuthErrorResult>;
      signOut(): Promise<AuthErrorResult>;
    };
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
