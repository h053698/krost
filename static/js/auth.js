let isLoggedIn = false;
let currentUser = null;

function getApiBaseUrl() {
    return window.location.origin;
}

const signInBtn = document.getElementById('signInBtn');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const sendBtn = document.getElementById('sendBtn');
const loginSection = document.getElementById('loginSection');
const userInfo = document.getElementById('userInfo');
const welcomeMessage = document.getElementById('welcomeMessage');
const logoutBtn = document.getElementById('logoutBtn');
const errorMessage = document.getElementById('errorMessage');

signInBtn.addEventListener('click', showLoginForm);
sendBtn.addEventListener('click', handlePasskeyLogin);
logoutBtn.addEventListener('click', handleLogout);
usernameInput.addEventListener('input', handleUsernameInput);
usernameInput.addEventListener('keypress', handleEnterKey);

document.addEventListener('click', (e) => {
    if (!loginSection.contains(e.target) && loginForm.classList.contains('show')) {
        hideLoginForm();
    }
});

function base64urlToBase64(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}

function base64ToArrayBuffer(base64url) {
  const base64 = base64urlToBase64(base64url);
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function showLoginForm() {
    loginForm.classList.add('show');
    signInBtn.classList.add('expanded');
    usernameInput.focus();
}

function hideLoginForm() {
    loginForm.classList.remove('show');
    signInBtn.classList.remove('expanded');
    usernameInput.value = '';
    hideError();
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    setTimeout(() => {
        hideError();
    }, 5000);
}

function hideError() {
    errorMessage.classList.remove('show');
}

function handleUsernameInput() {
    const hasValue = usernameInput.value.trim().length > 0;
    if (hasValue) {
        sendBtn.classList.add('show');
    } else {
        sendBtn.classList.remove('show');
    }
}

function handleEnterKey(e) {
    if (e.key === 'Enter' && usernameInput.value.trim()) {
        handlePasskeyLogin();
    }
}

async function handlePasskeyLogin() {
    const username = usernameInput.value.trim();

    if (!username) {
        showError('Please enter a username');
        return;
    }

    if (!window.PublicKeyCredential) {
        showError('Passkeys are not supported in this browser');
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = '⋯';
    sendBtn.style.animation = 'spin 1s linear infinite';

    try {
        const userExists = await checkUserExists(username);
        
        if (userExists) {
            await loginUser(username);
        } else {
            await registerUser(username);
        }
    } catch (error) {
        console.error('Passkey authentication error:', error);
        showError('Authentication failed. Please try again.');
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = '↵';
        sendBtn.style.animation = '';
    }
}

async function checkUserExists(username) {
    try {
        const response = await fetch(`${getApiBaseUrl()}/auth/id`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username }),
        });

        const data = await response.json();
        return data.exists;
    } catch (error) {
        console.error('Error checking user:', error);
        return false;
    }
}

async function registerUser(username) {
    try {
        const response = await fetch(`${getApiBaseUrl()}/auth/register/challenge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Registration failed');
        }

        const options = await response.json();

        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: base64ToArrayBuffer(options.challenge),
                rp: {
                    name: options.rp.name,
                    id: options.rp.id,
                },
                user: {
                    id: base64ToArrayBuffer(options.user.id),
                    name: options.user.name,
                    displayName: options.user.displayName,
                },
                pubKeyCredParams: options.pubKeyCredParams,
                authenticatorSelection: options.authenticatorSelection,
                attestation: options.attestation,
            },
        });

        const verificationResponse = await fetch(`${getApiBaseUrl()}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                userId: options.user.id,
                challenge: options.challenge,
                credential: {
                    id: credential.id,
                    type: credential.type,
                    rawId: arrayBufferToBase64(credential.rawId),
                    response: {
                        clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
                        attestationObject: arrayBufferToBase64(credential.response.attestationObject),
                    },
                },
            }),
        });

        if (!verificationResponse.ok) {
            const errorData = await verificationResponse.json();
            throw new Error(errorData.error || 'Registration verification failed');
        }

        const result = await verificationResponse.json();
        if (result.success) {
            loginSuccess(username, result.token);
        } else {
            throw new Error(result.message || 'Registration failed');
        }
        return result;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

async function loginUser(username) {
    try {
        const response = await fetch(`${getApiBaseUrl()}/auth/login/challenge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Login failed');
        }

        const options = await response.json();
        const abortController = new AbortController();

        const credential = await navigator.credentials.get({
            publicKey: options,
            signal: abortController.signal,
        });

        const verificationResponse = await fetch(`${getApiBaseUrl()}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                credential: {
                    id: credential.id,
                    type: credential.type,
                    rawId: arrayBufferToBase64(credential.rawId),
                    response: {
                        clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
                        authenticatorData: arrayBufferToBase64(credential.response.authenticatorData),
                        signature: arrayBufferToBase64(credential.response.signature),
                        userHandle: credential.response.userHandle ? arrayBufferToBase64(credential.response.userHandle) : null,
                    },
                },
            }),
        });

        if (!verificationResponse.ok) {
            const errorData = await verificationResponse.json();
            throw new Error(errorData.error || 'Login verification failed');
        }

        const result = await verificationResponse.json();

        if (result.success) {
            loginSuccess(username, result.token);
        } else {
            throw new Error(result.message || 'Authentication failed');
        }

        return result;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

function loginSuccess(user, token) {
    isLoggedIn = true;
    currentUser = user;

    const username = user.username || user;
    
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('authToken', token);

    loginSection.style.display = 'none';
    userInfo.style.display = 'block';
    welcomeMessage.textContent = `👋 Welcome, ${username}!`;

    hideError();
}

async function handleLogout() {
    try {
        const token = localStorage.getItem('authToken');
        await fetch(`${getApiBaseUrl()}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    isLoggedIn = false;
    currentUser = null;

    hideLoginForm();
    loginSection.style.display = 'block';
    userInfo.style.display = 'none';
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function checkLoginStatus() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        return false;
    }

    try {
        const response = await fetch(`${getApiBaseUrl()}/auth/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.ok) {
            const userData = await response.json();
            currentUser = userData.user;
            isLoggedIn = true;
            return true;
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            return false;
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        return false;
    }
}

window.auth = {
    isLoggedIn: () => isLoggedIn,
    currentUser: () => currentUser,
    getToken: () => localStorage.getItem('authToken'),
    checkLoginStatus,
    showError,
    hideError
};

window.addEventListener('load', checkLoginStatus);