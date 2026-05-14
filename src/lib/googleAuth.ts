const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/script.projects';

const STORAGE_TOKEN_KEY = 'google_auth_token';
const STORAGE_EXPIRY_KEY = 'google_auth_expiry';
const STORAGE_USER_KEY = 'google_auth_user';

export interface GoogleAuthState {
  isInitialized: boolean;
  isSignedIn: boolean;
  accessToken: string | null;
  userName: string | null;
  userEmail: string | null;
  userPhoto: string | null;
}

export type AuthListener = (state: GoogleAuthState) => void;

let authState: GoogleAuthState = {
  isInitialized: false,
  isSignedIn: false,
  accessToken: null,
  userName: null,
  userEmail: null,
  userPhoto: null,
};

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
const listeners: Set<AuthListener> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn({ ...authState }));
}

export function isGoogleConfigured(): boolean {
  return CLIENT_ID.length > 0;
}

export function getAuthState(): GoogleAuthState {
  return { ...authState };
}

export function addAuthListener(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function fetchUserInfo(accessToken: string) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      authState.userName = data.name || null;
      authState.userEmail = data.email || null;
      authState.userPhoto = data.picture || null;
    }
  } catch {
    // Non-critical, ignore
  }
}

/** Save token + user info to localStorage for session persistence */
function saveSession(accessToken: string, expiresIn: number) {
  const expiryTime = Date.now() + expiresIn * 1000;
  localStorage.setItem(STORAGE_TOKEN_KEY, accessToken);
  localStorage.setItem(STORAGE_EXPIRY_KEY, String(expiryTime));
  const user = {
    name: authState.userName,
    email: authState.userEmail,
    photo: authState.userPhoto,
  };
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
}

/** Clear saved session from localStorage */
function clearSession() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_EXPIRY_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
}

/** Try to restore a saved session from localStorage. Returns true if successful. */
function tryRestoreSession(): boolean {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  const expiryStr = localStorage.getItem(STORAGE_EXPIRY_KEY);
  if (!token || !expiryStr) return false;

  const expiry = Number(expiryStr);
  // Require at least 2 minutes remaining to avoid using nearly-expired tokens
  if (Date.now() > expiry - 120_000) {
    clearSession();
    return false;
  }

  authState.isSignedIn = true;
  authState.accessToken = token;

  // Restore cached user info immediately (will be refreshed in background)
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_USER_KEY) || '{}');
    authState.userName = user.name || null;
    authState.userEmail = user.email || null;
    authState.userPhoto = user.photo || null;
  } catch {
    // ignore parse errors
  }

  return true;
}

export async function initGoogleAuth(): Promise<void> {
  if (!isGoogleConfigured()) return;
  if (authState.isInitialized) return;

  await loadScript('https://accounts.google.com/gsi/client');
  await loadScript('https://apis.google.com/js/api.js');

  await new Promise<void>((resolve) => {
    gapi.load('client', () => resolve());
  });

  await gapi.client.init({});

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (response) => {
      if (response.error) {
        authState.isSignedIn = false;
        authState.accessToken = null;
        clearSession();
        notifyListeners();
        return;
      }
      authState.isSignedIn = true;
      authState.accessToken = response.access_token;
      gapi.client.setToken({ access_token: response.access_token });
      await fetchUserInfo(response.access_token);
      saveSession(response.access_token, response.expires_in ?? 3600);
      notifyListeners();
    },
    error_callback: () => {
      // User closed popup, do nothing
    },
  });

  // Restore session from localStorage if token is still valid
  const restored = tryRestoreSession();
  if (restored) {
    gapi.client.setToken({ access_token: authState.accessToken! });
    // Refresh user info in background
    fetchUserInfo(authState.accessToken!).then(() => notifyListeners());
  }

  authState.isInitialized = true;
  notifyListeners();
}

export function signIn(): void {
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: 'select_account' });
}

export function signOut(): void {
  const token = authState.accessToken;
  if (token) {
    google.accounts.oauth2.revoke(token);
    gapi.client.setToken(null);
  }
  authState.isSignedIn = false;
  authState.accessToken = null;
  authState.userName = null;
  authState.userEmail = null;
  authState.userPhoto = null;
  clearSession();
  notifyListeners();
}
