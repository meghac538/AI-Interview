"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthForm } from "@/components/ui/sign-in-1";
import { supabase } from "@/lib/supabase/client";

const APP_LOGO = "/one-recruit-logo-dark.png";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export default function HomePage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const [candidateEmail, setCandidateEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const signInWithGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/admin`
          : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to sign in with Google.";
      setGoogleError(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const sendCandidateInvite = async () => {
    const email = candidateEmail.trim().toLowerCase();
    if (!email || inviteLoading) return;
    setInviteLoading(true);
    setInviteError(null);
    setGeneratedLink(null);
    setCopied(false);

    try {
      const accessRes = await fetch("/api/candidate/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const accessData = await accessRes.json();

      if (!accessRes.ok) {
        throw new Error(
          accessData.error || "No active session found for this email.",
        );
      }

      const sessionId = accessData.session_id;
      if (!sessionId) {
        throw new Error("No active session found for this email.");
      }

      const linkRes = await fetch("/api/interviewer/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const linkData = await linkRes.json();

      if (!linkRes.ok) {
        throw new Error(linkData.error || "Failed to generate session link.");
      }

      setGeneratedLink(linkData.action_link);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send invite.";
      setInviteError(message);
    } finally {
      setInviteLoading(false);
    }
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <AuthForm
        logoSrc={APP_LOGO}
        logoAlt="OneRecruit"
        logoClassName="h-20 w-auto logo-shine"
        description="AI-powered live assessment platform by OneOrigin"
      >
        {/* Admin sign-in */}
        <Button
          onClick={signInWithGoogle}
          disabled={googleLoading}
          className="w-full transition-transform hover:scale-[1.03]"
        >
          {googleLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon className="mr-2 h-4 w-4" />
          )}
          {googleLoading ? "Signing in..." : "Admin Sign in with Google"}
        </Button>

        {googleError && (
          <p className="text-sm text-destructive">{googleError}</p>
        )}

        {/* Separator */}
        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              candidate invite
            </span>
          </div>
        </div>

        {/* Send candidate session link */}
        <div className="space-y-2 text-left">
          <Label htmlFor="candidate-email" className="text-sm font-medium">
            Candidate email
          </Label>
          <div className="flex gap-2">
            <Input
              id="candidate-email"
              type="email"
              value={candidateEmail}
              onChange={(e) => {
                setCandidateEmail(e.target.value);
                setInviteError(null);
                setGeneratedLink(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendCandidateInvite();
              }}
              autoComplete="email"
              disabled={inviteLoading}
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={sendCandidateInvite}
              disabled={inviteLoading || !candidateEmail.trim()}
            >
              {inviteLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Generate a secure one-time session link for the candidate.
          </p>
        </div>

        {inviteError && (
          <p className="text-sm text-destructive">{inviteError}</p>
        )}

        {generatedLink && (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Session link generated
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                {generatedLink}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyLink}
                className="h-7 w-7 shrink-0"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with the candidate to join their session.
            </p>
          </div>
        )}
      </AuthForm>

      <div className="fixed bottom-4 text-center text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary" />
          Powered by OneOrigin AI
        </div>
      </div>
    </main>
  );
}
