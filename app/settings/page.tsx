"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WEEKLY_GOAL_OPTIONS, type WeeklyGoalOption } from "@/types";

const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type ProfileSettings = {
  id: string;
  name: string | null;
  weekly_goal: number;
  notification_enabled: boolean;
  notification_days: string[];
  notification_time: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [email, setEmail] = useState("");

  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const [editEmail, setEditEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [editWeeklyGoal, setEditWeeklyGoal] = useState(false);
  const [weeklyGoalDraft, setWeeklyGoalDraft] = useState<WeeklyGoalOption>(3);

  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationDays, setNotificationDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [notificationTime, setNotificationTime] = useState("09:00");

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");
      setEmailDraft(user.email ?? "");

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id,name,weekly_goal,notification_enabled,notification_days,notification_time")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      const typed = profileRow as ProfileSettings;
      setProfile(typed);
      setNameDraft(typed.name ?? "");
      setWeeklyGoalDraft((typed.weekly_goal as WeeklyGoalOption) || 3);
      setNotificationEnabled(Boolean(typed.notification_enabled));
      setNotificationDays(
        Array.isArray(typed.notification_days) && typed.notification_days.length > 0
          ? typed.notification_days
          : ["Mon", "Wed", "Fri"]
      );
      setNotificationTime(typed.notification_time || "09:00");
      setLoading(false);
    };

    void load();
  }, [router, supabase]);

  const weeklyGoalLabel = useMemo(() => {
    const found = WEEKLY_GOAL_OPTIONS.find((option) => option.value === (profile?.weekly_goal ?? 3));
    return found?.label ?? "3 times a week";
  }, [profile?.weekly_goal]);

  const setMessage = (next: string) => {
    setSuccess(next);
    window.setTimeout(() => setSuccess(""), 2200);
  };

  const saveName = async () => {
    if (!profile) return;
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ name: nameDraft.trim() || null })
      .eq("id", profile.id);
    setSaving(false);
    if (updateError) return setError(updateError.message);
    setProfile({ ...profile, name: nameDraft.trim() || null });
    setEditName(false);
    setMessage("Name updated");
  };

  const saveEmail = async () => {
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ email: emailDraft.trim() });
    setSaving(false);
    if (updateError) return setError(updateError.message);
    setEmail(emailDraft.trim());
    setEditEmail(false);
    setMessage("Email update requested. Check your inbox to confirm.");
  };

  const savePassword = async () => {
    if (newPassword.length < 8) return setError("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");

    setSaving(true);
    setError("");

    const signInRes = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword
    });
    if (signInRes.error) {
      setSaving(false);
      return setError("Current password is incorrect.");
    }

    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (pwError) return setError(pwError.message);

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordForm(false);
    setMessage("Password updated");
  };

  const saveWeeklyGoal = async () => {
    if (!profile) return;
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ weekly_goal: weeklyGoalDraft })
      .eq("id", profile.id);
    setSaving(false);
    if (updateError) return setError(updateError.message);
    setProfile({ ...profile, weekly_goal: weeklyGoalDraft });
    setEditWeeklyGoal(false);
    setMessage("Weekly goal updated");
  };

  const toggleDay = (day: string) => {
    setNotificationDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day]
    );
  };

  const saveNotifications = async () => {
    if (!profile) return;
    setSaving(true);
    setError("");
    const payload = notificationEnabled
      ? {
          notification_enabled: true,
          notification_days: notificationDays,
          notification_time: notificationTime
        }
      : {
          notification_enabled: false,
          notification_days: [],
          notification_time: ""
        };
    const { error: updateError } = await supabase.from("profiles").update(payload).eq("id", profile.id);
    setSaving(false);
    if (updateError) return setError(updateError.message);
    setProfile({
      ...profile,
      ...payload
    });
    setMessage("Notifications updated");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setError("");
    const res = await fetch("/api/account/delete", { method: "POST", credentials: "include" });
    setDeleting(false);
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      return setError(payload.error ?? "Failed to delete account.");
    }
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading || !profile) {
    return (
      <main className="bg-teal-900 p-6 text-sm text-teal-200">Loading settings...</main>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-teal-400/30 bg-teal-850 px-3 py-2 text-sm text-white placeholder:text-teal-300 focus:border-lime-300 focus:outline-none";

  return (
    <main className="min-h-screen bg-teal-900 pb-8">
      <header className="relative flex items-center justify-center px-5 pt-8">
        <Link
          href="/profile"
          className="absolute left-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-teal-400/30 bg-teal-800 text-teal-200"
          aria-label="Back to profile"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-sans text-xl font-extrabold text-white">Settings</h1>
      </header>

      <section className="mx-5 mt-6 rounded-xl border border-teal-400/30 bg-teal-800 p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-teal-300">Account</h2>

        <div className="mb-4 border-b border-teal-400/20 pb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-teal-200">Name</p>
            {!editName ? (
              <button type="button" onClick={() => setEditName(true)} className="text-sm font-extrabold text-lime-300">
                Edit
              </button>
            ) : null}
          </div>
          {!editName ? (
            <p className="mt-1 text-base font-bold text-white">{profile.name || "Not set"}</p>
          ) : (
            <div className="mt-2 flex gap-2">
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => void saveName()}
                disabled={saving}
                className="shrink-0 rounded-full bg-lime-300 px-4 py-2 text-sm font-extrabold text-lime-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          )}
        </div>

        <div className="mb-4 border-b border-teal-400/20 pb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-teal-200">Email</p>
            {!editEmail ? (
              <button type="button" onClick={() => setEditEmail(true)} className="text-sm font-extrabold text-lime-300">
                Change
              </button>
            ) : null}
          </div>
          {!editEmail ? (
            <p className="mt-1 text-base font-bold text-white">{email}</p>
          ) : (
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => void saveEmail()}
                disabled={saving}
                className="shrink-0 rounded-full bg-lime-300 px-4 py-2 text-sm font-extrabold text-lime-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-teal-200">Password</p>
            <button
              type="button"
              onClick={() => setShowPasswordForm((current) => !current)}
              className="text-sm font-extrabold text-lime-300"
            >
              Change password
            </button>
          </div>
          {showPasswordForm ? (
            <div className="mt-2 space-y-2">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => void savePassword()}
                disabled={saving}
                className="rounded-full bg-lime-300 px-4 py-2 text-sm font-extrabold text-lime-700 disabled:opacity-50"
              >
                Save password
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-5 mt-4 rounded-xl border border-teal-400/30 bg-teal-800 p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-teal-300">Learning</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-teal-200">Weekly goal</p>
          {!editWeeklyGoal ? (
            <button type="button" onClick={() => setEditWeeklyGoal(true)} className="text-sm font-extrabold text-lime-300">
              Edit
            </button>
          ) : null}
        </div>
        {!editWeeklyGoal ? (
          <p className="mt-1 text-base font-bold text-white">{weeklyGoalLabel}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {WEEKLY_GOAL_OPTIONS.map((option) => {
              const selected = weeklyGoalDraft === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setWeeklyGoalDraft(option.value)}
                  className={`block w-full rounded-xl border p-3 text-left ${
                    selected ? "border-lime-300/50 bg-lime-300/10" : "border-teal-400/30 bg-teal-850"
                  }`}
                >
                  <p className="text-sm font-bold text-white">{option.label}</p>
                  <p className="text-xs text-teal-200">{option.description}</p>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => void saveWeeklyGoal()}
              disabled={saving}
              className="rounded-full bg-lime-300 px-4 py-2 text-sm font-extrabold text-lime-700 disabled:opacity-50"
            >
              Save weekly goal
            </button>
          </div>
        )}
      </section>

      <section className="mx-5 mt-4 rounded-xl border border-teal-400/30 bg-teal-800 p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-teal-300">Notifications</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-teal-200">Practice reminders</p>
          <button
            type="button"
            onClick={() => setNotificationEnabled((current) => !current)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              notificationEnabled ? "bg-lime-300" : "bg-teal-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-teal-900 transition ${
                notificationEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {notificationEnabled ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => {
                const selected = notificationDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-extrabold ${
                      selected
                        ? "border-lime-300 bg-lime-300 text-lime-700"
                        : "border-teal-400/30 text-teal-200"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <input
              type="time"
              value={notificationTime}
              onChange={(event) => setNotificationTime(event.target.value)}
              className={inputClass}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void saveNotifications()}
          disabled={saving}
          className="mt-4 rounded-full bg-teal-600 px-4 py-2 text-sm font-extrabold text-lime-300 disabled:opacity-50"
        >
          Save notifications
        </button>
      </section>

      <section className="mt-8 px-5">
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-full border border-teal-400/30 py-3 text-sm font-extrabold text-teal-200"
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={() => setDeleteConfirmOpen(true)}
          className="mt-4 block w-full text-center text-sm font-bold text-red-400 underline"
        >
          Delete account
        </button>
      </section>

      {success ? <p className="mt-4 px-5 text-sm font-bold text-lime-300">{success}</p> : null}
      {error ? <p className="mt-2 px-5 text-sm text-red-400">{error}</p> : null}

      {deleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 px-4 pt-40"
          onClick={() => !deleting && setDeleteConfirmOpen(false)}
        >
          <div
            className="mx-auto max-w-sm rounded-xl border border-teal-400/30 bg-teal-800 p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-sans text-xl font-extrabold text-white">Delete account?</h2>
            <p className="mt-2 text-sm text-teal-200">
              This permanently removes your profile, progress, and account. This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 rounded-full border border-teal-400/30 px-5 py-2.5 text-sm font-extrabold text-teal-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteAccount()}
                className="flex-1 rounded-full bg-red-600 px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
