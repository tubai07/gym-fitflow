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
          <div class="profile-dropdown" id="profileDropdownMenu">
            <button type="button" class="profile-dropdown-item" id="profileDetailsBtn">Profile Settings</button>
            <button type="button" class="profile-dropdown-item" id="signOutBtn">Sign Out</button>
          </div>
        </div>
      `;

      // Toggle dropdown menu
      const trigger = document.getElementById("profileTriggerBtn");
      const dropdown = document.getElementById("profileDropdownMenu");
      if (trigger && dropdown) {
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          dropdown.classList.toggle("open");
        });
      }

      // Profile settings click
      const profileDetailsBtn = document.getElementById("profileDetailsBtn");
      if (profileDetailsBtn) {
        profileDetailsBtn.addEventListener("click", () => {
          dropdown.classList.remove("open");
          openProfileModal(session.user);
        });
      }

      // Sign out
      const signOutBtn = document.getElementById("signOutBtn");
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
    } else {
      container.innerHTML = `
        <a href="auth.html" class="btn-signin">Sign In</a>
      `;
    }
    
    // Always show edit button if present
    const editToggleBtn = document.getElementById("editToggleBtn");
    if (editToggleBtn) editToggleBtn.style.display = "block";
  });

  // Close dropdown on click outside
  document.addEventListener("click", () => {
    const dropdown = document.getElementById("profileDropdownMenu");
    if (dropdown) dropdown.classList.remove("open");
  });
}

function getProfileModal() {
  let modal = document.getElementById("profileModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "profileModal";
  modal.className = "profile-modal video-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="video-modal__backdrop" data-close></div>
    <div class="video-modal__panel profile-modal-panel" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle">
      <button type="button" class="video-modal__close" data-close aria-label="Close settings"></button>
      <h2 id="profileModalTitle" class="profile-modal__title">Profile Settings</h2>
      <form id="profileForm" class="profile-form">
        <div class="form-group">
          <label for="profileName">Full Name</label>
          <input type="text" id="profileName" placeholder="Your Name" required autocomplete="name">
        </div>
        
        <div class="form-group">
          <label for="profileEmail">Email Address</label>
          <input type="email" id="profileEmail" placeholder="you@example.com" readonly style="opacity: 0.6; cursor: not-allowed; background: rgba(0,0,0,0.05);">
          <small style="color:var(--muted); font-size:12px; margin-top:4px; display:block;">Email address cannot be changed.</small>
        </div>

        <div class="form-group">
          <label for="profilePhone">Mobile Number</label>
          <div class="phone-input-wrapper">
            <span class="phone-prefix"><span class="flag-emoji">🇮🇳</span></span>
            <input type="tel" id="profilePhone" placeholder="9876543210" required autocomplete="tel" pattern="[6-9]\\d{9}" title="Please enter a valid 10-digit mobile number.">
          </div>
        </div>

        <div class="form-group">
          <label for="profilePassword">New Password</label>
          <input type="password" id="profilePassword" placeholder="Leave blank to keep current password" autocomplete="new-password">
          <small style="color:var(--muted); font-size:12px; margin-top:4px; display:block;">Enter minimum 6 characters to update your password.</small>
        </div>

        <div id="profileMessage" class="auth-message" hidden></div>

        <div class="profile-actions">
          <button type="submit" class="profile-btn save-btn">Save Changes</button>
          <button type="button" class="profile-btn cancel-btn" data-close>Cancel</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeProfileModal();
  });
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeProfileModal();
  });

  const form = document.getElementById("profileForm");
  form.addEventListener("submit", handleProfileUpdate);

  return modal;
}

async function openProfileModal(user) {
  const modal = getProfileModal();
  
  const email = user.email || "";
  let name = user.user_metadata?.name || "";
  let phoneFull = user.user_metadata?.phone || user.phone || "";

  document.getElementById("profileName").value = name;
  document.getElementById("profileEmail").value = email;
  document.getElementById("profilePhone").value = phoneFull.startsWith("+91") ? phoneFull.slice(3) : phoneFull;
  document.getElementById("profilePassword").value = "";
  
  const messageEl = document.getElementById("profileMessage");
  if (messageEl) messageEl.hidden = true;

  modal.hidden = false;
  document.body.classList.add("modal-open");

  // Fetch fresher data from profiles table if configured
  if (typeof db !== "undefined" && db.isConfigured()) {
    try {
      const profile = await db.getProfile();
      if (profile) {
        document.getElementById("profileName").value = profile.name || "";
        const phone = profile.phone || "";
        document.getElementById("profilePhone").value = phone.startsWith("+91") ? phone.slice(3) : phone;
      }
    } catch (e) {
      console.error("Error loading fresh profile data:", e);
    }
  }
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal) {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
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
  const newPassword = document.getElementById("profilePassword").value;

  if (!name) {
    messageEl.textContent = "Full Name is required.";
    messageEl.className = "auth-message alert-error";
    messageEl.hidden = false;
    return;
  }

  if (!/^[6-9]\d{9}$/.test(rawPhone)) {
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
    const formattedPhone = "+91" + rawPhone;
    
    // 1. Update Profile Info
    await db.updateUserProfile(name, formattedPhone);

    // 2. Update Password if specified
    if (newPassword) {
      await db.updateUserPassword(newPassword);
    }

    messageEl.textContent = "Profile updated successfully!";
    messageEl.className = "auth-message alert-success";
    messageEl.hidden = false;
    document.getElementById("profilePassword").value = "";

    setTimeout(() => {
      closeProfileModal();
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

  btn.addEventListener("click", () => {
    list.classList.toggle("editing");
    const isEditing = list.classList.contains("editing");
    btn.textContent = isEditing ? "Done" : "Edit Plan";
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

  exercises.forEach((ex, index) => {
    const done = ex.is_done;
    const videoId = getYouTubeId(ex.video);
    const sets = ex.sets !== undefined ? ex.sets : 3;
    const reps = ex.reps !== undefined ? ex.reps : "10";
    const isMeal = !videoId && reps === "—";

    const item = document.createElement("article");
    item.className = "exercise" + (done ? " done" : "");
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

    // Touch listeners for mobile
    dragHandle.addEventListener("touchstart", handleTouchStart, { passive: false });
    dragHandle.addEventListener("touchmove", handleTouchMove, { passive: false });
    dragHandle.addEventListener("touchend", handleTouchEnd);

    let displaySubtext = "";
    if (isMeal) {
      displaySubtext = "Meal";
    } else if (sets !== undefined && sets !== null && sets !== "—" && sets !== "") {
      displaySubtext = `${reps} reps | ${sets} sets`;
    } else {
      displaySubtext = reps;
    }

    const meta = document.createElement("div");
    meta.className = "exercise-meta";
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
    check.addEventListener("click", async () => {
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

      // Remove from array
      exercises.splice(index, 1);

      // Re-index sort order
      exercises.forEach((item, idx) => {
        item.sort_order = idx;
      });

      // Delete from Supabase database if online
      if (isSupabaseLoaded && ex.id) {
        await db.deleteUserExercise(ex.id);
      }

      await saveAllExercises(workoutId, exercises, isSupabaseLoaded);
      renderExercisesList(list, workoutId, exercises, isSupabaseLoaded);
    });

    // Inline edit hooks
    name.addEventListener("click", (e) => {
      if (!list.classList.contains("editing")) return;
      e.stopPropagation();
      makeFieldEditable(name, (newValue) => {
        ex.name = newValue;
        saveAllExercises(workoutId, exercises, isSupabaseLoaded);
      });
    });

    meta.addEventListener("click", (e) => {
      if (!list.classList.contains("editing")) return;
      e.stopPropagation();
      makeFieldEditable(meta, (newValue) => {
        const repsMatch = newValue.match(/(\d+)\s*reps/i);
        const setsMatch = newValue.match(/(\d+)\s*sets/i);

        if (repsMatch && setsMatch) {
          ex.reps = repsMatch[1];
          ex.sets = parseInt(setsMatch[1], 10);
          meta.textContent = `${ex.reps} reps | ${ex.sets} sets`;
        } else {
          ex.reps = newValue;
          ex.sets = null;
          meta.textContent = newValue;
        }

        saveAllExercises(workoutId, exercises, isSupabaseLoaded);
      });
    });

    if (videoId) {
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
          const newUrl = prompt(`Enter YouTube Video URL (or 11-char video ID) for ${ex.name}:`, ex.video || "");
          if (newUrl !== null) {
            ex.video = newUrl.trim();
            saveAllExercises(workoutId, exercises, isSupabaseLoaded);
            renderExercisesList(list, workoutId, exercises, isSupabaseLoaded);
          }
          return;
        }
        openVideoModal(videoId, ex.name);
      });
      item.append(dragHandle, thumbBtn, info, check, deleteBtn);
    } else {
      const placeholder = document.createElement("button");
      placeholder.type = "button";
      placeholder.className = "exercise-thumb exercise-thumb--plain";
      placeholder.setAttribute("aria-label", "Add video");
      placeholder.addEventListener("click", () => {
        if (!list.classList.contains("editing")) return;
        const newUrl = prompt(`Enter YouTube Video URL (or 11-char video ID) for ${ex.name}:`, "");
        if (newUrl !== null && newUrl.trim() !== "") {
          ex.video = newUrl.trim();
          saveAllExercises(workoutId, exercises, isSupabaseLoaded);
          renderExercisesList(list, workoutId, exercises, isSupabaseLoaded);
        }
      });
      item.append(dragHandle, placeholder, info, check, deleteBtn);
    }

    frag.appendChild(item);
  });

  list.appendChild(frag);
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
    
    if (dbExercises && dbExercises.length > 0) {
      exercises = dbExercises;
      // Synchronize the local storage with fresh DB values
      localStorage.setItem(`fitflow:custom:${workout.id}`, JSON.stringify(exercises));
      window.activeExercises = exercises;
      window.isSupabaseActive = true;
      renderExercisesList(list, workout.id, exercises, true);
    } else if (dbExercises !== null) {
      // Database query was successful but empty -> initialize database
      const defaultExercises = getDefaultExercisesArray(workout);
      await db.saveUserExercises(workout.id, defaultExercises);
      const reFetched = await db.getUserExercises(workout.id);
      if (reFetched && reFetched.length > 0) {
        exercises = reFetched;
      } else {
        exercises = defaultExercises;
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

function initAddExerciseBtn() {
  const btn = document.getElementById("addExerciseBtn");
  const list = document.getElementById("exerciseList");
  if (!btn || !list) return;

  btn.addEventListener("click", async () => {
    const workoutId = list.dataset.workoutId || new URLSearchParams(location.search).get("day") || "push-day";
    const exercises = window.activeExercises || [];
    const isSupabase = window.isSupabaseActive;

    const newEx = {
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

  // Async authentication and database sync in the background
  if (typeof db !== "undefined" && db.isConfigured()) {
    db.getSession()
      .then(async (session) => {
        if (session) {
          if (isHomePage) {
            // Update links to point to workouts for authenticated user
            renderHomeGrid(session);
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
              
              if (!isEditing && !isDragging) {
                console.log("Realtime sync: exercises updated on Supabase, refreshing UI...", payload);
                await loadSupabaseExercises(session);
              } else {
                console.log("Realtime sync: update ignored to protect active user editing/dragging.");
              }
            });
          }
        } else {
          // If guest tries to access workout details directly, redirect to login
          if (list) {
            location.href = "auth.html";
          }
        }
      })
      .catch((err) => {
        console.error("Auth check failed:", err);
        if (list) {
          location.href = "auth.html";
        }
      });
  }
});
