export class OAuthService {
  // Google OAuth configuration
  private get googleClientId(): string { return process.env.GOOGLE_CLIENT_ID || ''; }
  private get googleClientSecret(): string { return process.env.GOOGLE_CLIENT_SECRET || ''; }
  private get serverUrl(): string { return process.env.SERVER_URL || 'http://localhost:3000'; }
  private get googleRedirectUri(): string { return `${this.serverUrl}/api/auth/google/callback`; }

  // GitHub OAuth configuration
  private get githubClientId(): string { return process.env.GITHUB_CLIENT_ID || ''; }
  private get githubClientSecret(): string { return process.env.GITHUB_CLIENT_SECRET || ''; }
  private get githubRedirectUri(): string { return `${this.serverUrl}/api/auth/github/callback`; }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('OAuth request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  getGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.googleClientId,
      redirect_uri: this.googleRedirectUri,
      response_type: 'code',
      scope: 'email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async getGoogleUserFromCode(code: string): Promise<{ email: string; name: string }> {
    const tokenResponse = await this.fetchWithTimeout('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.googleClientId,
        client_secret: this.googleClientSecret,
        redirect_uri: this.googleRedirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to fetch Google access token: ${error}`);
    }

    const { access_token } = await tokenResponse.json() as { access_token: string };

    const userResponse = await this.fetchWithTimeout('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    const userData = await userResponse.json() as { email: string; name?: string; given_name?: string };
    return {
      email: userData.email,
      name: userData.name || userData.given_name || userData.email.split('@')[0]
    };
  }

  getGithubAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.githubClientId,
      redirect_uri: this.githubRedirectUri,
      scope: 'user:email read:user',
      state
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async getGithubUserFromCode(code: string): Promise<{ email: string; name: string; username: string }> {
    const tokenResponse = await this.fetchWithTimeout('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: this.githubClientId,
        client_secret: this.githubClientSecret,
        code,
        redirect_uri: this.githubRedirectUri
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to fetch GitHub access token');
    }

    const { access_token } = await tokenResponse.json() as { access_token: string };
    if (!access_token) {
      throw new Error('No access token returned from GitHub');
    }

    const userResponse = await this.fetchWithTimeout('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch GitHub user profile');
    }

    const userData = await userResponse.json() as { name?: string; login: string };

    // GitHub emails might be private, so we need to fetch them explicitly
    const emailsResponse = await this.fetchWithTimeout('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json'
      }
    });

    if (!emailsResponse.ok) {
      throw new Error('Failed to fetch GitHub emails');
    }

    const emailsData = await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
    const verifiedPrimary = emailsData.find(e => e.verified && e.primary);
    const verified = emailsData.find(e => e.verified);
    const primary = emailsData.find(e => e.primary);
    const primaryEmail = (verifiedPrimary || verified || primary || emailsData[0])?.email;

    if (!primaryEmail) {
      throw new Error('No email found for GitHub user');
    }

    return {
      email: primaryEmail,
      name: userData.name || userData.login,
      username: userData.login
    };
  }
}

export const oauthService = new OAuthService();
