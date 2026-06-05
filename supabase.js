// Initialize Supabase Client
let supabaseClient = null;
let currentSession = null;

if (
  window.supabase &&
  window.ENV &&
  window.ENV.SUPABASE_URL &&
  window.ENV.SUPABASE_URL.startsWith("https://") &&
  window.ENV.SUPABASE_ANON_KEY &&
  window.ENV.SUPABASE_ANON_KEY !== "your-anon-key-here"
) {
  supabaseClient = window.supabase.createClient(
    window.ENV.SUPABASE_URL,
    window.ENV.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "fitflow-auth-token"
      }
    }
  );

  // Prefetch and cache session
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    currentSession = session;
  }).catch(err => console.error("Error fetching session:", err));

  // Sync session on auth state change
  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentSession = session;
  });
} else {
  console.warn(
    "Supabase is not configured yet. Running in Local Mode. Please edit config.js with your project credentials."
  );
}

// Global DB helper object
window.db = {
  isConfigured() {
    return supabaseClient !== null;
  },

  async signUp(email, password, phone, name, gender) {
    if (!this.isConfigured()) throw new Error("Supabase is not configured.");
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, gender }
      }
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    if (!this.isConfigured()) throw new Error("Supabase is not configured.");
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    currentSession = data.session;
    return data;
  },

  async signOut() {
    if (!this.isConfigured()) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    currentSession = null;
  },

  getCurrentSession() {
    return currentSession;
  },

  async getSession() {
    if (!this.isConfigured()) return null;
    if (currentSession) return currentSession;
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) return null;
    currentSession = session;
    return session;
  },

  onAuthStateChange(callback) {
    if (!this.isConfigured()) return () => {};
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        currentSession = session;
        callback(event, session);
      }
    );
    return () => subscription.unsubscribe();
  },

  async getUserExercises(workoutId) {
    if (!this.isConfigured()) return null;
    const session = await this.getSession();
    if (!session) return null;

    const { data, error } = await supabaseClient
      .from("user_exercises")
      .select("*")
      .eq("workout_id", workoutId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching user exercises:", error);
      return null;
    }
    return data;
  },

  async saveUserExercises(workoutId, exercises) {
    if (!this.isConfigured()) return false;
    const session = await this.getSession();
    if (!session) return false;

    // Use upsert to update existing rows or insert new ones
    const rows = exercises.map((ex, index) => {
      const row = {
        user_id: session.user.id,
        workout_id: workoutId,
        name: ex.name,
        video: ex.video || null,
        reps: ex.reps || "—",
        sets: ex.sets !== undefined && ex.sets !== null && ex.sets !== "—" ? parseInt(ex.sets, 10) : null,
        sort_order: index,
        is_done: ex.is_done || false,
        updated_at: new Date().toISOString()
      };
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (ex.id && uuidRegex.test(ex.id)) {
        row.id = ex.id;
      }
      return row;
    });

    const { error } = await supabaseClient
      .from("user_exercises")
      .upsert(rows);

    if (error) {
      console.error("Error saving user exercises:", error);
      return false;
    }
    return true;
  },

  async deleteUserExercise(exerciseId) {
    if (!this.isConfigured()) return false;
    const { error } = await supabaseClient
      .from("user_exercises")
      .delete()
      .eq("id", exerciseId);

    if (error) {
      console.error("Error deleting exercise:", error);
      return false;
    }
    return true;
  },

  async getProfile() {
    if (!this.isConfigured()) return null;
    const session = await this.getSession();
    if (!session) return null;

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
    return data;
  },

  async updateUserProfile(name, phone, gender = null, height = null, weight = null) {
    if (!this.isConfigured()) return false;
    const session = await this.getSession();
    if (!session) return false;

    const meta = { name, phone };
    if (gender) meta.gender = gender;
    if (height !== null) meta.height = height;
    if (weight !== null) meta.weight = weight;

    // 1. Update Auth Metadata
    const { error: authError } = await supabaseClient.auth.updateUser({
      data: meta
    });
    if (authError) throw authError;

    // 2. Update profiles table
    const dbUpdates = { name, phone, updated_at: new Date().toISOString() };
    if (gender) dbUpdates.gender = gender;
    try {
      const { error: dbError } = await supabaseClient
        .from("profiles")
        .update(dbUpdates)
        .eq("id", session.user.id);
      if (dbError) {
        console.warn("Profiles database table update error (expected if gender column doesn't exist yet):", dbError);
        // Fallback: if gender column doesn't exist, retry without it
        if (dbError.code === "PGRST204" || (dbError.message && dbError.message.includes("gender"))) {
          console.log("Retrying profile update without gender column...");
          const dbUpdatesFallback = { name, phone, updated_at: new Date().toISOString() };
          const { error: fallbackError } = await supabaseClient
            .from("profiles")
            .update(dbUpdatesFallback)
            .eq("id", session.user.id);
          if (fallbackError) {
            console.error("Profiles database fallback update error:", fallbackError);
          }
        }
      }
    } catch (e) {
      console.warn("Failed updating profiles database table:", e);
    }

    return true;
  },

  async updateUserMetadata(meta) {
    if (!this.isConfigured()) return false;
    const { error } = await supabaseClient.auth.updateUser({
      data: meta
    });
    if (error) throw error;
    return true;
  },

  async updateUserPassword(newPassword) {
    if (!this.isConfigured()) return false;
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    return true;
  },

  async getGymAttendance() {
    if (!this.isConfigured()) {
      const local = localStorage.getItem("fitflow:attendance");
      return local ? JSON.parse(local) : [];
    }
    const session = await this.getSession();
    if (!session) return [];

    try {
      const { data, error } = await supabaseClient
        .from("gym_attendance")
        .select("*")
        .eq("user_id", session.user.id)
        .order("check_in_time", { ascending: false });

      if (error) {
        console.error("Error fetching gym attendance from Supabase:", error);
        // Fallback to localStorage if schema cache error, table missing, or RLS error
        if (error.code === "PGRST204" || error.message?.includes("gym_attendance") || error.message?.includes("schema cache")) {
          console.warn("Table 'gym_attendance' not found. Falling back to localStorage.");
          const local = localStorage.getItem("fitflow:attendance");
          return local ? JSON.parse(local) : [];
        }
        return [];
      }
      return data;
    } catch (err) {
      console.error("Catch error fetching gym attendance:", err);
      const local = localStorage.getItem("fitflow:attendance");
      return local ? JSON.parse(local) : [];
    }
  },

  async logGymAttendance(checkInTime, notes = "") {
    const isLocalId = (id) => typeof id === "string" && id.startsWith("local-");
    
    if (!this.isConfigured()) {
      const local = localStorage.getItem("fitflow:attendance");
      const list = local ? JSON.parse(local) : [];
      const newEntry = {
        id: "local-" + Date.now(),
        check_in_time: checkInTime,
        notes: notes,
        created_at: new Date().toISOString()
      };
      list.push(newEntry);
      localStorage.setItem("fitflow:attendance", JSON.stringify(list));
      return newEntry;
    }
    const session = await this.getSession();
    if (!session) return null;

    try {
      const { data, error } = await supabaseClient
        .from("gym_attendance")
        .insert({
          user_id: session.user.id,
          check_in_time: checkInTime,
          notes: notes
        })
        .select()
        .single();

      if (error) {
        console.error("Error inserting gym attendance to Supabase:", error);
        // Fallback to localStorage
        if (error.code === "PGRST204" || error.message?.includes("gym_attendance") || error.message?.includes("schema cache")) {
          console.warn("Table 'gym_attendance' not found. Logging check-in to localStorage instead.");
          const local = localStorage.getItem("fitflow:attendance");
          const list = local ? JSON.parse(local) : [];
          const newEntry = {
            id: "local-" + Date.now(),
            check_in_time: checkInTime,
            notes: notes,
            created_at: new Date().toISOString()
          };
          list.push(newEntry);
          localStorage.setItem("fitflow:attendance", JSON.stringify(list));
          return newEntry;
        }
        throw error;
      }
      return data;
    } catch (err) {
      console.error("Catch error inserting gym attendance:", err);
      const local = localStorage.getItem("fitflow:attendance");
      const list = local ? JSON.parse(local) : [];
      const newEntry = {
        id: "local-" + Date.now(),
        check_in_time: checkInTime,
        notes: notes,
        created_at: new Date().toISOString()
      };
      list.push(newEntry);
      localStorage.setItem("fitflow:attendance", JSON.stringify(list));
      return newEntry;
    }
  },

  async deleteGymAttendance(id) {
    if (!this.isConfigured() || (typeof id === "string" && id.startsWith("local-"))) {
      const local = localStorage.getItem("fitflow:attendance");
      if (local) {
        let list = JSON.parse(local);
        list = list.filter(item => item.id !== id);
        localStorage.setItem("fitflow:attendance", JSON.stringify(list));
      }
      return true;
    }
    
    try {
      const { error } = await supabaseClient
        .from("gym_attendance")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting gym attendance from Supabase:", error);
        if (error.code === "PGRST204" || error.message?.includes("gym_attendance") || error.message?.includes("schema cache")) {
          const local = localStorage.getItem("fitflow:attendance");
          if (local) {
            let list = JSON.parse(local);
            list = list.filter(item => item.id !== id);
            localStorage.setItem("fitflow:attendance", JSON.stringify(list));
          }
          return true;
        }
        return false;
      }
      return true;
    } catch (err) {
      console.error("Catch error deleting gym attendance:", err);
      const local = localStorage.getItem("fitflow:attendance");
      if (local) {
        let list = JSON.parse(local);
        list = list.filter(item => item.id !== id);
        localStorage.setItem("fitflow:attendance", JSON.stringify(list));
      }
      return true;
    }
  },

  subscribeToUserExercises(workoutId, callback) {
    if (!this.isConfigured() || !supabaseClient) return () => {};
    
    console.log(`Subscribing to realtime changes for workout: ${workoutId}`);
    const channel = supabaseClient
      .channel(`realtime:user_exercises:${workoutId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_exercises",
          filter: `workout_id=eq.${workoutId}`
        },
        (payload) => {
          console.log("Realtime payload received:", payload);
          callback(payload);
        }
      )
      .subscribe((status, err) => {
        console.log(`Realtime subscription status for ${workoutId}:`, status, err);
      });

    return () => {
      console.log(`Unsubscribing from realtime changes for workout: ${workoutId}`);
      supabaseClient.removeChannel(channel);
    };
  }
};
