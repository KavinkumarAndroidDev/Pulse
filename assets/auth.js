// assets/auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "%%FIREBASE_API_KEY%%",
  authDomain: "%%FIREBASE_AUTH_DOMAIN%%",
  projectId: "%%FIREBASE_PROJECT_ID%%",
  storageBucket: "%%FIREBASE_STORAGE_BUCKET%%",
  messagingSenderId: "%%FIREBASE_MESSAGING_SENDER_ID%%",
  appId: "%%FIREBASE_APP_ID%%"
};

let app, auth, db;

function initFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized in auth.js");
    } catch (error) {
        showMessage(`Error initializing Firebase: ${error.message}`, 'error');
    }
}

function showMessage(message, type = 'info') {
    const box = document.getElementById('message-box-auth');
    if (!box) return;
    box.textContent = message;
    box.className = `message-box ${type}`;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 5000);
}

function setSubmitting(formId, isSubmitting) {
    const btn = document.getElementById(formId === 'login-form' ? 'login-submit' : 'register-submit');
    if (!btn) return;
    btn.disabled = isSubmitting;
    btn.classList.toggle('opacity-75', isSubmitting);
}

async function handleRegister(e) {
    e.preventDefault();
    setSubmitting('register-form', true);

    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    if (username.length < 3) {
        showMessage('Username must be at least 3 characters long.', 'error');
        setSubmitting('register-form', false);
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: username });

        const userDocRef = doc(db, `artifacts/${firebaseConfig.appId}/users`, user.uid);
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName: username,
            createdAt: new Date().toISOString(),
            hasPinSetup: false
        });

        showMessage('Account created successfully! Redirecting to PIN setup...', 'success');
        setTimeout(() => { window.location.href = 'pin.html'; }, 2000);

    } catch (error) {
        showMessage(error.message, 'error');
        setSubmitting('register-form', false);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    setSubmitting('login-form', true);

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        
        const urlParams = new URLSearchParams(window.location.search);
        const isPinReset = urlParams.get('reset_pin') === 'true';

        showMessage('Login successful! Redirecting...', 'success');
        
        // If it's a PIN reset flow, carry the flag over to the pin page.
        const redirectUrl = isPinReset ? 'pin.html?reset_pin=true' : 'pin.html';
        
        setTimeout(() => { window.location.href = redirectUrl; }, 1500);

    } catch (error) {
        showMessage(error.message, 'error');
        setSubmitting('login-form', false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initFirebase();

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});