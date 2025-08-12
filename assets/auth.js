// Standalone Auth Logic for login.html and signup.html
// Uses same Firebase backend and data model as the main app

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment
// IMPORTANT: DO NOT modify these lines. They are automatically injected.

//const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const firebaseConfig = {
  apiKey: "%%FIREBASE_API_KEY%%",
  authDomain: "%%FIREBASE_AUTH_DOMAIN%%",
  projectId: "%%FIREBASE_PROJECT_ID%%",
  storageBucket: "%%FIREBASE_STORAGE_BUCKET%%",
  messagingSenderId: "%%FIREBASE_MESSAGING_SENDER_ID%%",
  appId: "%%FIREBASE_APP_ID%%"
};
let app, auth, db;
// Add this global flag
let isRegistering = false;


function initFirebase() {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
      showMessage('Error: Firebase configuration not found or incomplete. Please ensure the environment variables are set correctly.', 'error');
      console.error("Firebase config is missing or invalid!");
      return;
  }
  try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully in auth.js.");
  } catch (error) {
      showMessage(`Error initializing Firebase: ${error.message}`, 'error');
      console.error("Firebase initialization error in auth.js:", error);
  }
}

function showMessage(message, type = 'info') {
  const box = document.getElementById('message-box-auth');
  if (!box) return;
  box.textContent = message;
  box.className = `message-box ${type}`;
  box.style.display = 'block';
  setTimeout(() => {
    box.style.display = 'none';
  }, 5000);
}

function clearMessage() {
  const box = document.getElementById('message-box-auth');
  if (!box) return;
  box.style.display = 'none';
}

function setSubmitting(button, isSubmitting) {
  if (!button) return;
  button.disabled = isSubmitting;
  button.classList.toggle('opacity-75', isSubmitting);
  button.classList.toggle('cursor-not-allowed', isSubmitting);
}

async function handleLoginStandalone(e) {
  e.preventDefault();
  clearMessage();
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-password');
  const btn = document.getElementById('login-submit');

  const email = emailEl?.value?.trim();
  const password = passEl?.value;
  if (!email || !password) {
    showMessage('Please enter your email and password.', 'error');
    return;
  }

  try {
    setSubmitting(btn, true);
    await signInWithEmailAndPassword(auth, email, password);
    // Redirect to main app. onAuthStateChanged in app.js will handle further logic.
    window.location.href = 'index.html';
  } catch (err) {
    console.error('Login error:', err);
    showMessage(`Login failed: ${err.message}`, 'error');
  } finally {
    setSubmitting(btn, false);
  }
}


async function handleRegisterStandalone(e) {
  e.preventDefault();
  clearMessage();
  const usernameEl = document.getElementById('register-username');
  const emailEl = document.getElementById('register-email');
  const passEl = document.getElementById('register-password');
  const btn = document.getElementById('register-submit');

  const username = usernameEl?.value?.trim();
  const email = emailEl?.value?.trim();
  const password = passEl?.value;

  if (!username || !email || !password) {
    showMessage('Please fill in username, email, and password.', 'error');
    return;
  }

  try {
    setSubmitting(btn, true);
    isRegistering = true; // Set the flag
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    // Store user profile data in Firestore. Path: artifacts/{appId}/users/{userId}
    const userDocRef = doc(db, `artifacts/${firebaseConfig.appId}/users`, user.uid);
    await setDoc(
      userDocRef,
      {
        username,
        email: user.email || email,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    isRegistering = false; // Unset the flag
    window.location.href = 'index.html'; // Redirect to main app
  } catch (err) {
    console.error('Registration error:', err);
    showMessage(`Registration failed: ${err.message}`, 'error');
    isRegistering = false; // Unset the flag on error as well
  } finally {
    setSubmitting(btn, false);
  }
}

function wireUp() {
  // If already authenticated on this page, immediately redirect to the main app.
  onAuthStateChanged(auth, (user) => {
    // Check if a user is logged in AND we are not in the middle of a registration process
    if (user && !isRegistering) {
      window.location.replace('index.html');
    }
  });

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginStandalone);
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterStandalone);
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}
// Bootstrap
initFirebase();
window.addEventListener('DOMContentLoaded', wireUp);
