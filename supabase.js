// Initialize Supabase Client
let supabaseClient = null;

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
    window.ENV.SUPABASE_ANON_KEY
  );
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

  async signUp(email, password, phone, name) {
    if (!this.isConfigured()) throw new Error("Supabase is not configured.");
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone }
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
    return data;
  },

  async signOut() {
    if (!this.isConfigured()) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    if (!this.isConfigured()) return null;
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) return null;
    return session;
  },

  onAuthStateChange(callback) {
    if (!this.isConfigured()) return () => {};
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
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

  async updateUserProfile(name, phone) {
    if (!this.isConfigured()) return false;
    const session = await this.getSession();
    if (!session) return false;

    // 1. Update Auth Metadata
    const { error: authError } = await supabaseClient.auth.updateUser({
      data: { name, phone }
    });
    if (authError) throw authError;

    // 2. Update profiles table
    const { error: dbError } = await supabaseClient
      .from("profiles")
      .update({ name, phone, updated_at: new Date().toISOString() })
      .eq("id", session.user.id);
    if (dbError) throw dbError;

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

  subscribeToUserExercises(workoutId, callback) {
    if (!this.isConfigured() || !supabaseClient) return () => {};
    
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
          callback(payload);
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }
};
