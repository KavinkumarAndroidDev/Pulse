// assets/pin.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "%%FIREBASE_API_KEY%%",
  authDomain: "%%FIREBASE_AUTH_DOMAIN%%",
  projectId: "%%FIREBASE_PROJECT_ID%%",
  storageBucket: "%%FIREBASE_STORAGE_BUCKET%%",
  messagingSenderId: "%%FIREBASE_MESSAGING_SENDER_ID%%",
  appId: "%%FIREBASE_APP_ID%%"
};
let app, auth, db;
let currentUserId = null;
let pageMode = 'setup'; // 'setup', 'confirm', or 'login'

function initFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized in pin.js");
    } catch (error) {
        showMessage(`Error initializing Firebase: ${error.message}`, 'error');
    }
}

function showMessage(message, type = 'info') {
    const box = document.getElementById('message-box-pin');
    if (!box) return;
    box.textContent = message;
    box.className = `message-box ${type}`;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 5000);
}

function setSubmitting(isSubmitting) {
    const btn = document.getElementById('pin-submit');
    if (!btn) return;
    btn.disabled = isSubmitting;
    btn.classList.toggle('opacity-75', isSubmitting);
}

async function hashPin(pin, salt) {
    const encoder = new TextEncoder();
    // Use a salt (like the user's UID) to make the hash more secure
    const data = encoder.encode(pin + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getPinFromInput(inputId) {
    const input = document.getElementById(inputId);
    return input ? input.value : '';
}

function clearPinInput(inputId) {
     const input = document.getElementById(inputId);
     if(input) {
        input.value = '';
        input.focus();
     }
}

function setPageMode(mode) {
    pageMode = mode;
    const pinSection = document.getElementById('pin-section');
    const title = document.getElementById('pin-title');
    const subtitle = document.getElementById('pin-subtitle');
    const pinContainer = document.getElementById('pin-input-container');
    const confirmContainer = document.getElementById('pin-confirm-container');
    const submitLabel = document.getElementById('pin-submit-label');
    const headerIcon = document.getElementById('pin-header-icon');
    const logoutContainer = document.getElementById('pin-logout-container');
    const resetContainer = document.getElementById('pin-reset-container');

    // Clear inputs on mode change
    clearPinInput('pin-input');
    clearPinInput('pin-confirm-input');

    if (mode === 'setup') {
        title.textContent = 'Set Your Security PIN';
        subtitle.textContent = 'Create a 6-digit PIN for quick and secure access.';
        submitLabel.textContent = 'Continue';
        pinContainer.style.display = 'block';
        confirmContainer.style.display = 'none';
        headerIcon.dataset.lucide = "shield-check";
        logoutContainer.style.display = 'none';
        resetContainer.style.display = 'none';
        document.getElementById('pin-input').focus();

    } else if (mode === 'confirm') {
        title.textContent = 'Confirm Your PIN';
        subtitle.textContent = 'Please re-enter your 6-digit PIN to confirm.';
        submitLabel.textContent = 'Save PIN';
        pinContainer.style.display = 'none'; // Hide first pin input
        confirmContainer.style.display = 'block';
        headerIcon.dataset.lucide = "shield-check";
        logoutContainer.style.display = 'none';
        resetContainer.style.display = 'none';
        document.getElementById('pin-confirm-input').focus();

    } else if (mode === 'login') {
        title.textContent = 'Enter Your PIN';
        subtitle.textContent = 'Enter your 6-digit PIN to unlock your dashboard.';
        submitLabel.textContent = 'Unlock';
        pinContainer.style.display = 'block';
        confirmContainer.style.display = 'none';
        headerIcon.dataset.lucide = "lock";
        logoutContainer.style.display = 'block';
        resetContainer.style.display = 'block';
        document.getElementById('pin-input').focus();
    }
    lucide.createIcons();

    // Once mode is set, remove the loading class to show the content
    if (pinSection.classList.contains('loading')) {
        pinSection.classList.remove('loading');
    }
}

async function handlePinSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    if (pageMode === 'setup') {
        const pin = getPinFromInput('pin-input');
        if (pin.length !== 6) {
            showMessage('Please enter a 6-digit PIN.', 'error');
            setSubmitting(false);
            return;
        }
        sessionStorage.setItem('pin_setup_stage1', pin);
        setPageMode('confirm');
        setSubmitting(false);
        return;
    }

    if (pageMode === 'confirm') {
        const firstPin = sessionStorage.getItem('pin_setup_stage1');
        const confirmPin = getPinFromInput('pin-confirm-input');

        if (confirmPin.length !== 6) {
            showMessage('Please re-enter your 6-digit PIN.', 'error');
            setSubmitting(false);
            return;
        }

        if (firstPin !== confirmPin) {
            showMessage('PINs do not match. Please start over.', 'error');
            sessionStorage.removeItem('pin_setup_stage1');
            setPageMode('setup'); // This already clears the confirm input
            clearPinInput('pin-input'); // Also clear the first input
            setSubmitting(false);
            return;
        }

        const hashedPin = await hashPin(confirmPin);
        const userDocRef = doc(db, `artifacts/${firebaseConfig.appId}/users`, currentUserId);
        try {
            await setDoc(userDocRef, { pin: hashedPin, hasPinSetup: true }, { merge: true });
            showMessage('PIN set successfully! Redirecting...', 'success');
            sessionStorage.removeItem('pin_setup_stage1');
            setTimeout(() => { window.location.href = 'index.html'; }, 2000);
        } catch (error) {
            showMessage(`Error setting PIN: ${error.message}`, 'error');
            setSubmitting(false);
        }
        return;
    }

    if (pageMode === 'login') {
        const pin = getPinFromInput('pin-input');
        if (pin.length !== 6) {
            showMessage('Please enter your 6-digit PIN.', 'error');
            setSubmitting(false);
            return;
        }

        const userDocRef = doc(db, `artifacts/${firebaseConfig.appId}/users`, currentUserId);
        try {
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const hashedPin = await hashPin(pin, currentUserId);
                if (hashedPin === userData.pin) {
                    sessionStorage.setItem('pin_unlocked', 'true');
                    showMessage('PIN accepted! Welcome back.', 'success');
                    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
                } else {
                    showMessage('Incorrect PIN. Please try again.', 'error');
                    clearPinInput('pin-input');
                    setSubmitting(false);
                }
            }
        } catch (error) {
            showMessage(`Error verifying PIN: ${error.message}`, 'error');
            setSubmitting(false);
        }
    }
}

function handleLogout() {
    signOut(auth).then(() => {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }).catch(error => {
        showMessage(`Logout failed: ${error.message}`, 'error');
    });
}

function handlePinReset(e) {
    e.preventDefault();
    // For security, force re-authentication to reset PIN.
    signOut(auth).then(() => {
        // Redirect to login page with a flag to indicate PIN reset flow.
        window.location.href = 'login.html?reset_pin=true';
    }).catch(error => {
        showMessage(`Logout failed: ${error.message}`, 'error');
    });
}


document.addEventListener('DOMContentLoaded', () => {
    initFirebase();

    // Improve PIN input fields for better UX
    ['pin-input', 'pin-confirm-input'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.setAttribute('type', 'tel'); // Use 'tel' for numeric keyboard on mobile
            input.setAttribute('maxlength', '6');
            input.addEventListener('input', () => { input.value = input.value.replace(/[^0-9]/g, ''); });
        }
    });

    document.getElementById('pin-form').addEventListener('submit', handlePinSubmit);
    document.getElementById('pin-logout-link').addEventListener('click', handleLogout);
    // Add event listener for the new reset link
    document.getElementById('pin-reset-link').addEventListener('click', handlePinReset);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            const userDocRef = doc(db, `artifacts/${firebaseConfig.appId}/users`, user.uid);
            const userDoc = await getDoc(userDocRef);

            // Check URL for reset_pin flag
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('reset_pin') === 'true') {
                setPageMode('setup');
            } else if (userDoc.exists() && userDoc.data().hasPinSetup) {
                setPageMode('login');
            } else {
                setPageMode('setup');
            }
        } else {
            // Not logged in, redirect to login page.
            window.location.href = 'login.html';
        }
    });
});
