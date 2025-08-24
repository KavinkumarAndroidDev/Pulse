import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Global variables provided by the Canvas environment
// IMPORTANT: DO NOT modify these lines. They are automatically injected.

//const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

/*const firebaseConfig = {
  apiKey: "%%FIREBASE_API_KEY%%",
  authDomain: "%%FIREBASE_AUTH_DOMAIN%%",
  projectId: "%%FIREBASE_PROJECT_ID%%",
  storageBucket: "%%FIREBASE_STORAGE_BUCKET%%",
  messagingSenderId: "%%FIREBASE_MESSAGING_SENDER_ID%%",
  appId: "%%FIREBASE_APP_ID%%"
};*/
const firebaseConfig = {
  apiKey: "AIzaSyCeS4fO_tBayetpF65PEB_j3qzW9wBwv6c",
  authDomain: "personal-habit-tracker-b55e5.firebaseapp.com",
  projectId: "personal-habit-tracker-b55e5",
  storageBucket: "personal-habit-tracker-b55e5.firebasestorage.app",
  messagingSenderId: "741862961819",
  appId: "1:741862961819:web:306175ecbecc9912048c3e"
};
let app, auth, db, storage;
let currentUserId = null;
let isAuthReady = false;
// Editing state for daily journal
let currentEditDocId = null; // if set, form saves to this date id instead of today
let hasTodayEntry = false;   // track if today's entry exists to adjust UI/CTA

// Initialize Firebase
function initializeFirebase() {
    if (!firebaseConfig || !firebaseConfig.apiKey) {
        showMessage('message-box-app', 'Error: Firebase configuration not found or incomplete. Please ensure the environment variables are set correctly.', 'error');
        console.error("Firebase config is missing or invalid!");
        return;
    }
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        console.log("Firebase initialized successfully.");
    } catch (error) {
        showMessage('message-box-app', `Error initializing Firebase: ${error.message}`, 'error');
        console.error("Firebase initialization error:", error);
    }
}

/**
 * Ensures a user profile exists in Firestore. If not, creates a basic one.
 * This is important for new users or if the auth process didn't fully complete.
 * @param {firebase.User} user - The authenticated Firebase user object.
 */
async function ensureUserProfile(user) {
    if (!user) return;
    const userDocRef = doc(db, `artifacts/${firebaseConfig.appId}/users`, user.uid);
    try {
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            // Create a basic profile if it doesn't exist
            await setDoc(userDocRef, {
                username: user.email ? user.email.split('@')[0] : 'New User',
                email: user.email || 'N/A',
                createdAt: new Date().toISOString()
            }, { merge: true });
            console.log("Created new user profile in Firestore.");
        }
    } catch (error) {
        console.error("Error ensuring user profile:", error);
        showMessage('message-box-app', `Error setting up user profile: ${error.message}`, 'error');
    }
}

// --- Helper Functions ---
function setEditingState(docId) {
    currentEditDocId = docId;
    const badge = document.getElementById('editing-badge');
    const badgeDateLabel = document.getElementById('editing-date-label');
    const cancelBtn = document.getElementById('cancel-edit-button');
    const saveLabel = document.getElementById('save-daily-label');

    if (docId) {
        // Show editing state for provided date
        badge.classList.remove('hidden');
        badgeDateLabel.textContent = docId;
        cancelBtn.classList.remove('hidden');
        saveLabel.textContent = "Update Today's Entry";
    } else {
        // Reset editing state
        badge.classList.add('hidden');
        badgeDateLabel.textContent = '';
        cancelBtn.classList.add('hidden');
        saveLabel.textContent = hasTodayEntry ? "Update Today's Entry" : "Save Today's Entry";
    }
    // Re-render icons if any were added dynamically
    if (window.lucide && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
}

async function loadDailyEntryById(targetDocId) {
    if (!currentUserId) return;
    showLoading();
    try {
        const docRef = doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/journalEntries`, targetDocId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const wakeEl = document.getElementById('wake-up-time');
            const sleepEl = document.getElementById('sleep-time');
            if (wakeEl) wakeEl.value = data.wakeUp || '';
            if (sleepEl) sleepEl.value = data.sleep || '';
            document.getElementById('nofap').checked = data.noFap || false;
            document.getElementById('noporn').checked = data.noPorn || false;
            document.getElementById('workout-done').checked = data.workout || false;
            document.getElementById('works-done').value = data.worksDone || '';
            document.getElementById('meal-breakfast').value = data.meals?.breakfast || '';
            document.getElementById('meal-lunch').value = data.meals?.lunch || '';
            document.getElementById('meal-dinner').value = data.meals?.dinner || '';
            document.getElementById('meal-snacks').value = data.meals?.snacks || '';
            document.getElementById('screen-time').value = data.screenTime || '';
            document.getElementById('new-thing-learned').value = data.newThingLearned || '';
        } else {
            showMessage('message-box-app', 'Entry not found for the selected date.', 'error');
        }
    } catch (error) {
        showMessage('message-box-app', `Error loading entry: ${error.message}`, 'error');
        console.error('Error loading entry by ID:', error);
    } finally {
        hideLoading();
    }
}

async function startEditingEntry(docId) {
    const todayId = getFormattedDate(new Date());
    if (docId !== todayId) {
        showMessage('message-box-app', "Editing past entries is restricted. You can only edit today's entry.", 'error');
        return;
    }
    await loadDailyEntryById(docId);
    setEditingState(docId);
    // Smooth scroll to the form for better UX
    const formEl = document.getElementById('daily-journal-form');
    if (formEl && typeof formEl.scrollIntoView === 'function') {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
// Expose for inline onclick handlers in logs list
window.startEditingEntry = startEditingEntry;
function showMessage(boxId, message, type) {
    const msgBox = document.getElementById(boxId);
    msgBox.textContent = message;
    msgBox.className = `message-box ${type}`;
    msgBox.style.display = 'block';
    setTimeout(() => {
        msgBox.style.display = 'none';
    }, 5000);
}

function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function getFormattedDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getISOWeekDate(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function isSaturday(date = new Date()) {
    return date.getDay() === 6;
}

function setActiveTab(tabId) {
    // Hide all tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    // Remove active state from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
        selectedTab.style.display = 'block';
    }
    
    // Add active state to selected nav item
    const selectedNavItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (selectedNavItem) {
        selectedNavItem.classList.add('active');
    }
}

function showAuthenticatedApp() {
    console.log('Showing authenticated app');
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');
    
    if (authSection) {
        authSection.style.display = 'none';
        authSection.classList.add('hidden');
    }
    
    if (appSection) {
        appSection.style.display = 'flex';
        appSection.classList.remove('hidden');
    }
    
    // Initialize with dashboard tab
    setActiveTab('dashboard');
}

function showAuthenticationForm() {
    console.log('Showing authentication form');
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');
    
    if (authSection) {
        authSection.style.display = 'flex';
        authSection.classList.remove('hidden');
    }
    
    if (appSection) {
        appSection.style.display = 'none';
        appSection.classList.add('hidden');
    }
}

function showLogoutConfirmation() {
    const logoutModal = document.getElementById('logout-modal');
    if (logoutModal) {
        logoutModal.classList.remove('hidden');
    }
}

async function handleLogout() {
    showLoading();
    try {
        await signOut(auth);
        // onAuthStateChanged will handle UI changes
    } catch (error) {
        showMessage('message-box-app', `Logout failed: ${error.message}`, 'error');
        console.error("Logout error:", error);
    } finally {
        hideLoading();
    }
}

// --- Firestore Data Operations ---

async function saveDailyJournalEntry(event) {
    event.preventDefault();
    if (!currentUserId) {
        showMessage('message-box-app', 'User not authenticated. Please log in.', 'error');
        return;
    }
    showLoading();

    const now = new Date();
    const todayId = getFormattedDate(now);
    // If editing, only allow editing today's entry (restriction). Otherwise save to today.
    const targetDocId = currentEditDocId ? currentEditDocId : todayId;
    if (currentEditDocId && currentEditDocId !== todayId) {
        hideLoading();
        showMessage('message-box-app', 'Editing past entries is restricted. You can only edit today\'s entry.', 'error');
        return;
    }

    const entryData = {
        wakeUp: document.getElementById('wake-up-time').value,
        sleep: document.getElementById('sleep-time').value,
        noFap: document.getElementById('nofap').checked,
        noPorn: document.getElementById('noporn').checked,
        workout: document.getElementById('workout-done').checked,
        worksDone: document.getElementById('works-done').value,
        meals: {
            breakfast: document.getElementById('meal-breakfast').value,
            lunch: document.getElementById('meal-lunch').value,
            dinner: document.getElementById('meal-dinner').value,
            snacks: document.getElementById('meal-snacks').value,
        },
        screenTime: parseFloat(document.getElementById('screen-time').value) || 0,
        newThingLearned: document.getElementById('new-thing-learned').value,
        timestamp: now.toISOString(), // Consider using Firebase Timestamp objects for better date queries
    };

    try {
        const docRef = doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/journalEntries`, targetDocId);
        await setDoc(docRef, entryData, { merge: true });
        showMessage('message-box-app', 'Daily entry saved successfully!', 'success');
        // After save, reset editing state and reload
        setEditingState(null);
        loadDailyEntryForToday();
        updateStreaksAndCompletionRates();
        // Refresh logs to reflect changes
        const activeTab = document.querySelector('.tab-content.active')?.id;
        if (activeTab === 'daily-logs') {
            loadDailyLogs(document.getElementById('log-filter-time').value);
        }
    } catch (error) {
        showMessage('message-box-app', `Error saving daily entry: ${error.message}`, 'error');
        console.error("Error saving daily entry:", error);
    } finally {
        hideLoading();
    }
}

async function loadDailyEntryForToday() {
    if (!currentUserId) return;
    showLoading();
    const todayDocId = getFormattedDate(new Date());
    try {
        const docRef = doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/journalEntries`, todayDocId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('wake-up-time').value = data.wakeUp || '';
            document.getElementById('sleep-time').value = data.sleep || '';
            document.getElementById('nofap').checked = data.noFap || false;
            document.getElementById('noporn').checked = data.noPorn || false;
            document.getElementById('workout-done').checked = data.workout || false;
            document.getElementById('works-done').value = data.worksDone || '';
            document.getElementById('meal-breakfast').value = data.meals?.breakfast || '';
            document.getElementById('meal-lunch').value = data.meals?.lunch || '';
            document.getElementById('meal-dinner').value = data.meals?.dinner || '';
            document.getElementById('meal-snacks').value = data.meals?.snacks || '';
            document.getElementById('screen-time').value = data.screenTime || '';

            document.getElementById('new-thing-learned').value = data.newThingLearned || '';
            hasTodayEntry = true;
            document.getElementById('save-daily-label').textContent = "Update Today's Entry";
            setEditingState(null);
        } else {
            document.getElementById('daily-journal-form').reset();
            hasTodayEntry = false;
            document.getElementById('save-daily-label').textContent = "Save Today's Entry";
            setEditingState(null);
        }
    } catch (error) {
        showMessage('message-box-app', `Error loading daily entry: ${error.message}`, 'error');
        console.error("Error loading daily entry:", error);
    } finally {
        hideLoading();
    }
}

async function saveWeeklySaturdayEntry(event) {
    event.preventDefault();
    if (!currentUserId) {
        showMessage('message-box-app', 'User not authenticated. Please log in.', 'error');
        return;
    }
    showLoading();

    const today = new Date();
    const weekId = getISOWeekDate(today);

    const weight = parseFloat(document.getElementById('weight').value);
    if (isNaN(weight)) {
        showMessage('message-box-app', 'Please enter a valid weight.', 'error');
        hideLoading();
        return;
    }

    try {
        const weeklyDocRef = doc(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/weeklyEntries`, weekId);
        await setDoc(weeklyDocRef, { weight: weight, timestamp: today.toISOString() }, { merge: true });

        const photoFrontFile = document.getElementById('progress-photo-front').files[0];
        const photoSideFile = document.getElementById('progress-photo-side').files[0];

        const uploadPromises = [];
        if (photoFrontFile) {
            uploadPromises.push(uploadPhoto(photoFrontFile, 'front', today));
        }
        if (photoSideFile) {
            uploadPromises.push(uploadPhoto(photoSideFile, 'side', today));
        }

        await Promise.all(uploadPromises);

        showMessage('message-box-app', 'Weekly check-in saved successfully!', 'success');
        document.getElementById('weekly-saturday-form').reset();
        // Clear photo previews
        document.getElementById('preview-front').innerHTML = '<div class="photo-preview-box"><i data-lucide="plus"></i></div>';
        document.getElementById('preview-side').innerHTML = '<div class="photo-preview-box"><i data-lucide="plus"></i></div>';
        lucide.createIcons(); // Re-render Lucide icons after updating innerHTML
        loadProgressPhotos();
    } catch (error) {
        showMessage('message-box-app', `Error saving weekly entry: ${error.message}`, 'error');
        console.error("Error saving weekly entry:", error);
    } finally {
        hideLoading();
    }
}

async function uploadPhoto(file, type, date) {
    const fileName = `${currentUserId}_${date.getTime()}_${file.name}`;
    const storageRef = ref(storage, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/progressPhotos/${fileName}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    const photoDocRef = doc(collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/progressPhotos`));
    await setDoc(photoDocRef, {
        url: downloadURL,
        date: getFormattedDate(date),
        timestamp: date.toISOString(),
        type: type,
        fileName: fileName
    });
}

async function loadProgressPhotos() {
    if (!currentUserId) return;
    showLoading();
    try {
        const photosCollectionRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/progressPhotos`);
        const q = query(photosCollectionRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);

        const galleryGrid = document.getElementById('photo-gallery-grid');
        const galleryEmptyState = document.getElementById('gallery-empty-state');
        galleryGrid.innerHTML = '';
        
        if (querySnapshot.empty) {
            galleryEmptyState.classList.remove('hidden');
            hideLoading();
            return;
        }

        galleryEmptyState.classList.add('hidden');
        querySnapshot.forEach((doc) => {
            const photo = doc.data();
            const photoElement = `
                <div class="bg-card-bg rounded-lg shadow-md overflow-hidden border border-border-light transform hover:scale-105 transition duration-300 ease-in-out">
                    <img src="${photo.url}" alt="Progress Photo (${photo.type}) on ${photo.date}" class="w-full h-48 object-cover object-center rounded-t-lg">
                    <div class="p-4 text-sm text-text-secondary">
                        <p class="font-semibold text-text-primary">${photo.type.charAt(0).toUpperCase() + photo.type.slice(1)} - ${photo.date}</p>
                    </div>
                </div>
            `;
            galleryGrid.innerHTML += photoElement;
        });
    } catch (error) {
        showMessage('message-box-app', `Error loading photos: ${error.message}`, 'error');
        console.error("Error loading progress photos:", error);
    } finally {
        hideLoading();
    }
}

async function loadDailyLogs(filterType = 'all') {
    if (!currentUserId) return;
    showLoading();
    try {
        const journalCollectionRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/journalEntries`);
        const q = query(journalCollectionRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);

        const dailyLogsList = document.getElementById('daily-logs-list');
        dailyLogsList.innerHTML = '';

        if (querySnapshot.empty) {
            dailyLogsList.innerHTML = '<div class="card text-center"><p class="text-gray-600">No daily logs found yet. Start by adding a daily entry!</p></div>';
            hideLoading();
            return;
        }

        const today = new Date();
        let filteredEntries = [];

        querySnapshot.forEach((doc) => {
            const entry = doc.data();
            const entryDate = new Date(doc.id);
            let include = false;

            switch (filterType) {
                case 'all':
                    include = true;
                    break;
                case 'last-7-days':
                    if ((today - entryDate) / (1000 * 60 * 60 * 24) <= 7) include = true;
                    break;
                case 'last-30-days':
                    if ((today - entryDate) / (1000 * 60 * 60 * 24) <= 30) include = true;
                    break;
                case 'this-month':
                    if (entryDate.getMonth() === today.getMonth() && entryDate.getFullYear() === today.getFullYear()) include = true;
                    break;
                case 'this-year':
                    if (entryDate.getFullYear() === today.getFullYear()) include = true;
                    break;
            }
            if (include) {
                filteredEntries.push({ id: doc.id, ...entry });
            }
        });

        if (filteredEntries.length === 0) {
            dailyLogsList.innerHTML = `<div class="card text-center"><p class="text-gray-600">No logs found for the selected filter (${filterType}).</p></div>`;
            hideLoading();
            return;
        }

        filteredEntries.forEach((entry) => {
            const isToday = entry.id === getFormattedDate(new Date());
            const editBtnHtml = isToday
                ? `<button type="button" class="btn btn-secondary btn-sm ml-auto" onclick="startEditingEntry('${entry.id}')">
                        <i data-lucide=\"pencil\" class=\"w-4 h-4 mr-1\"></i>Edit
                    </button>`
                : `<button type="button" class="btn btn-secondary btn-sm ml-auto opacity-50 cursor-not-allowed" title="Editing past entries is restricted">
                        <i data-lucide=\"lock\" class=\"w-4 h-4 mr-1\"></i>Edit
                    </button>`;
            const logElement = `
                <div class="bg-card-bg p-6 rounded-lg shadow-md border border-border-light">
                    <div class="flex items-center mb-2">
                        <h4 class="font-bold text-xl text-text-primary">${entry.id}</h4>
                        <div class="ml-auto">${editBtnHtml}</div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-text-default mt-4">
                        <div class="flex items-center"><i data-lucide="sunrise" class="w-5 h-5 mr-2 text-accent"></i><strong>Wake Up:</strong> ${entry.wakeUp}</div>
                        <div class="flex items-center"><i data-lucide="moon" class="w-5 h-5 mr-2 text-secondary"></i><strong>Sleep:</strong> ${entry.sleep}</div>
                        <div class="flex items-center"><i data-lucide="target" class="w-5 h-5 mr-2 text-accent"></i><strong>NoFap:</strong> <span class="font-semibold ${entry.noFap ? 'text-primary-blue' : 'text-logout-red'}">${entry.noFap ? 'Yes' : 'No'}</span></div>
                        <div class="flex items-center"><i data-lucide="shield-check" class="w-5 h-5 mr-2 text-secondary"></i><strong>NoPorn:</strong> <span class="font-semibold ${entry.noPorn ? 'text-secondary-green' : 'text-logout-red'}">${entry.noPorn ? 'Yes' : 'No'}</span></div>
                        <div class="flex items-center"><i data-lucide="activity" class="w-5 h-5 mr-2 text-warning"></i><strong>Workout:</strong> <span class="font-semibold ${entry.workout ? 'text-secondary-green' : 'text-logout-red'}">${entry.workout ? 'Yes' : 'No'}</span></div>
                        ${entry.worksDone ? `<p class="col-span-full mt-2 flex items-center"><i data-lucide="briefcase" class="w-5 h-5 mr-2 text-primary"></i><strong>Works Done:</strong> ${entry.worksDone}</p>` : ''}
                        <p class="col-span-full font-semibold mt-2 flex items-center"><i data-lucide="utensils" class="w-5 h-5 mr-2 text-secondary"></i>Meals:</p>
                        <p class="pl-7"><em>Breakfast:</em> ${entry.meals?.breakfast || 'N/A'}</p>
                        <p class="pl-7"><em>Lunch:</em> ${entry.meals?.lunch || 'N/A'}</p>
                        <p class="pl-7"><em>Dinner:</em> ${entry.meals?.dinner || 'N/A'}</p>
                        <p class="pl-7"><em>Snacks:</em> ${entry.meals?.snacks || 'N/A'}</p>
                        <div class="flex items-center"><i data-lucide="smartphone" class="w-5 h-5 mr-2 text-warning"></i><strong>Screen Time:</strong> ${entry.screenTime} hours</div>
                        ${entry.newThingLearned ? `<p class="col-span-full mt-2 flex items-center"><i data-lucide="book-open" class="w-5 h-5 mr-2 text-accent"></i><strong>New Thing Learned:</strong> ${entry.newThingLearned}</p>` : ''}
                    </div>
                </div>
            `;
            dailyLogsList.innerHTML += logElement;
        });
        lucide.createIcons();

    } catch (error) {
        showMessage('message-box-app', `Error loading daily logs: ${error.message}`, 'error');
        console.error("Error loading daily logs:", error);
    } finally {
        hideLoading();
    }
}

async function calculateCurrentStreak(habitKey) {
    if (!currentUserId) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const journalCollectionRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/journalEntries`);
    const q = query(journalCollectionRef, orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);

    const entriesMap = new Map();
    querySnapshot.forEach(docSnap => {
        const entryData = docSnap.data();
        const entryDate = new Date(docSnap.id);
        entryDate.setHours(0,0,0,0);
        entriesMap.set(getFormattedDate(entryDate), { ...entryData, dateObj: entryDate });
    });

    let streak = 0;
    let tempStreakDate = new Date(today);
    tempStreakDate.setHours(0, 0, 0, 0);

    const todayEntry = entriesMap.get(getFormattedDate(today));
    if (!todayEntry || !todayEntry[habitKey]) {
        return 0;
    }

    while (true) {
        const formattedDate = getFormattedDate(tempStreakDate);
        const entry = entriesMap.get(formattedDate);

        if (entry && entry[habitKey]) {
            streak++;
            tempStreakDate.setDate(tempStreakDate.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

async function updateStreaksAndCompletionRates() {
    if (!currentUserId) return;
    showLoading();
    try {
        const journalCollectionRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/journalEntries`);
        const allEntriesSnapshot = await getDocs(query(journalCollectionRef, orderBy('timestamp', 'desc')));
        const allEntries = [];
        allEntriesSnapshot.forEach(docSnap => {
            const entryData = docSnap.data();
            const entryDate = new Date(docSnap.id);
            entryDate.setHours(0,0,0,0);
            allEntries.push({ id: docSnap.id, ...entryData, dateObj: entryDate });
        });

        const noFapStreak = await calculateCurrentStreak('noFap');
        document.getElementById('nofap-streak').textContent = noFapStreak;

        const noPornStreak = await calculateCurrentStreak('noPorn');
        document.getElementById('noporn-streak').textContent = noPornStreak;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);

        let countWorkoutDays = 0;
        let countTotalDaysInWindow = 0;

        for (let d = new Date(sevenDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
            countTotalDaysInWindow++;
            const formattedDate = getFormattedDate(d);
            const entry = allEntries.find(e => e.id === formattedDate);
            if (entry && entry.workout) {
                countWorkoutDays++;
            }
        }

        let workoutRate = countTotalDaysInWindow > 0 ? ((countWorkoutDays / countTotalDaysInWindow) * 100).toFixed(0) : 0;
        document.getElementById('workout-completion-rate').textContent = `${workoutRate}%`;

    } catch (error) {
        console.error("Error updating streaks:", error);
        showMessage('message-box-app', 'Error calculating streaks. See console for details.', 'error');
    } finally {
        hideLoading();
    }
}

async function exportToCsv() {
    if (!currentUserId) {
        showMessage('message-box-app', 'User not authenticated. Cannot export data.', 'error');
        return;
    }
    showLoading();
    try {
        const journalCollectionRef = collection(db, `artifacts/${firebaseConfig.appId}/users/${currentUserId}/journalEntries`);
        const querySnapshot = await getDocs(query(journalCollectionRef, orderBy('timestamp', 'asc'))); // Order ascending for CSV
        
        let csvContent = "data:text/csv;charset=utf-8,";
        let headers = [
            "Date", "WakeUp", "Sleep", "NoFap", "NoPorn", "Workout", "WorksDone",
            "MealBreakfast", "MealLunch", "MealDinner", "MealSnacks",
            "ScreenTime", "Mood", "NewThingLearned", "Timestamp"
        ];
        csvContent += headers.join(",") + "\n";

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const row = [
                docSnap.id,
                data.wakeUp || '',
                data.sleep || '',
                data.noFap ? 'Yes' : 'No',
                data.noPorn ? 'Yes' : 'No',
                data.workout ? 'Yes' : 'No',
                `"${(data.worksDone || '').replace(/"/g, '""')}"`,
                `"${(data.meals?.breakfast || '').replace(/"/g, '""')}"`,
                `"${(data.meals?.lunch || '').replace(/"/g, '""')}"`,
                `"${(data.meals?.dinner || '').replace(/"/g, '""')}"`,
                `"${(data.meals?.snacks || '').replace(/"/g, '""')}"`,
                data.screenTime || '',

                `"${(data.newThingLearned || '').replace(/"/g, '""')}"`,
                data.timestamp || ''
            ];
            csvContent += row.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `habit_tracker_data_${getFormattedDate()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showMessage('message-box-app', 'Data exported to CSV!', 'success');

    } catch (error) {
        showMessage('message-box-app', `Error exporting data: ${error.message}`, 'error');
        console.error("Error exporting CSV:", error);
    } finally {
        hideLoading();
    }
}

// --- Event Listeners and Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebarMenu = document.getElementById('sidebar-menu');
    const mainContent = document.querySelector('.main-content');


    const ctaGoToDashboardBtn = document.getElementById('cta-go-to-dashboard');
    const dashboardNavItem = document.querySelector('.nav-item[data-tab="dashboard"]');
    const tabContents = document.querySelectorAll('.tab-content');

    initializeFirebase();

    // Initialize Lucide icons
    lucide.createIcons();
    
    // Show authentication UI by default until auth state is determined
    showAuthenticationForm();

    // Authentication state listener
    onAuthStateChanged(auth, async (user) => {
        isAuthReady = true;
        if (user) {
            currentUserId = user.uid;
            await ensureUserProfile(user); // Ensure user profile exists upon login
            
            let displayUsername = "User";
            try {
                const userDocRef = doc(db, `artifacts/${firebaseConfig.appId}/users`, currentUserId);
                const userDocSnap = await getDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userData.username && userData.username.trim()) {
                        displayUsername = userData.username.trim();
                    } else if (user.email) {
                        displayUsername = user.email.split('@')[0];
                    }
                } else if (user.email) {
                    displayUsername = user.email.split('@')[0];
                }
            } catch (error) {
                console.error('Error fetching username:', error);
                if (user.email) {
                    displayUsername = user.email.split('@')[0];
                }
            }
            document.getElementById('current-username').textContent = `Hello, ${displayUsername}!`;

            showAuthenticatedApp();
            document.getElementById('current-date').textContent = getFormattedDate();
            loadDailyEntryForToday();
            updateStreaksAndCompletionRates();
            loadProgressPhotos();
            loadDailyLogs('last-7-days');

            if (isSaturday()) {
                document.getElementById('weekly-saturday-form-container').classList.remove('hidden');
            } else {
                document.getElementById('weekly-saturday-form-container').classList.add('hidden');
            }
            setActiveTab('dashboard');
        } else {
            currentUserId = null;
            showAuthenticationForm();
            document.getElementById('current-username').textContent = '';
            // If not logged in, always redirect to login page.
            // This is crucial since index.html expects an authenticated user.
            window.location.href = 'login.html';
        }
        hideLoading();
    });

    // Form submissions
    document.getElementById('daily-journal-form').addEventListener('submit', saveDailyJournalEntry);
    document.getElementById('weekly-saturday-form').addEventListener('submit', saveWeeklySaturdayEntry);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            setActiveTab(tabId);
            if (tabId === 'daily-logs') {
                loadDailyLogs(document.getElementById('log-filter-time').value);
            } else if (tabId === 'gallery') {
                loadProgressPhotos();
            } else if (tabId === 'dashboard') {
                loadDailyEntryForToday();
                updateStreaksAndCompletionRates();
            }
        });
    });

    // Logout buttons
    document.getElementById('logout-button').addEventListener('click', showLogoutConfirmation);
    document.getElementById('settings-logout-button').addEventListener('click', showLogoutConfirmation);

    // Logout Confirmation Modal buttons
    document.getElementById('confirm-logout-button').addEventListener('click', () => {
        document.getElementById('logout-modal').classList.add('hidden');
        handleLogout();
    });
    document.getElementById('cancel-logout-button').addEventListener('click', () => {
        document.getElementById('logout-modal').classList.add('hidden');
    });

    // Daily Logs Filter
    document.getElementById('apply-filter-btn').addEventListener('click', () => {
        const filterType = document.getElementById('log-filter-time').value;
        loadDailyLogs(filterType);
    });

    // CSV Export
    document.getElementById('export-csv-button').addEventListener('click', exportToCsv);

    // Photo Preview Logic
    const setupPhotoPreview = (fileInputId, previewContainerId) => {
        const fileInput = document.getElementById(fileInputId);
        const previewContainer = document.getElementById(previewContainerId);

        fileInput.addEventListener('change', (event) => {
            previewContainer.innerHTML = ''; // Clear previous previews
            if (event.target.files && event.target.files[0]) {
                const file = event.target.files[0];
                const reader = new FileReader();

                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    const previewBox = document.createElement('div');
                    previewBox.className = 'photo-preview-box has-image';
                    previewBox.appendChild(img);
                    previewContainer.appendChild(previewBox);
                };
                reader.readAsDataURL(file);
            } else {
                // If no file selected, show placeholder
                const placeholderBox = document.createElement('div');
                placeholderBox.className = 'photo-preview-box';
                placeholderBox.innerHTML = '<i data-lucide="plus"></i>';
                previewContainer.appendChild(placeholderBox);
                lucide.createIcons(); // Re-render Lucide icons
            }
        });
    };

    setupPhotoPreview('progress-photo-front', 'preview-front');
    setupPhotoPreview('progress-photo-side', 'preview-side');

    if (mobileMenuToggle && sidebarMenu && mainContent) {
            mobileMenuToggle.addEventListener('click', () => {
                sidebarMenu.classList.toggle('open');
            });

            // Close sidebar when clicking outside on mobile
            mainContent.addEventListener('click', (event) => {
                if (sidebarMenu.classList.contains('open') && !event.target.closest('#sidebar-menu')) {
                    sidebarMenu.classList.remove('open');
                    }
            });

            // Close sidebar when a nav item is clicked on mobile
            document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
            if (window.innerWidth < 1024) {
                sidebarMenu.classList.remove('open');
            }});
        });
    }


    // Function to switch tabs
    function switchTab(tabId) {
        // Hide all tab contents
        tabContents.forEach(tab => tab.classList.remove('active'));

        // Show the selected tab content
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.classList.add('active');
        }

        // Update active class on nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`.nav-item[data-tab="${tabId}"]`).classList.add('active');
    }

    // Event listener for the "Go to Dashboard" button
    ctaGoToDashboardBtn.addEventListener('click', () => {
        switchTab('dashboard');
    });

    // Event listeners for your sidebar navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            switchTab(tabId);
        });
    });
});

// Cancel Edit button wiring
const cancelEditBtn = document.getElementById('cancel-edit-button');
if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
        // Reset form and editing state, reload today's entry
        const form = document.getElementById('daily-journal-form');
        if (form) form.reset();
        setEditingState(null);
        loadDailyEntryForToday();
        showMessage('message-box-app', 'Edit cancelled.', 'info');
    });
}

