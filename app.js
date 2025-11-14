const statusBox = document.getElementById("status");
const librarySection = document.getElementById("library");
const gallery = document.getElementById("gallery");
const signOutBtn = document.getElementById("sign-out");
const uploadForm = document.getElementById("upload-form");
const modalBackdrop = document.getElementById("modal-backdrop");
const modalViews = document.querySelectorAll(".modal-view");
const modalCloseBtn = document.querySelector(".close-modal");
const navButtons = document.querySelectorAll(".nav-link");
const views = document.querySelectorAll(".view");

const setStatus = (message, isError = false) => {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.style.background = isError ? "#fee2e2" : "#e0f2fe";
  statusBox.style.color = isError ? "#991b1b" : "#0c4a6e";
};

const toggleLibrary = (visible) => {
  librarySection?.classList.toggle("hidden", !visible);
  signOutBtn?.classList.toggle("hidden", !visible);
};

const showView = (viewId) => {
  views.forEach((section) => section.classList.toggle("active", section.id === viewId));
  navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === viewId));
};

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

const openModal = (name) => {
  modalViews.forEach((view) => view.classList.toggle("hidden", view.dataset.modalView !== name));
  modalBackdrop?.classList.remove("hidden");
};

const closeModal = () => modalBackdrop?.classList.add("hidden");

modalCloseBtn?.addEventListener("click", closeModal);
modalBackdrop?.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});

document.querySelectorAll("[data-modal]").forEach((btn) => {
  btn.addEventListener("click", () => openModal(btn.dataset.modal));
});

let Amplify;
let Auth;
let Storage;

const ensureAuthReady = () => {
  if (!Auth) {
    setStatus("AWS Amplify failed to load. Refresh once the CDN script is available.", true);
    return false;
  }
  return true;
};

const ensureStorageReady = () => {
  if (!Storage) {
    setStatus("Storage client unavailable. Verify Amplify configuration.", true);
    return false;
  }
  return true;
};

const configureAmplify = () => {
  const amplifyLib = window.aws_amplify;
  if (!amplifyLib) {
    console.warn("Amplify CDN script missing. Navigation still works but auth is disabled.");
    setStatus("AWS Amplify not loaded yet. Check your network connection.", true);
    return;
  }
  ({ Amplify, Auth, Storage } = amplifyLib);
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: "YOUR_USER_POOL_ID",
        userPoolClientId: "YOUR_WEB_CLIENT_ID",
        loginWith: { username: false, email: true, phone: false },
        signUpVerificationMethod: "code",
        userAttributes: {
          email: { required: true }
        },
        passwordFormat: {
          minLength: 6,
          maxLength: 24,
          requireLowercase: true,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialCharacters: true
        }
      }
    },
    Storage: {
      S3: {
        bucket: "photos",
        region: "YOUR_BUCKET_REGION",
        defaultAccessLevel: "private"
      }
    }
  });
};

configureAmplify();

const requirePasswordStrength = (value) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,24}$/;
  if (!regex.test(value)) {
    throw new Error("Password must be 6-24 chars and include lower, upper, number, and symbol.");
  }
};

const refreshGallery = async () => {
  if (!gallery || !ensureStorageReady()) return;
  try {
    const files = await Storage.list("", { level: "private" });
    const items = files?.items ?? files ?? [];
    gallery.innerHTML = "";
    const originals = items.filter((file) => file.key?.includes("/original/"));

    if (!originals.length) {
      gallery.innerHTML = '<div class="thumb">No photos yet. Upload your first image.</div>';
      return;
    }

    for (const file of originals) {
      const thumbKey = file.key.replace("/original/", "/thumbnails/");
      const thumbUrl = await Storage.get(thumbKey, { level: "private" }).catch(() =>
        Storage.get(file.key, { level: "private" })
      );
      const fullUrl = await Storage.get(file.key, { level: "private" });
      const card = document.createElement("a");
      card.href = fullUrl;
      card.target = "_blank";
      card.rel = "noreferrer";
      card.className = "thumb";
      card.innerHTML = `<img src="${thumbUrl}" alt="Photo thumbnail" loading="lazy" />`;
      gallery.append(card);
    }
  } catch (error) {
    console.error(error);
    gallery.innerHTML = `<div class="thumb">${error.message}</div>`;
  }
};

const onSignedIn = async (user) => {
  toggleLibrary(true);
  setStatus(`Welcome back ${user?.attributes?.email || ""}!`);
  await refreshGallery();
};

const signInForm = document.getElementById("sign-in-form");
signInForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureAuthReady()) return;
  const email = document.getElementById("sign-in-email").value;
  const password = document.getElementById("sign-in-password").value;
  try {
    const user = await Auth.signIn({ username: email, password });
    await onSignedIn(user);
    closeModal();
  } catch (error) {
    setStatus(error.message, true);
  }
});

const signUpForm = document.getElementById("sign-up-form");
signUpForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureAuthReady()) return;
  const email = document.getElementById("sign-up-email").value;
  const password = document.getElementById("sign-up-password").value;
  try {
    requirePasswordStrength(password);
    await Auth.signUp({ username: email, password, options: { userAttributes: { email } } });
    setStatus("Sign-up success. Check your email for the 6-digit code then confirm.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

const confirmForm = document.getElementById("confirm-form");
confirmForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureAuthReady()) return;
  const email = document.getElementById("confirm-email").value;
  const code = document.getElementById("confirm-code").value;
  try {
    await Auth.confirmSignUp(email, code);
    setStatus("Email verified. You may sign in now.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

const resendBtn = document.getElementById("resend-code");
resendBtn?.addEventListener("click", async () => {
  if (!ensureAuthReady()) return;
  const email = document.getElementById("confirm-email").value || document.getElementById("sign-up-email").value;
  if (!email) {
    setStatus("Enter an email first.", true);
    return;
  }
  try {
    await Auth.resendSignUp(email);
    setStatus("New confirmation code sent.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

const sendResetBtn = document.getElementById("send-reset-code");
sendResetBtn?.addEventListener("click", async () => {
  if (!ensureAuthReady()) return;
  const email = document.getElementById("reset-email").value;
  if (!email) {
    setStatus("Provide your email to receive a reset code.", true);
    return;
  }
  try {
    await Auth.forgotPassword(email);
    setStatus("Reset code sent. Check your inbox.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

const resetForm = document.getElementById("reset-form");
resetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureAuthReady()) return;
  const email = document.getElementById("reset-email").value;
  const code = document.getElementById("reset-code").value;
  const password = document.getElementById("reset-password").value;
  try {
    requirePasswordStrength(password);
    await Auth.forgotPasswordSubmit(email, code, password);
    setStatus("Password updated. Sign in with the new password.");
    closeModal();
  } catch (error) {
    setStatus(error.message, true);
  }
});

signOutBtn?.addEventListener("click", async () => {
  if (!ensureAuthReady()) return;
  try {
    await Auth.signOut();
    toggleLibrary(false);
    setStatus("Signed out.");
    if (gallery) {
      gallery.innerHTML = '<div class="thumb">Sign in to load thumbnails.</div>';
    }
  } catch (error) {
    setStatus(error.message, true);
  }
});

uploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureAuthReady() || !ensureStorageReady()) return;
  const fileInput = document.getElementById("photo-input");
  const file = fileInput.files[0];
  if (!file) {
    setStatus("Select a file first.", true);
    return;
  }
  try {
    const user = await Auth.currentAuthenticatedUser();
    const sub = user.attributes.sub;
    const key = `${sub}/original/${crypto.randomUUID()}-${file.name}`;
    await Storage.put(key, file, { level: "private", contentType: file.type });
    setStatus("Upload successful. Thumbnails appear shortly.");
    fileInput.value = "";
    setTimeout(refreshGallery, 4000);
  } catch (error) {
    setStatus(error.message, true);
  }
});

(async () => {
  if (!ensureAuthReady()) return;
  try {
    const user = await Auth.currentAuthenticatedUser();
    await onSignedIn(user);
  } catch (error) {
    toggleLibrary(false);
    console.info("No existing session", error?.message);
  }
})();
