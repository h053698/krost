let isLoggedIn = false;
let currentUser = null;

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
        // Check if user exists on server
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
        const response = await fetch(`http://localhost:5001/auth/id`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username }),
        });
        
        if (response.ok) {
            return await response.text() === 'true';
        }
        return false;
    } catch (error) {
        console.error('Error checking user existence:', error);
        return false;
    }
}

async function registerUser(username) {
    try {
        const response = await fetch(`http://localhost:5001/auth/register/challenge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username }),
        });

        if (!response.ok) {
            throw new Error('Failed to get registration options');
        }

        const options = await response.json();

        const credential = await navigator.credentials.create({
            publicKey: {
                ...options,
                challenge: base64ToArrayBuffer(options.challenge),
                user: {
                    ...options.user,
                    id: base64ToArrayBuffer(options.user.id),
                },
            }
        });

        const verificationResponse = await fetch(`http://localhost:5001/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                userId: options.user.id,
                challenge: options.challenge,
                credential: {
                    id: credential.id,
                    type: credential.type,
                    rawId: arrayBufferToBase64(credential.rawId),
                    response: {
                        attestationObject: arrayBufferToBase64(credential.response.attestationObject),
                        clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
                    }
                }
            }),
        });

        if (!verificationResponse.ok) {
            throw new Error('Registration verification failed');
        }

        const result = await verificationResponse.json();
        
        if (result.success) {
            loginSuccess(username, result.token);
        } else {
            throw new Error(result.message || 'Registration failed');
        }

    } catch (error) {
        if (error.name === 'NotAllowedError') {
            showError('Passkey registration was cancelled');
        } else {
            console.error('Registration error:', error);
            showError(error.message || 'Registration failed');
        }
    }
}

async function loginUser(username) {
    try {
        const response = await fetch(`http://localhost:5001/auth/login/challenge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username }),
        });

        if (!response.ok) {
            throw new Error('Failed to get authentication options');
        }

        const options = await response.json();

        options.challenge = base64ToArrayBuffer(options.challenge);

        if (options.allowCredentials) {
          options.allowCredentials = options.allowCredentials.map(cred => {
            return {
              ...cred,
              id: base64ToArrayBuffer(cred.id)
            };
          });
        }

        const abortController = new AbortController();

        const credential = await navigator.credentials.get({
          publicKey: options,
          signal: abortController.signal,
        });
        console.log(credential.toJSON());

        const verificationResponse = await fetch(`http://localhost:5001/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credential.toJSON())
        });

        if (!verificationResponse.ok) {
            throw new Error('Authentication verification failed');
        }

        const result = await verificationResponse.json();
        
        if (result.success) {
            loginSuccess(username, result.token);
        } else {
            throw new Error(result.message || 'Authentication failed');
        }

    } catch (error) {
        if (error.name === 'NotAllowedError') {
            showError('Authentication was cancelled');
        } else {
            console.error('Authentication error:', error);
            showError(error.message || 'Authentication failed');
        }
    }
}

function loginSuccess(username, token) {
    isLoggedIn = true;
    currentUser = username;

    localStorage.setItem('currentUser', username);
    localStorage.setItem('authToken', token);

    loginSection.style.display = 'none';
    userInfo.style.display = 'block';
    welcomeMessage.textContent = `👋 Welcome, ${username}!`;

    hideError();
}

async function handleLogout() {
    try {
        // Call server logout endpoint
        const token = localStorage.getItem('authToken');
        if (token) {
            await fetch(`http://localhost:5001/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    }

    isLoggedIn = false;
    currentUser = null;

    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');

    loginSection.style.display = 'block';
    userInfo.style.display = 'none';

    hideLoginForm();
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
    const savedUser = localStorage.getItem('currentUser');
    const token = localStorage.getItem('authToken');
    
    if (savedUser && token) {
        try {
            // Verify token with server
            const response = await fetch(`http://localhost:5001/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });

            if (response.ok) {
                loginSuccess(savedUser, token);
            } else {
                // Token is invalid, clear storage
                localStorage.removeItem('currentUser');
                localStorage.removeItem('authToken');
            }
        } catch (error) {
            console.error('Token verification error:', error);
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
        }
    }
}

// Export functions for use in other files
window.auth = {
    isLoggedIn: () => isLoggedIn,
    currentUser: () => currentUser,
    getToken: () => localStorage.getItem('authToken'),
    checkLoginStatus,
    showError,
    hideError
};

window.addEventListener('load', checkLoginStatus); 