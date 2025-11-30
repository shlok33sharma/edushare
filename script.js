

/* ===========================
  EduShare (Firebase-only)
  - Auth: Firebase Auth (email/password)
  - DB: Firestore (users, resources, messages, contacts)
  - Storage: Firebase Storage (profile pictures, uploaded files)
  =========================== */

/* ------------------------
  CONFIG - REPLACE WITH YOUR FIREBASE CONFIG
  Go to Firebase Console -> Project Settings -> Your apps -> Config
-------------------------*/
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAJBJdaNZQ8zcfIN7H4jFEp0jf7UqeJC6c",
  authDomain: "edushare-963a9.firebaseapp.com",
  projectId: "edushare-963a9",
  storageBucket: "edushare-963a9.firebasestorage.app",
  messagingSenderId: "626295794311",
  appId: "1:626295794311:web:aec66e482a5fbcbe61a622",
  measurementId: "G-LB0RC0B17W"
};
/* ------------------------
   END CONFIG
-------------------------*/

/* Initialize Firebase (compat) */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* ---------- UI binds ---------- */
const authModal = document.getElementById('authModal');
const btnOpenAuth = document.getElementById('btnOpenAuth');
const closeAuth = document.getElementById('closeAuth');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginEmail = document.getElementById('loginEmail');
const loginPass = document.getElementById('loginPass');
const signupName = document.getElementById('signupName');
const signupEmail = document.getElementById('signupEmail');
const signupPass = document.getElementById('signupPass');
const signupRole = document.getElementById('signupRole');
const tabs = document.querySelectorAll('.tab');

const authActions = document.getElementById('authActions');
const dashboardSection = document.querySelector('.dashboard-preview');
const welcomeText = document.getElementById('welcomeText');
const userEmailEl = document.getElementById('userEmail');
const userRoleEl = document.getElementById('userRole');
const avatarImg = document.getElementById('avatarImg');
const btnLogout = document.getElementById('btnLogout');
const btnEditProfile = document.getElementById('btnEditProfile');

const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const titleInput = document.getElementById('title');
const categoryInput = document.getElementById('category');
const isPublicInput = document.getElementById('isPublic');
const uploadStatus = document.getElementById('uploadStatus');
const myUploadsList = document.getElementById('myUploadsList');
const resourceList = document.getElementById('resourceList');

const contactForm = document.getElementById('contactForm');

const profileModal = document.getElementById('profileModal');
const closeProfile = document.getElementById('closeProfile');
const profileForm = document.getElementById('profileForm');
const profileName = document.getElementById('profileName');
const profileRole = document.getElementById('profileRole');
const avatarInput = document.getElementById('avatarInput');
const btnCancelProfile = document.getElementById('btnCancelProfile');

const messageForm = document.getElementById('messageForm');
const messageText = document.getElementById('messageText');
const messagesList = document.getElementById('messagesList');

/* ---------- Modal & tabs ---------- */
btnOpenAuth.addEventListener('click', () => authModal.classList.remove('hidden'));
closeAuth.addEventListener('click', () => authModal.classList.add('hidden'));
closeProfile.addEventListener('click', () => profileModal.classList.add('hidden'));
btnCancelProfile.addEventListener('click', () => profileModal.classList.add('hidden'));

tabs.forEach(t=>{
  t.addEventListener('click', () => {
    tabs.forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    if(tab === 'login') document.getElementById('loginForm').classList.add('active');
    else document.getElementById('signupForm').classList.add('active');
  });
});

/* ---------- Auth flows ---------- */
// Sign up
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = signupName.value.trim();
  const email = signupEmail.value.trim();
  const pass = signupPass.value;
  const role = signupRole.value || 'student';

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name || email.split('@')[0] });

    // Create Firestore user doc
    await db.collection('users').doc(cred.user.uid).set({
      name: cred.user.displayName || name,
      email,
      role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert('Account created and logged in.');
    authModal.classList.add('hidden');
    signupForm.reset();
  } catch (err) {
    alert('Signup error: ' + err.message);
  }
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await auth.signInWithEmailAndPassword(loginEmail.value.trim(), loginPass.value);
    authModal.classList.add('hidden');
    loginForm.reset();
  } catch (err) {
    alert('Login failed: ' + err.message);
  }
});

// Logout
btnLogout.addEventListener('click', () => auth.signOut());

/* ---------- Auth state observer ---------- */
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // show dashboard UI
    authActions.innerHTML = `<div class="profile-inline"><strong>${user.displayName || user.email}</strong></div>`;
    dashboardSection.classList.remove('hidden');
    welcomeText.innerText = `Welcome, ${user.displayName || 'Learner'}`;
    userEmailEl.innerText = user.email;

    // load profile info from Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      userRoleEl.innerText = data.role ? `Role: ${data.role}` : '';
      profileName.value = data.name || user.displayName || '';
      profileRole.value = data.role || 'student';
    } else {
      userRoleEl.innerText = '';
    }

    // try load avatar from storage
    try {
      const avatarRef = storage.ref().child(`profiles/${user.uid}/avatar.jpg`);
      const url = await avatarRef.getDownloadURL();
      avatarImg.src = url;
      avatarImg.style.display = 'inline-block';
    } catch (err) {
      avatarImg.style.display = 'none';
    }

    // wire edit profile
    btnEditProfile.onclick = () => profileModal.classList.remove('hidden');

    // start realtime listeners
    loadMyUploads(user.uid);
  } else {
    authActions.innerHTML = `<button id="btnOpenAuth" class="btn-outline">Login / Sign Up</button>`;
    document.getElementById('btnOpenAuth').addEventListener('click', ()=> authModal.classList.remove('hidden'));
    dashboardSection.classList.add('hidden');
    welcomeText.innerText = `Welcome`;
    userEmailEl.innerText = `—`;
    userRoleEl.innerText = '';
    avatarImg.style.display = 'none';
  }
});

/* ---------- Profile save (including avatar) ---------- */
profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert('Login first');
  const name = profileName.value.trim();
  const role = profileRole.value;

  try {
    // update displayName
    await user.updateProfile({ displayName: name });
    // upload avatar if provided
    if (avatarInput.files[0]) {
      const file = avatarInput.files[0];
      const ref = storage.ref().child(`profiles/${user.uid}/avatar.jpg`);
      await ref.put(file);
      const url = await ref.getDownloadURL();
      avatarImg.src = url;
      avatarImg.style.display = 'inline-block';
    }

    // update firestore user doc
    await db.collection('users').doc(user.uid).set({
      name,
      role,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    alert('Profile updated');
    profileModal.classList.add('hidden');
  } catch (err) {
    alert('Profile save failed: ' + err.message);
  }
});

/* ---------- Upload file to Firebase Storage + store metadata ---------- */
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) { alert('Please login to upload.'); return; }

  const file = fileInput.files[0];
  const title = titleInput.value.trim();
  const category = categoryInput.value;
  const isPublic = !!isPublicInput.checked;

  if (!file) return alert('Please select a file');

  uploadStatus.innerText = 'Uploading file...';

  try {
    const timestamp = Date.now();
    // path: resources/{uid}/{timestamp}_{filename}
    const safeName = file.name.replace(/\s+/g, '_');
    const storageRef = storage.ref().child(`resources/${user.uid}/${timestamp}_${safeName}`);
    const uploadTask = await storageRef.put(file);

    // get download URL
    const url = await uploadTask.ref.getDownloadURL();

    // save metadata to Firestore
    const doc = {
      title: title || file.name,
      filename: file.name,
      url,
      size: file.size,
      format: file.type || '',
      storage_path: uploadTask.ref.fullPath,
      uploader_uid: user.uid,
      uploader_name: user.displayName || user.email,
      category,
      isPublic,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('resources').add(doc);
    uploadStatus.innerText = 'Uploaded successfully!';
    uploadForm.reset();
  } catch (err) {
    console.error(err);
    uploadStatus.innerText = 'Upload failed: ' + err.message;
  }
});

/* ---------- Realtime: loadMyUploads (for dashboard) ---------- */
function loadMyUploads(uid) {
  const q = db.collection('resources').where('uploader_uid','==',uid).orderBy('createdAt','desc').limit(50);
  q.onSnapshot(snapshot => {
    myUploadsList.innerHTML = '';
    if (snapshot.empty) {
      myUploadsList.innerHTML = '<p class="muted">No uploads yet.</p>';
      return;
    }
    snapshot.forEach(doc => {
      const r = doc.data();
      myUploadsList.appendChild(createResourceCard(r, doc.id, true));
    });
  });
}

/* ---------- Realtime: load all public resources (browse) ---------- */
function loadAllResources() {
  const q = db.collection('resources').where('isPublic','==', true).orderBy('createdAt','desc').limit(100);
  q.onSnapshot(snapshot => {
    resourceList.innerHTML = '';
    if (snapshot.empty) {
      resourceList.innerHTML = '<p class="muted">No public resources yet.</p>';
      return;
    }
    snapshot.forEach(doc => {
      const r = doc.data();
      resourceList.appendChild(createResourceCard(r, doc.id, false));
    });
  });
}

/* ---------- Resource card creator ---------- */
function createResourceCard(r, id, allowDelete) {
  const card = document.createElement('div');
  card.className = 'resource-card';

  // preview logic: if image, show thumbnail
  if (r.format && r.format.startsWith('image')) {
    const img = document.createElement('img');
    img.src = r.url;
    img.alt = r.title || r.filename;
    card.appendChild(img);
  } else {
    const box = document.createElement('div');
    box.style.minHeight = '120px';
    box.style.borderRadius = '8px';
    box.style.display = 'flex';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'center';
    box.style.background = 'linear-gradient(90deg,#eef2ff,#fbf7ff)';
    box.innerHTML = `<div style="text-align:center;padding:12px"><strong>${(r.title || r.filename).slice(0,40)}</strong><div style="font-size:12px;color:#6b7280;margin-top:6px">${r.format || 'file'}</div></div>`;
    card.appendChild(box);
  }

  const title = document.createElement('div');
  title.className = 'title';
  title.innerText = r.title || r.filename;
  card.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const left = document.createElement('div');
  left.innerHTML = `<div style="font-weight:600">${r.uploader_name || 'Unknown'}</div><div style="font-size:12px;color:#94a3b8">${r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toLocaleString() : ''}</div>`;
  const right = document.createElement('div');
  right.innerHTML = `<a href="${r.url}" target="_blank" class="btn-outline" style="font-size:12px;padding:6px 8px">Open</a>
                     <a href="${r.url}" download class="btn-outline" style="font-size:12px;padding:6px 8px;margin-left:6px">Download</a>`;
  meta.appendChild(left);
  meta.appendChild(right);
  card.appendChild(meta);

  if (allowDelete) {
    const del = document.createElement('button');
    del.className = 'btn-danger';
    del.style.marginTop = '8px';
    del.innerText = 'Delete';
    del.addEventListener('click', async () => {
      if (!confirm('Delete this resource? This removes metadata and storage file.')) return;
      try {
        // delete storage file
        if (r.storage_path) {
          await storage.ref().child(r.storage_path).delete();
        }
        // delete firestore doc
        await db.collection('resources').doc(id).delete();
        card.remove();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    });
    card.appendChild(del);
  }

  return card;
}

/* ---------- Messages (real-time) ---------- */
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  const text = messageText.value.trim();
  if (!text) return;
  try {
    await db.collection('messages').add({
      text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      uid: user ? user.uid : null,
      author: user ? (user.displayName || user.email) : 'Anonymous'
    });
    messageForm.reset();
  } catch (err) {
    alert('Post failed: ' + err.message);
  }
});

function loadMessages() {
  const q = db.collection('messages').orderBy('createdAt','desc').limit(100);
  q.onSnapshot(snapshot => {
    messagesList.innerHTML = '';
    if (snapshot.empty) {
      messagesList.innerHTML = '<p class="muted">No messages yet.</p>';
      return;
    }
    snapshot.forEach(doc => {
      const m = doc.data();
      const card = document.createElement('div');
      card.className = 'resource-card';
      card.innerHTML = `<div style="font-weight:700">${m.author || 'Anon'}</div>
                        <div style="margin-top:8px">${m.text}</div>
                        <div style="font-size:12px;color:${'#64748b'};margin-top:8px">${m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toLocaleString() : ''}</div>`;
      messagesList.appendChild(card);
    });
  });
}

/* ---------- Contact form (store in Firestore) ---------- */
contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(contactForm);
  const payload = {
    name: fd.get('name'),
    email: fd.get('email'),
    message: fd.get('message'),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    await db.collection('contacts').add(payload);
    alert('Thank you — message received.');
    contactForm.reset();
  } catch (err) {
    alert('Send failed: ' + err.message);
  }
});

/* ---------- initial load for browse & messages ---------- */
loadAllResources();
loadMessages();

/* ---------- Firestore rules suggestion (set in Firebase console) ----------
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /resources/{doc} {
      allow read: if resource.data.isPublic == true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && request.auth.uid == resource.data.uploader_uid;
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /messages/{doc} {
      allow read: if true;
      allow create: if true;
      allow delete: if false;
    }
    match /contacts/{doc} {
      allow create: if true;
    }
  }
}
-------------------------------------------------------------------------- */

/* Utility: loadAllResources implementation (defined after helper functions) */
function loadAllResources() {
  const q = db.collection('resources').where('isPublic','==', true).orderBy('createdAt','desc').limit(100);
  q.onSnapshot(snapshot => {
    resourceList.innerHTML = '';
    if (snapshot.empty) {
      resourceList.innerHTML = '<p class="muted">No public resources yet.</p>';
      return;
    }
    snapshot.forEach(doc => {
      const r = doc.data();
      resourceList.appendChild(createResourceCard(r, doc.id, false));
    });
  });
}
