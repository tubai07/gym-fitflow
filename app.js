/** @returns {string|null} */
function getYouTubeId(url) {
  if (!url) return null;
  url = url.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
      return u.searchParams.get("v");
    }
  } catch {
    const m = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
  }
  return null;
}

function youtubeThumb(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHomeGrid(session) {
  const grid = document.getElementById("workoutGrid");
  if (!grid || typeof WORKOUTS === "undefined") return;

  grid.innerHTML = ""; // Clear existing cards to prevent duplication
  const frag = document.createDocumentFragment();
  const hasSession = !!session || (typeof db === "undefined" || !db.isConfigured());

  WORKOUTS.forEach((item) => {
    const card = document.createElement("a");
    card.className = "workout-card";
    if (hasSession) {
      card.href = `workout.html?day=${encodeURIComponent(item.id)}`;
    } else {
      card.href = "auth.html";
    }
    card.innerHTML = `
      <div class="thumb">
        <img src="assets/thumbs/${encodeURIComponent(item.id)}.jpg" alt="" width="316" height="274" loading="lazy" decoding="async">
      </div>
      <div class="card-foot">
        <span class="card-title">${escapeHtml(item.title)}</span>
        <span class="card-icon">${ICON.chevronRight}</span>
      </div>`;
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}

function canEmbedYouTube() {
  return location.protocol === "http:" || location.protocol === "https:";
}

function getVideoModal() {
  let modal = document.getElementById("videoModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "videoModal";
  modal.className = "video-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="video-modal__backdrop" data-close></div>
    <div class="video-modal__panel" role="dialog" aria-modal="true" aria-labelledby="videoModalTitle">
      <button type="button" class="video-modal__close" data-close aria-label="Close video"></button>
      <h2 id="videoModalTitle" class="video-modal__title"></h2>
      <div class="video-modal__player-wrap">
        <div id="videoHost" class="video-host"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeVideoModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeVideoModal();
  });

  return modal;
}

function destroyActivePlayer() {
  const host = document.getElementById("videoHost");
  if (host) host.replaceChildren();
}

function closeVideoModal() {
  const modal = document.getElementById("videoModal");
  if (!modal) return;
  destroyActivePlayer();
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function openVideoModal(videoId, title) {
  if (!canEmbedYouTube()) {
    window.open(
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      "_blank",
      "noopener"
    );
    return;
  }

  const modal = getVideoModal();
  const host = document.getElementById("videoHost");
  const titleEl = document.getElementById("videoModalTitle");

  destroyActivePlayer();
  titleEl.textContent = title;

  const origin = encodeURIComponent(location.origin);
  const embedId = encodeURIComponent(videoId);
  const src =
    `https://www.youtube.com/embed/${embedId}?autoplay=1&rel=0&modestbranding=1` +
    `&playsinline=1&enablejsapi=1&origin=${origin}`;

  const iframe = document.createElement("iframe");
  iframe.className = "youtube-player";
  iframe.src = src;
  iframe.title = title;
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;

  host.replaceChildren(iframe);
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function initUserProfile() {
  const container = document.getElementById("userProfile");
  if (!container) return;

  if (typeof db === "undefined" || !db.isConfigured()) {
    container.innerHTML = `<span style="font-size:12px;color:var(--muted)">Local Mode</span>`;
    const editToggleBtn = document.getElementById("editToggleBtn");
    if (editToggleBtn) editToggleBtn.style.display = "block";
    return;
  }

  db.onAuthStateChange((event, session) => {
    if (session) {
      const name = session.user.user_metadata?.name || session.user.email || session.user.phone || "User";
      const initial = name.charAt(0).toUpperCase();
      container.innerHTML = `
        <div class="profile-menu-container">
          <button type="button" class="profile-trigger" id="profileTriggerBtn">
            <span class="profile-avatar">${initial}</span>
            <span>${escapeHtml(name)}</span>
          </button>
        </div>
      `;

      // Trigger profile sidebar
      const trigger = document.getElementById("profileTriggerBtn");
      if (trigger) {
        trigger.addEventListener("click", () => {
          openProfileSidebar(session.user);
        });
      }
    } else {
      container.innerHTML = `
        <a href="auth.html" class="btn-signin">Sign In</a>
      `;
    }
    
    // Always show edit button if present
    const editToggleBtn = document.getElementById("editToggleBtn");
    if (editToggleBtn) editToggleBtn.style.display = "block";
  });
}

function getProfileSidebar() {
  let sidebar = document.getElementById("profileSidebar");
  if (sidebar) return sidebar;

  sidebar = document.createElement("div");
  sidebar.id = "profileSidebar";
  sidebar.className = "profile-sidebar";
  sidebar.hidden = true;

  sidebar.innerHTML = `
    <div class="profile-sidebar__backdrop" data-close></div>
    <div class="profile-sidebar__panel" role="dialog" aria-modal="true" aria-labelledby="sidebarUserName">
      <div class="profile-sidebar__header">
        <div class="profile-sidebar__user">
          <span class="profile-avatar profile-avatar--large" id="sidebarAvatar">U</span>
          <div class="profile-sidebar__user-info">
            <h3 id="sidebarUserName" class="sidebar-user-name">User Name</h3>
            <p id="sidebarUserEmail" class="sidebar-user-email">user@example.com</p>
          </div>
        </div>
        <button type="button" class="profile-sidebar__close" data-close aria-label="Close menu">&times;</button>
      </div>

      <div class="profile-sidebar__content">
        <!-- BMI Calculator Link -->
        <a href="bmi.html" class="sidebar-bmi-link">
          <div class="sidebar-bmi-link__text">
            <h4>BMI Calculator</h4>
            <p>Check and track your BMI index</p>
          </div>
          <svg class="sidebar-bmi-link__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>

        <hr class="sidebar-divider">

        <!-- Profile Settings (Dropdown Details section) -->
        <details class="sidebar-section" id="sidebarProfileDetails">
          <summary class="sidebar-section-title">
            <span>Profile Settings</span>
            <svg class="sidebar-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </summary>
          <form id="profileForm" class="profile-form">
            <div class="form-group">
              <label for="profileName">Full Name</label>
              <input type="text" id="profileName" placeholder="Your Name" required autocomplete="name">
            </div>
            
            <div class="form-group">
              <label for="profileEmail">Email Address</label>
              <input type="email" id="profileEmail" placeholder="you@example.com" readonly style="opacity: 0.6; cursor: not-allowed; background: rgba(0,0,0,0.05);">
              <small style="color:var(--muted); font-size:11px; margin-top:2px; display:block;">Email address cannot be changed.</small>
            </div>

            <div class="form-group">
              <label for="profilePhone">Mobile Number</label>
              <div class="phone-input-wrapper">
                <span class="phone-prefix"><span class="flag-emoji">🇮🇳</span></span>
                <input type="tel" id="profilePhone" placeholder="9876543210" required autocomplete="tel" pattern="[6-9]\\d{9}" title="Please enter a valid 10-digit mobile number.">
              </div>
            </div>

            <div class="form-group">
              <label>Gender</label>
              <div class="gender-selection">
                <label class="gender-option">
                  <input type="radio" name="profileGender" value="Male" id="profileGenderMale">
                  <span>Male</span>
                </label>
                <label class="gender-option">
                  <input type="radio" name="profileGender" value="Female" id="profileGenderFemale">
                  <span>Female</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label for="profilePassword">New Password</label>
              <input type="password" id="profilePassword" placeholder="Leave blank to keep current" autocomplete="new-password">
              <small style="color:var(--muted); font-size:11px; margin-top:2px; display:block;">Minimum 6 characters to update password.</small>
            </div>

            <div id="profileMessage" class="auth-message" hidden></div>

            <button type="submit" class="profile-btn save-btn">Save Changes</button>
          </form>
        </details>
      </div>

      <div class="profile-sidebar__footer">
        <button type="button" class="sidebar-signout-btn" id="sidebarSignOutBtn">Sign Out</button>
      </div>
    </div>`;

  document.body.appendChild(sidebar);

  sidebar.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeProfileSidebar();
  });
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !sidebar.hidden) closeProfileSidebar();
  });

  const form = sidebar.querySelector("#profileForm");
  form.addEventListener("submit", handleProfileUpdate);

  const signOutBtn = sidebar.querySelector("#sidebarSignOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try {
        await db.signOut();
        location.reload();
      } catch (err) {
        console.error("Sign out failed", err);
      }
    });
  }

  return sidebar;
}

function formatInchesToFeetInches(totalInches) {
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet} ft ${inches} in`;
}

function calculateBMI() {
  const container = document.getElementById("profileSidebar") || document.querySelector(".bmi-main");
  if (!container) return;

  const wInput = container.querySelector("#bmiWeight");
  const hInput = container.querySelector("#bmiHeight");
  if (!wInput || !hInput) return;

  const w = parseFloat(wInput.value);
  const hInches = parseFloat(hInput.value);
  const h = (hInches * 2.54) / 100; // convert inches to meters

  if (!w || !h) return;

  const bmi = w / (h * h);
  const scoreEl = container.querySelector("#bmiScore");
  const statusEl = container.querySelector("#bmiStatus");
  const indicatorEl = container.querySelector("#bmiGaugeIndicator");

  if (scoreEl) scoreEl.textContent = bmi.toFixed(1);

  let status = "Normal Weight";
  let statusClass = "normal";
  
  if (bmi < 18.5) {
    status = "Underweight";
    statusClass = "underweight";
  } else if (bmi >= 18.5 && bmi < 25) {
    status = "Normal Weight";
    statusClass = "normal";
  } else if (bmi >= 25 && bmi < 30) {
    status = "Overweight";
    statusClass = "overweight";
  } else {
    status = "Obese";
    statusClass = "obese";
  }

  if (statusEl) {
    statusEl.className = `bmi-status ${statusClass}`;
    statusEl.textContent = status;
  }

  if (indicatorEl) {
    const minBmi = 15;
    const maxBmi = 35;
    const pct = Math.min(100, Math.max(0, ((bmi - minBmi) / (maxBmi - minBmi)) * 100));
    indicatorEl.style.left = `${pct}%`;
  }

  // Calculate weight gain/loss advice
  const feedbackCard = container.querySelector("#bmiFeedbackCard");
  const feedbackText = container.querySelector("#bmiFeedbackText");

  if (feedbackCard && feedbackText) {
    const minWeight = 18.5 * (h * h);
    const maxWeight = 24.9 * (h * h);

    if (bmi < 18.5) {
      const diff = minWeight - w;
      feedbackText.innerHTML = `You need to gain <strong>${diff.toFixed(1)} kg</strong> to reach a healthy BMI of 18.5.`;
      feedbackCard.className = "bmi-feedback-card gain";
      feedbackCard.hidden = false;
    } else if (bmi >= 25) {
      const diff = w - maxWeight;
      feedbackText.innerHTML = `You need to lose <strong>${diff.toFixed(1)} kg</strong> to reach a healthy BMI of 24.9.`;
      feedbackCard.className = "bmi-feedback-card lose";
      feedbackCard.hidden = false;
    } else {
      feedbackText.innerHTML = `Great job! You are in the healthy range (Normal weight: <strong>${minWeight.toFixed(1)} - ${maxWeight.toFixed(1)} kg</strong>).`;
      feedbackCard.className = "bmi-feedback-card healthy";
      feedbackCard.hidden = false;
    }
  }
}

let bmiSaveTimeout = null;
async function saveBMIData() {
  const container = document.getElementById("profileSidebar") || document.querySelector(".bmi-main");
  if (!container || !db.isConfigured()) return;

  const wInput = container.querySelector("#bmiWeight");
  const hInput = container.querySelector("#bmiHeight");
  if (!wInput || !hInput) return;

  const w = parseInt(wInput.value, 10);
  const hInches = parseInt(hInput.value, 10);
  const hCm = Math.round(hInches * 2.54);

  clearTimeout(bmiSaveTimeout);
  bmiSaveTimeout = setTimeout(async () => {
    try {
      console.log(`Saving height (${hCm}cm) and weight (${w}kg) to Supabase...`);
      const session = db.getCurrentSession();
      if (!session) return;
      
      const name = session.user.user_metadata?.name || "";
      const phone = session.user.user_metadata?.phone || "";
      const gender = session.user.user_metadata?.gender || "";
      
      await db.updateUserProfile(name, phone, gender, hCm, w);
      
      if (session.user) {
        if (!session.user.user_metadata) session.user.user_metadata = {};
        session.user.user_metadata.height = hCm;
        session.user.user_metadata.weight = w;
      }
    } catch (e) {
      console.error("Failed to save BMI sliders to Supabase:", e);
    }
  }, 1000);
}

async function openProfileSidebar(user) {
  const sidebar = getProfileSidebar();
  
  const email = user.email || "";
  let name = user.user_metadata?.name || "";
  let phoneFull = user.user_metadata?.phone || user.phone || "";
  let gender = user.user_metadata?.gender || "";
  let height = user.user_metadata?.height || 170;
  let weight = user.user_metadata?.weight || 70;

  sidebar.querySelector("#sidebarUserName").textContent = name || "User";
  sidebar.querySelector("#sidebarUserEmail").textContent = email;
  sidebar.querySelector("#sidebarAvatar").textContent = (name || email || "U").charAt(0).toUpperCase();

  document.getElementById("profileName").value = name;
  document.getElementById("profileEmail").value = email;
  document.getElementById("profilePhone").value = phoneFull.startsWith("+91") ? phoneFull.slice(3) : phoneFull;
  document.getElementById("profilePassword").value = "";
  
  if (gender === "Male") {
    document.getElementById("profileGenderMale").checked = true;
  } else if (gender === "Female") {
    document.getElementById("profileGenderFemale").checked = true;
  } else {
    document.getElementById("profileGenderMale").checked = false;
    document.getElementById("profileGenderFemale").checked = false;
  }

  const wInput = sidebar.querySelector("#bmiWeight");
  const hInput = sidebar.querySelector("#bmiHeight");
  if (wInput && hInput) {
    wInput.value = weight;
    sidebar.querySelector("#weightVal").textContent = weight;
    hInput.value = height;
    sidebar.querySelector("#heightVal").textContent = height;
    calculateBMI();
  }
  
  const messageEl = document.getElementById("profileMessage");
  if (messageEl) messageEl.hidden = true;

  sidebar.hidden = false;
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => sidebar.classList.add("profile-sidebar--open"));

  if (typeof db !== "undefined" && db.isConfigured()) {
    try {
      const profile = await db.getProfile();
      if (profile) {
        document.getElementById("profileName").value = profile.name || "";
        const phone = profile.phone || "";
        document.getElementById("profilePhone").value = phone.startsWith("+91") ? phone.slice(3) : phone;
        
        const freshGender = profile.gender || user.user_metadata?.gender || "";
        if (freshGender === "Male") {
          document.getElementById("profileGenderMale").checked = true;
        } else if (freshGender === "Female") {
          document.getElementById("profileGenderFemale").checked = true;
        }
      }
    } catch (e) {
      console.error("Error loading fresh profile data:", e);
    }
  }
}

function closeProfileSidebar() {
  const sidebar = document.getElementById("profileSidebar");
  if (sidebar) {
    sidebar.classList.remove("profile-sidebar--open");
    setTimeout(() => {
      sidebar.hidden = true;
      document.body.classList.remove("modal-open");
    }, 250);
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const messageEl = document.getElementById("profileMessage");
  if (!messageEl) return;
  messageEl.hidden = true;

  const saveBtn = e.target.querySelector(".save-btn");
  const name = document.getElementById("profileName").value.trim();
  const rawPhone = document.getElementById("profilePhone").value.trim();
  const genderEl = e.target.querySelector("input[name='profileGender']:checked");
  const gender = genderEl ? genderEl.value : null;

  const weightVal = parseInt(document.getElementById("bmiWeight").value, 10);
  const heightVal = parseInt(document.getElementById("bmiHeight").value, 10);
  const newPassword = document.getElementById("profilePassword").value;

  if (!name) {
    messageEl.textContent = "Full Name is required.";
    messageEl.className = "auth-message alert-error";
    messageEl.hidden = false;
    return;
  }

  if (rawPhone && !/^[6-9]\d{9}$/.test(rawPhone)) {
    messageEl.textContent = "Please enter a valid 10-digit mobile number.";
    messageEl.className = "auth-message alert-error";
    messageEl.hidden = false;
    return;
  }

  if (newPassword && newPassword.length < 6) {
    messageEl.textContent = "New password must be at least 6 characters.";
    messageEl.className = "auth-message alert-error";
    messageEl.hidden = false;
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const formattedPhone = rawPhone ? "+91" + rawPhone : "";
    
    await db.updateUserProfile(name, formattedPhone, gender, heightVal, weightVal);

    if (newPassword) {
      await db.updateUserPassword(newPassword);
    }

    const session = db.getCurrentSession();
    if (session && session.user) {
      if (!session.user.user_metadata) session.user.user_metadata = {};
      session.user.user_metadata.name = name;
      session.user.user_metadata.phone = formattedPhone;
      session.user.user_metadata.gender = gender;
      session.user.user_metadata.height = heightVal;
      session.user.user_metadata.weight = weightVal;
    }

    messageEl.textContent = "Profile updated successfully!";
    messageEl.className = "auth-message alert-success";
    messageEl.hidden = false;
    document.getElementById("profilePassword").value = "";

    setTimeout(() => {
      closeProfileSidebar();
      location.reload();
    }, 1500);

  } catch (err) {
    messageEl.textContent = err.message || "Failed to update profile settings.";
    messageEl.className = "auth-message alert-error";
    messageEl.hidden = false;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }
}

function initEditModeToggle() {
  const btn = document.getElementById("editToggleBtn");
  const list = document.getElementById("exerciseList");
  const addBtn = document.getElementById("addExerciseBtn");
  if (!btn || !list) return;

  const isDietPage = new URLSearchParams(location.search).get("day") === "diet-chart";

  // Label the buttons correctly for diet vs workout pages
  if (isDietPage) {
    btn.textContent = "Edit Meals";
    if (addBtn) addBtn.textContent = "+ Add Meal";
  }

  btn.addEventListener("click", () => {
    list.classList.toggle("editing");
    const isEditing = list.classList.contains("editing");
    btn.textContent = isEditing ? "Done" : (isDietPage ? "Edit Meals" : "Edit Plan");
    btn.classList.toggle("active", isEditing);
    if (addBtn) {
      addBtn.style.display = isEditing ? "block" : "none";
    }
  });
}

function makeFieldEditable(element, onSave) {
  if (element.querySelector("input")) return;

  const originalText = element.textContent;
  element.innerHTML = "";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "inline-edit-input";
  input.value = originalText;
  element.appendChild(input);
  input.focus();
  input.select();

  const save = () => {
    const val = input.value.trim() || originalText;
    element.textContent = val;
    onSave(val);
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      save();
    } else if (e.key === "Escape") {
      element.textContent = originalText;
    }
  });

  input.addEventListener("blur", () => {
    save();
  });
}

async function saveAllExercises(workoutId, exercises, isSupabaseLoaded) {
  // Always update local cache for instant reload feedback
  localStorage.setItem(`fitflow:custom:${workoutId}`, JSON.stringify(exercises));

  // If Supabase is active, also save to DB in the background
  const isSupabase = isSupabaseLoaded || window.isSupabaseActive;
  if (isSupabase && typeof db !== "undefined" && db.isConfigured()) {
    try {
      window.lastSavedTime = Date.now();
      await db.saveUserExercises(workoutId, exercises);
    } catch (err) {
      console.error("Error saving exercises to Supabase:", err);
    }
  }
}

/// Helper to find the element immediately following the current cursor Y position
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".exercise:not(.dragging)")];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

// Read DOM children order, sync it to window.activeExercises, update indices, and save
async function updateExercisesOrderFromDOM() {
  const list = document.getElementById("exerciseList");
  if (!list) return;
  const items = [...list.querySelectorAll(".exercise")];
  const exercises = window.activeExercises;
  if (!exercises) return;

  // Reorder exercises array based on current DOM elements order
  const reordered = items
    .map((item) => {
      const originalIndex = parseInt(item.dataset.index, 10);
      return exercises[originalIndex];
    })
    .filter(Boolean);

  reordered.forEach((ex, idx) => {
    ex.sort_order = idx;
  });

  window.activeExercises = reordered;

  const workoutId = list.dataset.workoutId || new URLSearchParams(location.search).get("day") || "push-day";
  await saveAllExercises(workoutId, reordered, window.isSupabaseActive);

  // Re-render so all attributes (index, disable states) are correctly set to match the new array order
  renderExercisesList(list, workoutId, reordered, window.isSupabaseActive);
}

// HTML5 Drag and Drop Handlers for Desktop (DOM-based instant sorting)
let dragSrcEl = null;

function handleDragStart(e) {
  const list = document.getElementById("exerciseList");
  if (!list || !list.classList.contains("editing")) {
    e.preventDefault();
    return;
  }
  this.classList.add("dragging");
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", this.dataset.index);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  const list = document.getElementById("exerciseList");
  const afterElement = getDragAfterElement(list, e.clientY);
  if (afterElement == null) {
    list.appendChild(dragSrcEl);
  } else {
    list.insertBefore(dragSrcEl, afterElement);
  }
  return false;
}

function handleDragEnter(e) {
  if (this !== dragSrcEl) {
    this.classList.add("drag-over");
  }
}

function handleDragLeave(e) {
  this.classList.remove("drag-over");
}

function handleDragEnd(e) {
  this.classList.remove("dragging");
  const items = document.querySelectorAll(".exercise");
  items.forEach((item) => {
    item.classList.remove("drag-over");
  });
  updateExercisesOrderFromDOM();
}

async function handleDrop(e, workoutId) {
  e.stopPropagation();
  e.preventDefault();
  return false;
}

// Touch Drag and Drop Handlers for Mobile (DOM-based instant touch sorting)
let touchStartY = 0;
let touchActive = false;
let currentDraggedItem = null;

function handleTouchStart(e) {
  const list = document.getElementById("exerciseList");
  if (!list || !list.classList.contains("editing")) return;

  const item = this.closest(".exercise");
  if (!item) return;

  touchActive = true;
  currentDraggedItem = item;
  item.classList.add("dragging");
  touchStartY = e.touches[0].clientY;
}

function handleTouchMove(e) {
  if (!touchActive || !currentDraggedItem) return;

  const list = document.getElementById("exerciseList");
  if (!list) return;

  const touchY = e.touches[0].clientY;
  const afterElement = getDragAfterElement(list, touchY);

  if (afterElement == null) {
    list.appendChild(currentDraggedItem);
  } else {
    list.insertBefore(currentDraggedItem, afterElement);
  }

  e.preventDefault(); // Stop mobile browser scrolling while dragging
}

function handleTouchEnd(e) {
  if (!touchActive) return;
  touchActive = false;

  if (currentDraggedItem) {
    currentDraggedItem.classList.remove("dragging");
  }

  updateExercisesOrderFromDOM();
  currentDraggedItem = null;
}

function generateUUID() {
  if (typeof self.crypto !== "undefined" && typeof self.crypto.randomUUID === "function") {
    return self.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getDefaultExercisesArray(workout) {
  return workout.exercises.map((ex, index) => ({
    id: generateUUID(),
    name: ex.name,
    video: ex.video || null,
    reps: ex.reps ?? "10",
    sets: ex.sets ?? 3,
    sort_order: index,
    is_done: localStorage.getItem(`fitflow:${workout.id}:${index}`) === "done"
  }));
}

function renderExercisesList(list, workoutId, exercises, isSupabaseLoaded) {
  list.replaceChildren();
  list.dataset.workoutId = workoutId;
  const frag = document.createDocumentFragment();

  // Detect diet page — used to suppress video UI and to reliably flag meal cards
  const isDietPage = workoutId === "diet-chart";

  exercises.forEach((ex, index) => {
    const done = ex.is_done;
    // For diet page, every item is a meal card regardless of video field content
    const videoId = isDietPage ? null : getYouTubeId(ex.video);
    const sets = ex.sets !== undefined ? ex.sets : 3;
    const reps = ex.reps !== undefined ? ex.reps : "10";
    const isMeal = isDietPage || (!videoId && reps === "—");

    const item = document.createElement("article");
    item.className = "exercise" + (done ? " done" : "") + (isMeal ? " exercise--meal" : "");
    item.dataset.index = index;
    item.dataset.workoutId = workoutId;
    item.setAttribute("draggable", "true");

    // Drag listeners for desktop
    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragover", handleDragOver);
    item.addEventListener("dragenter", handleDragEnter);
    item.addEventListener("dragleave", handleDragLeave);
    item.addEventListener("dragend", handleDragEnd);
    item.addEventListener("drop", (e) => handleDrop(e, workoutId));

    // Drag handle
    const dragHandle = document.createElement("div");
    dragHandle.className = "exercise-drag-handle";
    dragHandle.innerHTML = (typeof ICON !== "undefined" && ICON.dragHandle) || 
      `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/></svg>`;
    dragHandle.setAttribute("title", "Drag to reorder");

    // Touch listeners for mobile drag (prevent propagation to stop blocking card clicks)
    dragHandle.addEventListener("touchstart", (e) => { e.stopPropagation(); handleTouchStart.call(this, e); }, { passive: false });
    dragHandle.addEventListener("touchmove", handleTouchMove, { passive: false });
    dragHandle.addEventListener("touchend", handleTouchEnd);

    // Build numbered preview text for meal card meta
    let displaySubtext = "";
    if (isMeal) {
      const mealItems = getMealItems(ex, workoutId);
      if (mealItems.length > 0) {
        // Show each item on its own line: "1. Banana 20 pc\n2. Apple 2 pc"
        displaySubtext = mealItems
          .map((it, i) => `${i + 1}. ${it.name}${(it.qty || it.cal) ? "  " + (it.qty || it.cal) : ""}`)
          .join("\n");
      } else {
        displaySubtext = "";
      }
    } else if (sets !== undefined && sets !== null && sets !== "—" && sets !== "") {
      displaySubtext = `${reps} reps | ${sets} sets`;
    } else {
      displaySubtext = reps;
    }

    const meta = document.createElement("div");
    meta.className = "exercise-meta" + (isMeal && getMealItems(ex, workoutId).length > 0 ? " exercise-meta--meal-preview" : "");
    meta.textContent = displaySubtext;

    const info = document.createElement("div");
    info.className = "exercise-info";
    const name = document.createElement("div");
    name.className = "exercise-name";
    name.textContent = ex.name;
    info.append(name, meta);

    const check = document.createElement("button");
    check.type = "button";
    check.className = "check";
    check.innerHTML = ICON.check;
    check.setAttribute("aria-label", `Mark ${ex.name} complete`);
    check.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (list.classList.contains("editing")) return;
      item.classList.toggle("done");
      const isDone = item.classList.contains("done");
      ex.is_done = isDone;
      localStorage.setItem(`fitflow:${workoutId}:${index}`, isDone ? "done" : "");
      await saveAllExercises(workoutId, exercises, isSupabaseLoaded);
    });

    // Delete button (visible only in Edit Mode)
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    deleteBtn.setAttribute("aria-label", `Delete ${ex.name}`);
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Are you sure you want to delete "${ex.name}"?`)) return;
      exercises.splice(index, 1);
      exercises.forEach((item, idx) => { item.sort_order = idx; });
      if (isSupabaseLoaded && ex.id) {
        await db.deleteUserExercise(ex.id);
      }
      await saveAllExercises(workoutId, exercises, isSupabaseLoaded);
      renderExercisesList(list, workoutId, exercises, isSupabaseLoaded);
    });

    // Edit button (visible only in Edit Mode)
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "edit-btn";
    editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    editBtn.setAttribute("aria-label", `Edit ${ex.name}`);
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isMeal) {
        openDietMealPopup(ex, workoutId, exercises, isSupabaseLoaded, list, () => {
          renderExercisesList(list, workoutId, exercises, isSupabaseLoaded);
        }, true);
      } else {
        openCardEditPopup(ex, isMeal, async () => {
          await saveAllExercises(workoutId, exercises, isSupabaseLoaded);
          renderExercisesList(list, workoutId, exercises, isSupabaseLoaded);
        });
      }
    });

    // ── Meal card ──────────────────────────────────────────────────────────
    if (isMeal) {
      item.addEventListener("click", (e) => {
        if (list.classList.contains("editing")) return;
        if (e.target.closest(".delete-btn") || e.target.closest(".exercise-drag-handle") || e.target.closest(".check")) return;
        openDietMealPopup(ex, workoutId, exercises, isSupabaseLoaded, list, () => {
          renderExercisesList(list, workoutId, exercises, isSupabaseLoaded);
        }, false);
      });

      item.append(dragHandle, info, check, editBtn, deleteBtn);

    // ── Exercise with video ────────────────────────────────────────────────
    } else if (videoId) {
      const thumbBtn = document.createElement("button");
      thumbBtn.type = "button";
      thumbBtn.className = "video-thumb";
      thumbBtn.setAttribute("aria-label", `Play video for ${ex.name}`);

      const img = document.createElement("img");
      img.src = youtubeThumb(videoId);
      img.alt = "";
      img.width = 180;
      img.height = 101;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => {
        img.remove();
        thumbBtn.classList.add("video-thumb--fallback");
      });

      const play = document.createElement("span");
      play.className = "play-btn";
      play.innerHTML = ICON.play;
      play.setAttribute("aria-hidden", "true");

      thumbBtn.append(img, play);
      thumbBtn.addEventListener("click", () => {
        if (list.classList.contains("editing")) {
          openCardEditPopup(ex, isMeal, async () => {
            await saveAllExercises(workoutId, exercises, isSupabaseLoaded);
            renderExercisesList(list, workoutId, exercises, isSupabaseLoaded);
          });
          return;
        }
        openVideoModal(videoId, ex.name);
      });
      item.append(dragHandle, thumbBtn, info, check, editBtn, deleteBtn);

    // ── Exercise without video (no-video placeholder) ──────────────────────
    } else {
      const placeholder = document.createElement("button");
      placeholder.type = "button";
      placeholder.className = "exercise-thumb exercise-thumb--plain";
      placeholder.setAttribute("aria-label", "Add video");
      placeholder.addEventListener("click", () => {
        if (!list.classList.contains("editing")) return;
        openCardEditPopup(ex, isMeal, async () => {
          await saveAllExercises(workoutId, exercises, isSupabaseLoaded);
          renderExercisesList(list, workoutId, exercises, isSupabaseLoaded);
        });
      });
      item.append(dragHandle, placeholder, info, check, editBtn, deleteBtn);
    }

    frag.appendChild(item);
  });

  list.appendChild(frag);
}

// ── Diet Meal Popup ─────────────────────────────────────────────────────────


function getMealItems(ex, workoutId) {
  // PRIORITY 1: ex.video is the Supabase authoritative source — always prefer it
  // so cross-device realtime sync always wins over the local device cache.
  if (ex.video && ex.video.startsWith("[")) {
    try {
      const fromDb = JSON.parse(ex.video);
      // Keep the device-local cache in sync with Supabase truth
      localStorage.setItem(`fitflow:meal:${workoutId}:${ex.id || ex.name}`, ex.video);
      return fromDb;
    } catch {}
  }
  // PRIORITY 2: device-local cache (offline / guest fallback)
  try {
    const stored = localStorage.getItem(`fitflow:meal:${workoutId}:${ex.id || ex.name}`);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveMealItems(ex, workoutId, items, exercises, isSupabaseLoaded) {
  const json = JSON.stringify(items);
  // Encode in video field — this is the Supabase sync vehicle
  ex.video = json;
  // Mirror to local cache immediately for instant UI
  localStorage.setItem(`fitflow:meal:${workoutId}:${ex.id || ex.name}`, json);
  saveAllExercises(workoutId, exercises, isSupabaseLoaded);
}

function openCardEditPopup(ex, isMeal, onSave) {
  const existing = document.getElementById("cardEditPopup");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "diet-popup-overlay";
  overlay.id = "cardEditPopup";

  const panel = document.createElement("div");
  panel.className = "diet-popup-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", `Edit ${isMeal ? 'Meal' : 'Exercise'}`);

  panel.innerHTML = `
    <div class="diet-popup-header">
      <div>
        <h2 class="diet-popup-title">Edit ${isMeal ? 'Meal' : 'Exercise'}</h2>
        <p class="diet-popup-subtitle">Modify the card details</p>
      </div>
      <button type="button" class="diet-popup-close" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <form class="diet-popup-form" id="cardEditForm" style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label for="editExName" style="font-size: 13px; font-weight: 600; color: var(--text);">Card Name</label>
        <input type="text" id="editExName" class="diet-input" value="${escapeHtml(ex.name)}" placeholder="e.g. Bench Press" required autocomplete="off" style="width: 100%; flex: none;">
      </div>
      
      ${!isMeal ? `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label for="editExReps" style="font-size: 13px; font-weight: 600; color: var(--text);">Target (e.g. 10 reps | 3 sets)</label>
        <input type="text" id="editExReps" class="diet-input" value="${escapeHtml(ex.sets !== undefined && ex.sets !== null && ex.sets !== '—' && ex.sets !== '' ? `${ex.reps} reps | ${ex.sets} sets` : (ex.reps || ''))}" placeholder="e.g. 10 reps | 3 sets" autocomplete="off" style="width: 100%; flex: none;">
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label for="editExVideo" style="font-size: 13px; font-weight: 600; color: var(--text);">YouTube Video Link / ID</label>
        <input type="text" id="editExVideo" class="diet-input" value="${escapeHtml(ex.video || '')}" placeholder="e.g. https://youtube.com/watch?v=..." autocomplete="off" style="width: 100%; flex: none;">
      </div>
      ` : ''}
      
      <button type="submit" class="profile-btn save-btn" style="margin-top: 10px; width: 100%; border: 0; display: block;">Save Changes</button>
    </form>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    const inp = panel.querySelector("#editExName");
    if (inp) inp.focus();
  });

  const close = () => {
    overlay.classList.add("diet-popup-overlay--closing");
    setTimeout(() => overlay.remove(), 200);
    document.body.classList.remove("modal-open");
  };

  panel.querySelector(".diet-popup-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", escHandler); }
  });

  panel.querySelector("#cardEditForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const newName = panel.querySelector("#editExName").value.trim();
    if (!newName) return;

    ex.name = newName;
    if (!isMeal) {
      const newReps = panel.querySelector("#editExReps").value.trim();
      const newVideo = panel.querySelector("#editExVideo").value.trim();

      ex.reps = newReps || "—";
      ex.sets = null;
      ex.video = newVideo;
    }

    onSave();
    close();
  });

  document.body.classList.add("modal-open");
  requestAnimationFrame(() => overlay.classList.add("diet-popup-overlay--open"));
}

function openDietMealPopup(ex, workoutId, exercises, isSupabaseLoaded, list, onClose, isEditable = false) {
  // Remove existing popup
  const existing = document.getElementById("dietMealPopup");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "dietMealPopup";
  overlay.className = "diet-popup-overlay";

  const panel = document.createElement("div");
  panel.className = "diet-popup-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", `${ex.name} food items`);

  function renderItems() {
    const currentItems = getMealItems(ex, workoutId);
    const listEl = panel.querySelector(".diet-popup-items");
    if (!listEl) return;
    listEl.innerHTML = "";
    if (currentItems.length === 0) {
      listEl.innerHTML = `<p class="diet-popup-empty">No items yet. ${isEditable ? 'Add your first food item below!' : ''}</p>`;
    } else {
      currentItems.forEach((itm, i) => {
        const qty = itm.qty || itm.cal || ""; // backward compat with old 'cal' field
        const chip = document.createElement("div");
        chip.className = "diet-food-chip";
        chip.innerHTML = `
          <span class="diet-food-num">${i + 1}.</span>
          <span class="diet-food-name">${escapeHtml(itm.name)}</span>
          ${qty ? `<span class="diet-food-qty">${escapeHtml(qty)}</span>` : ""}
          ${isEditable 
            ? `<button type="button" class="diet-food-del" aria-label="Remove ${escapeHtml(itm.name)}" data-index="${i}">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
               </button>`
            : ''
          }`;
        
        if (isEditable) {
          chip.querySelector(".diet-food-del").addEventListener("click", () => {
            const updated = getMealItems(ex, workoutId);
            updated.splice(i, 1);
            saveMealItems(ex, workoutId, updated, exercises, isSupabaseLoaded);
            renderItems();
            onClose();
          });
        }
        listEl.appendChild(chip);
      });
    }
  }

  panel.innerHTML = `
    <div class="diet-popup-header" style="align-items: flex-start; gap: 12px;">
      <div style="flex: 1;">
        ${isEditable 
          ? `<div style="display: flex; flex-direction: column; gap: 4px;">
               <label for="dietMealTitleInput" style="font-size: 10px; font-weight: 700; color: var(--purple); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; display: block;">Meal Name</label>
               <input type="text" id="dietMealTitleInput" class="diet-input" value="${escapeHtml(ex.name)}" placeholder="Meal Name" style="font-size: 16px; font-weight: 700; width: 100%; border: 1.5px solid var(--border); border-radius: 8px; padding: 6px 10px; box-sizing: border-box; background: #fff; color: var(--text);">
             </div>`
          : `<h2 class="diet-popup-title">${escapeHtml(ex.name)}</h2>
             <p class="diet-popup-subtitle">Track your food items</p>`
        }
      </div>
      <button type="button" class="diet-popup-close" aria-label="Close" style="margin-top: ${isEditable ? '16px' : '0'};">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="diet-popup-items"></div>
    ${isEditable 
      ? `<form class="diet-popup-form" id="dietAddForm">
           <div class="diet-popup-inputs">
             <input type="text" id="dietItemName" class="diet-input" placeholder="Food item (e.g. Oats, Roti)" required autocomplete="off">
             <input type="text" id="dietItemQty" class="diet-input diet-input--small" placeholder="qty (e.g. 200 gm)" autocomplete="off">
           </div>
           <button type="submit" class="diet-add-btn">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
             Add Item
           </button>
         </form>`
      : ''
    }`;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Render existing items
  renderItems();

  const saveTitle = () => {
    if (isEditable) {
      const titleInput = panel.querySelector("#dietMealTitleInput");
      if (titleInput) {
        const newTitle = titleInput.value.trim();
        if (newTitle && newTitle !== ex.name) {
          ex.name = newTitle;
          saveAllExercises(workoutId, exercises, isSupabaseLoaded);
        }
      }
    }
  };

  // Focus input if editing
  if (isEditable) {
    requestAnimationFrame(() => {
      const inp = panel.querySelector("#dietItemName");
      if (inp) inp.focus();
    });

    const titleInput = panel.querySelector("#dietMealTitleInput");
    if (titleInput) {
      titleInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveTitle();
          titleInput.blur();
        }
      });
    }
  }

  // Close handlers
  const close = () => {
    saveTitle();
    overlay.classList.add("diet-popup-overlay--closing");
    setTimeout(() => overlay.remove(), 200);
    document.body.classList.remove("modal-open");
    onClose();
  };

  panel.querySelector(".diet-popup-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", escHandler); }
  });

  // Add item form
  if (isEditable) {
    panel.querySelector("#dietAddForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const nameVal = panel.querySelector("#dietItemName").value.trim();
      const qtyVal = panel.querySelector("#dietItemQty").value.trim();
      if (!nameVal) return;
      const updated = getMealItems(ex, workoutId);
      updated.push({ name: nameVal, qty: qtyVal || "" });
      saveMealItems(ex, workoutId, updated, exercises, isSupabaseLoaded);
      panel.querySelector("#dietItemName").value = "";
      panel.querySelector("#dietItemQty").value = "";
      panel.querySelector("#dietItemName").focus();
      renderItems();
      onClose();
    });
  }

  document.body.classList.add("modal-open");
  requestAnimationFrame(() => overlay.classList.add("diet-popup-overlay--open"));
}

function renderWorkoutPage() {
  const list = document.getElementById("exerciseList");
  const titleEl = document.getElementById("title");
  if (!list || typeof WORKOUTS === "undefined") return;

  const params = new URLSearchParams(location.search);
  const day = params.get("day") || "push-day";
  const workout = WORKOUTS.find((w) => w.id === day) || WORKOUTS.find((w) => w.id === "push-day") || WORKOUTS[0];

  document.title = `FitFlow ${workout.title}`;
  titleEl.textContent = workout.title;

  // Render local storage or defaults instantly (synchronously)
  let exercises = [];
  const localKey = `fitflow:custom:${workout.id}`;
  const localData = localStorage.getItem(localKey);
  if (localData) {
    try {
      exercises = JSON.parse(localData);
    } catch {
      exercises = getDefaultExercisesArray(workout);
    }
  } else {
    exercises = getDefaultExercisesArray(workout);
  }

  window.activeExercises = exercises;
  window.isSupabaseActive = false;

  renderExercisesList(list, workout.id, exercises, false);
}

async function loadSupabaseExercises(session) {
  const list = document.getElementById("exerciseList");
  if (!list || typeof WORKOUTS === "undefined") return;

  const params = new URLSearchParams(location.search);
  const day = params.get("day") || "push-day";
  const workout = WORKOUTS.find((w) => w.id === day) || WORKOUTS.find((w) => w.id === "push-day") || WORKOUTS[0];

  try {
    const dbExercises = await db.getUserExercises(workout.id);
    let exercises = [];
    
    if (dbExercises !== null) {
      const isInitialized = session.user.user_metadata?.is_initialized;
      if (dbExercises.length > 0) {
        exercises = dbExercises;
      } else if (!isInitialized) {
        // Not initialized yet: database is successfully queried but empty -> initialize database
        const defaultExercises = getDefaultExercisesArray(workout);
        await db.saveUserExercises(workout.id, defaultExercises);
        const reFetched = await db.getUserExercises(workout.id);
        exercises = (reFetched && reFetched.length > 0) ? reFetched : defaultExercises;
      } else {
        // Initialized but empty: user deliberately deleted all exercises
        exercises = [];
      }
      localStorage.setItem(`fitflow:custom:${workout.id}`, JSON.stringify(exercises));
      window.activeExercises = exercises;
      window.isSupabaseActive = true;
      renderExercisesList(list, workout.id, exercises, true);
    } else {
      // dbExercises is null, indicating query failed (e.g. table not found or offline)
      // Keep using the local storage exercises that were rendered synchronously.
      window.isSupabaseActive = false;
      console.warn("Supabase query failed. Running in Local Mode fallback to protect custom edits.");
    }
  } catch (err) {
    console.error("Error loading exercises from Supabase:", err);
  }
}

async function initializeAllUserWorkouts(user) {
  console.log("Checking and initializing user default plans...");
  for (const workout of WORKOUTS) {
    try {
      const dbExercises = await db.getUserExercises(workout.id);
      if (dbExercises === null || dbExercises.length === 0) {
        console.log(`Initializing default exercises for workout: ${workout.id}`);
        const defaultExercises = getDefaultExercisesArray(workout);
        await db.saveUserExercises(workout.id, defaultExercises);
      }
    } catch (e) {
      console.error(`Failed to initialize workout ${workout.id}:`, e);
    }
  }
  
  // Set is_initialized = true in metadata
  try {
    await db.updateUserMetadata({ is_initialized: true });
    // Also sync local session
    const session = db.getCurrentSession();
    if (session && session.user) {
      if (!session.user.user_metadata) session.user.user_metadata = {};
      session.user.user_metadata.is_initialized = true;
    }
    console.log("All workouts successfully initialized.");
  } catch (e) {
    console.error("Failed to update user_metadata:", e);
  }
}

function initAddExerciseBtn() {
  const btn = document.getElementById("addExerciseBtn");
  const list = document.getElementById("exerciseList");
  if (!btn || !list) return;

  btn.addEventListener("click", async () => {
    const workoutId = list.dataset.workoutId || new URLSearchParams(location.search).get("day") || "push-day";
    const exercises = window.activeExercises || [];
    const isSupabase = window.isSupabaseActive;
    const isDietPage = workoutId === "diet-chart";

    let mealName = "New Meal";
    if (isDietPage) {
      const inputName = prompt("Enter meal name (e.g. Breakfast, Dinner):");
      if (inputName === null) return; // user cancelled
      const trimmed = inputName.trim();
      if (!trimmed) {
        alert("Meal name cannot be empty.");
        return;
      }
      mealName = trimmed;
    }

    const newEx = isDietPage
      ? {
          id: generateUUID(),
          name: mealName,
          video: "",
          reps: "—",
          sets: "—",
          sort_order: exercises.length,
          is_done: false
        }
      : {
          id: generateUUID(),
          name: "New Exercise",
          video: "",
          reps: "10",
          sets: 3,
          sort_order: exercises.length,
          is_done: false
        };

    exercises.push(newEx);
    window.activeExercises = exercises;

    await saveAllExercises(workoutId, exercises, isSupabase);

    if (isSupabase) {
      try {
        const refreshed = await db.getUserExercises(workoutId);
        if (refreshed && refreshed.length > 0) {
          window.activeExercises = refreshed;
        }
      } catch (err) {
        console.error("Failed to refresh exercises:", err);
      }
    }

    renderExercisesList(list, workoutId, window.activeExercises, isSupabase);
  });
}

// Initializations on load
document.addEventListener("DOMContentLoaded", () => {
  initUserProfile();

  const isHomePage = !!document.getElementById("workoutGrid");
  const list = document.getElementById("exerciseList");
  const isBmiPage = window.location.pathname.endsWith("/bmi.html") || window.location.pathname.endsWith("/bmi");

  if (isHomePage) {
    // Render homepage grid as guest synchronously (0ms delay)
    renderHomeGrid(null);
  }

  if (list) {
    // Render local/default exercises synchronously (0ms delay)
    renderWorkoutPage();
    initEditModeToggle();
    initAddExerciseBtn();

    // Register desktop container dragover sorting listener once
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = list.querySelector(".dragging");
      if (!dragging) return;
      const afterElement = getDragAfterElement(list, e.clientY);
      if (afterElement == null) {
        list.appendChild(dragging);
      } else {
        list.insertBefore(dragging, afterElement);
      }
    });
  }

  if (isBmiPage) {
    const weightInput = document.getElementById("bmiWeight");
    const heightInput = document.getElementById("bmiHeight");
    if (weightInput && heightInput) {
      weightInput.addEventListener("input", (e) => {
        document.getElementById("weightVal").textContent = e.target.value;
        calculateBMI();
      });
      heightInput.addEventListener("input", (e) => {
        document.getElementById("heightVal").textContent = formatInchesToFeetInches(e.target.value);
        calculateBMI();
      });
      weightInput.addEventListener("change", saveBMIData);
      heightInput.addEventListener("change", saveBMIData);

      // Compute initial BMI immediately on load (offline/local mode)
      calculateBMI();
    }
  }

  // Async authentication and database sync in the background
  if (typeof db !== "undefined" && db.isConfigured()) {
    db.getSession()
      .then(async (session) => {
        if (session) {
          // Initialize all workouts if not done yet
          if (!session.user.user_metadata?.is_initialized) {
            await initializeAllUserWorkouts(session.user);
          }

          if (isHomePage) {
            // Update links to point to workouts for authenticated user
            renderHomeGrid(session);
          }

          if (isBmiPage) {
            const heightCm = session.user.user_metadata?.height || 170;
            const weight = session.user.user_metadata?.weight || 70;
            const heightInches = Math.round(heightCm / 2.54);

            const wInput = document.getElementById("bmiWeight");
            const hInput = document.getElementById("bmiHeight");
            if (wInput && hInput) {
              wInput.value = weight;
              document.getElementById("weightVal").textContent = weight;
              hInput.value = heightInches;
              document.getElementById("heightVal").textContent = formatInchesToFeetInches(heightInches);
              calculateBMI();
            }
          }

          if (list) {
            // Asynchronously fetch latest custom exercises from Supabase
            await loadSupabaseExercises(session);

            // Subscribe to realtime updates for this workout
            const params = new URLSearchParams(location.search);
            const day = params.get("day") || "push-day";
            const workout = WORKOUTS.find((w) => w.id === day) || WORKOUTS.find((w) => w.id === "push-day") || WORKOUTS[0];
            const workoutId = workout.id;

            if (window.realtimeUnsubscribe) {
              window.realtimeUnsubscribe();
            }

            window.realtimeUnsubscribe = db.subscribeToUserExercises(workoutId, async (payload) => {
              // Ensure we do not disrupt active user editing or dragging
              const isEditing = !!list.querySelector(".inline-edit-input");
              const isDragging = !!list.querySelector(".dragging");
              
              if (Date.now() - (window.lastSavedTime || 0) < 2000) {
                console.log("Realtime sync: ignored self-update.");
                return;
              }

              if (!isEditing && !isDragging) {
                console.log("Realtime sync: exercises updated on Supabase, refreshing UI...", payload);
                await loadSupabaseExercises(session);
              } else {
                console.log("Realtime sync: update ignored to protect active user editing/dragging.");
              }
            });
          }
        } else {
          // If guest tries to access workout details or BMI directly, redirect to login
          if (list || isBmiPage) {
            location.href = "auth.html";
          }
        }
      })
      .catch((err) => {
        console.error("Auth check failed:", err);
        // Do not force redirect to auth.html immediately if there was a transient network error,
        // unless they are on detail page and have no local cache at all.
        const currentDay = new URLSearchParams(location.search).get("day") || "push-day";
        if (isBmiPage) {
          location.href = "auth.html";
        } else if (list && !localStorage.getItem(`fitflow:custom:${currentDay}`)) {
          location.href = "auth.html";
        }
      });
  }
});
